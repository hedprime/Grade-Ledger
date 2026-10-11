"""
auth.py — Authentication for Grade Ledger

Handles:
  1. Password hashing and verification (using bcrypt — the industry standard)
  2. JWT token creation and verification

────────────────────────────────────────────────────────────────
HOW LOGIN WORKS:

When a user logs in:
  1. They send their username + password
  2. We find their record in the database
  3. We verify their password against the stored hash
  4. If correct, we generate a JWT token and send it back

A JWT (JSON Web Token) is like a signed ID card:
  - It contains: who you are, your role, when it expires
  - It's signed with a secret key only the server knows
  - The frontend stores it and sends it with every request
  - The server verifies the signature to confirm it's genuine
  - No need to hit the database on every request

The token expires after 8 hours — the user logs in once per session.
────────────────────────────────────────────────────────────────
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt

# ── Configuration ─────────────────────────────────────────────────────────────

# SECRET_KEY is used to sign JWT tokens. In production this should be a long
# random string stored in an environment variable, not hardcoded.
# We'll make this easy to change later.
SECRET_KEY = "gradeledger-secret-key-change-this-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

# CryptContext handles bcrypt password hashing.
# bcrypt automatically handles salting and is resistant to brute-force attacks.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password Utilities ────────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    The result looks like: $2b$12$... (a bcrypt hash string)
    This is what gets stored in the database — never the plain password.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check if a plain text password matches a stored bcrypt hash.
    Returns True if they match, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Token Utilities ───────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """
    Create a JWT token containing the given data.

    data should include:
      - "sub": the user's identifier (e.g. their username or ID)
      - "role": their role ("admin", "dept_head", "lecturer")
      - "name": their display name
      - any other fields needed by the frontend

    The token automatically includes an expiry time.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.
    Returns the token's payload (the data dict) if valid.
    Returns None if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
