"""
crypto.py — All cryptographic operations for Grade Ledger

This module handles three things:
  1. Deriving a private key FROM a password (so lecturers never manage key files)
  2. Signing ledger entries with that private key
  3. Verifying signatures and hash chains

────────────────────────────────────────────────────────────────
HOW KEY DERIVATION WORKS (important concept):

A lecturer's private key is never stored anywhere. Instead:
  - When a lecturer sets their password, we generate a random "salt"
    (just random bytes — think of it as extra secret ingredient)
  - We store that salt in the database
  - Every time the lecturer needs to sign something, we combine their
    password + their salt through PBKDF2 (a standard algorithm) to
    produce the same private key every time
  - If the password is wrong, a completely different key comes out,
    and signatures will fail verification

This means:
  - No key file to lose
  - No private key stored anywhere
  - The key exists only in memory, only while they're signing
────────────────────────────────────────────────────────────────
"""

import hashlib
import hmac
import json
import os
import base64
from datetime import datetime, timezone

from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256


# ── Constants ─────────────────────────────────────────────────────────────────

# RSA key size in bits. 2048 is the current industry standard —
# strong enough for our purposes without being slow.
RSA_KEY_SIZE = 2048

# PBKDF2 iterations — how many times the password is hashed to derive the key.
# More iterations = slower to brute-force if someone steals the salt.
# 600,000 is the current NIST recommendation.
PBKDF2_ITERATIONS = 600_000

# The "genesis hash" — the previous_hash of the very first entry in the ledger.
# Since there's no entry before entry #1, we use this fixed placeholder.
# Like Bitcoin's genesis block — a known starting point.
GENESIS_HASH = "0" * 64  # 64 zeros


# ── Key Generation and Derivation ─────────────────────────────────────────────

def generate_salt() -> str:
    """
    Generate a random 32-byte salt and return it as a hex string.
    Called once when a lecturer sets their password for the first time.
    The salt is stored in the database alongside the lecturer's record.
    """
    return os.urandom(32).hex()


def derive_private_key(password: str, salt_hex: str) -> RSA.RsaKey:
    """
    Derive a deterministic RSA private key from a password and salt.

    'Deterministic' means: same password + same salt = same key, every time.
    Different password = completely different key.

    How it works:
      1. PBKDF2 turns the password+salt into 64 bytes of key material
         (this is the slow, secure step that resists brute-force attacks)
      2. We use those 64 bytes as the seed for a deterministic random number
         generator (a DRBG — Deterministic Random Bit Generator)
      3. RSA key generation uses that generator, so it always produces
         the same RSA key for the same seed
    """
    salt = bytes.fromhex(salt_hex)

    # Step 1: PBKDF2 — derive 64 bytes from password + salt
    key_material = hashlib.pbkdf2_hmac(
        hash_name="sha256",
        password=password.encode("utf-8"),
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
        dklen=64  # 64 bytes of output
    )

    # Step 2: Use key_material as seed for a deterministic RNG
    # We implement a simple DRBG using HMAC-SHA256
    class DeterministicRNG:
        """
        A deterministic random number generator seeded with our key material.
        RSA.generate() accepts a randfunc parameter — we pass this class's
        read() method so key generation is reproducible.
        """
        def __init__(self, seed: bytes):
            self.state = seed
            self.counter = 0

        def read(self, n: int) -> bytes:
            output = b""
            while len(output) < n:
                # HMAC-SHA256 produces 32 bytes each round
                self.counter += 1
                h = hmac.new(
                    self.state,
                    self.counter.to_bytes(8, "big"),
                    hashlib.sha256
                )
                output += h.digest()
                # Update state so each call produces different bytes
                self.state = hmac.new(
                    self.state,
                    output,
                    hashlib.sha256
                ).digest()
            return output[:n]

    rng = DeterministicRNG(key_material)

    # Step 3: Generate the RSA key using our deterministic RNG
    private_key = RSA.generate(RSA_KEY_SIZE, randfunc=rng.read)
    return private_key


def get_public_key_pem(password: str, salt_hex: str) -> str:
    """
    Derive the RSA key pair and return ONLY the public key in PEM format.
    Called when a lecturer sets their password — we store only the public key.

    PEM format looks like:
    -----BEGIN PUBLIC KEY-----
    MIIBIjANBgkqhkiG9w0BAQEFAAOC...
    -----END PUBLIC KEY-----
    """
    private_key = derive_private_key(password, salt_hex)
    public_key = private_key.publickey()
    return public_key.export_key("PEM").decode("utf-8")


# ── Signing ───────────────────────────────────────────────────────────────────

def sign_entry(entry_data: dict, password: str, salt_hex: str) -> str:
    """
    Sign a ledger entry with the lecturer's private key.

    entry_data: a dictionary of the entry fields to sign
    password: the lecturer's password (used to derive the key)
    salt_hex: the lecturer's stored salt

    Returns: the signature as a base64-encoded string
             (base64 is a way to store binary data as readable text)

    The signature proves:
      1. This entry was created by someone who knows this lecturer's password
      2. The entry data has not been changed since signing
    """
    private_key = derive_private_key(password, salt_hex)

    # Serialize the entry data to a canonical (consistent) string
    # We sort keys so the order doesn't matter
    message = _canonicalize(entry_data)
    message_bytes = message.encode("utf-8")

    # Hash the message first (SHA-256), then sign the hash
    message_hash = SHA256.new(message_bytes)
    signature = pkcs1_15.new(private_key).sign(message_hash)

    return base64.b64encode(signature).decode("utf-8")


def verify_signature(entry_data: dict, signature_b64: str, public_key_pem: str) -> bool:
    """
    Verify that a ledger entry's signature is valid.

    Returns True if the signature is genuine, False if tampered or invalid.
    Called by the "Verify Ledger" button — checks every entry.
    """
    try:
        public_key = RSA.import_key(public_key_pem.encode("utf-8"))
        message = _canonicalize(entry_data)
        message_bytes = message.encode("utf-8")
        message_hash = SHA256.new(message_bytes)
        pkcs1_15.new(public_key).verify(message_hash, base64.b64decode(signature_b64))
        return True
    except (ValueError, TypeError):
        return False


def _canonicalize(data: dict) -> str:
    """
    Convert a dictionary to a consistent, sorted JSON string.
    This ensures the same data always produces the same string,
    regardless of the order keys were added to the dictionary.
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


# ── Hashing ───────────────────────────────────────────────────────────────────

def compute_entry_hash(entry_data: dict, previous_hash: str) -> str:
    """
    Compute the SHA-256 hash for a ledger entry.

    The hash is computed over:
      - All the entry's data fields
      - The previous entry's hash

    This creates the "chain" — if you change entry #3's data,
    its hash changes, which breaks entry #4's hash (since #4 includes
    #3's hash), which breaks entry #5, and so on.
    Any tampering propagates forward and is detectable.

    Returns a 64-character hex string (SHA-256 produces 32 bytes = 64 hex chars).
    """
    chain_data = {
        "entry": entry_data,
        "previous_hash": previous_hash
    }
    canonical = _canonicalize(chain_data)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def get_data_for_signing(
    registration_number: str,
    course_code: str,
    department: str,
    academic_session: str,
    semester: str,
    ca_score: int,
    exam_score: int,
    total_score: int,
    grade: str,
    lecturer_code: str,
    entry_type: str,
    corrects_entry_id,
    submitted_at: str
) -> dict:
    """
    Build the canonical dictionary of fields that get signed and hashed.

    We define exactly which fields are included so signing and verification
    always use the same fields in the same structure.

    Note: we do NOT include the signature or hash itself (obviously),
    and we don't include the database ID (assigned after signing).
    """
    return {
        "registration_number": registration_number,
        "course_code": course_code,
        "department": department,
        "academic_session": academic_session,
        "semester": semester,
        "ca_score": ca_score,
        "exam_score": exam_score,
        "total_score": total_score,
        "grade": grade,
        "lecturer_code": lecturer_code,
        "entry_type": entry_type,
        "corrects_entry_id": corrects_entry_id,
        "submitted_at": submitted_at,
    }


# ── Grade Calculation ─────────────────────────────────────────────────────────

def calculate_grade(total_score: int) -> str:
    """
    Calculate letter grade from total score.
    This is the authoritative grade calculator used server-side.
    The frontend also shows a preview, but the server always recalculates.
    """
    if total_score >= 70:
        return "A"
    elif total_score >= 60:
        return "B"
    elif total_score >= 50:
        return "C"
    elif total_score >= 45:
        return "D"
    elif total_score >= 40:
        return "E"
    else:
        return "F"


def validate_scores(ca_score: int, exam_score: int) -> tuple[bool, str]:
    """
    Validate that scores are within allowed ranges.
    Returns (is_valid, error_message).
    """
    if ca_score < 0 or ca_score > 30:
        return False, f"CA score must be between 0 and 30. Got {ca_score}."
    if exam_score < 0 or exam_score > 70:
        return False, f"Exam score must be between 0 and 70. Got {exam_score}."
    return True, ""
