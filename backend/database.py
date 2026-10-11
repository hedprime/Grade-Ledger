"""
database.py — Database models and setup for Grade Ledger

We use SQLAlchemy (a Python library) to define our tables as Python classes.
Each class becomes a table in the SQLite database file (gradeledger.db).
SQLite stores everything in a single file on your computer — no server needed.
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Text,
    ForeignKey, DateTime, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone

# This line tells SQLAlchemy to create/use a file called gradeledger.db
# in the same folder as this script. The file is created automatically
# the first time you run the app.
DATABASE_URL = "sqlite:///./gradeledger.db"

engine = create_engine(
    DATABASE_URL,
    # This setting is required for SQLite when used with FastAPI
    # because FastAPI handles multiple requests at the same time
    connect_args={"check_same_thread": False}
)

# SessionLocal is a factory — every time we need to talk to the database,
# we create a new "session" from this factory, use it, then close it.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class all our table models will inherit from
Base = declarative_base()


# ── TABLE 1: Admins ───────────────────────────────────────────────────────────
# This is you — the person who controls the whole system.
# Admins can create department head accounts. That's their main power.
class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    # We never store passwords in plain text. We store a "hash" —
    # a scrambled version that can verify a password but can't be reversed.
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── TABLE 2: Department Heads ─────────────────────────────────────────────────
# One per department. Created by admin.
# Can add lecturers, assign codes and courses within their department.
class DepartmentHead(Base):
    __tablename__ = "department_heads"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # "relationship" tells SQLAlchemy that a dept head has many lecturers.
    # This lets us do things like: dept_head.lecturers to get all their lecturers.
    lecturers = relationship("Lecturer", back_populates="department_head")


# ── TABLE 3: Lecturers ────────────────────────────────────────────────────────
# Pre-loaded into the system by the dept head (name + code).
# They complete signup themselves using their name + code,
# then set a permanent password.
class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    # Lecturer code is assigned by dept head — used like a username.
    # It is permanent and cannot be changed.
    lecturer_code = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)  # NULL until first login
    # has_completed_signup: False until the lecturer sets their password
    has_completed_signup = Column(Boolean, default=False)
    # Salt is random data used during key derivation — explained in crypto.py
    key_salt = Column(String, nullable=True)  # Set when password is created
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    department_head_id = Column(Integer, ForeignKey("department_heads.id"))
    department_head = relationship("DepartmentHead", back_populates="lecturers")

    # One lecturer can have multiple public keys (Option C: key history).
    # Old entries keep their old key. New entries use the new key.
    public_keys = relationship("LecturerPublicKey", back_populates="lecturer")
    courses = relationship("Course", back_populates="lecturer")
    ledger_entries = relationship("LedgerEntry", back_populates="lecturer")


# ── TABLE 4: Lecturer Public Keys ─────────────────────────────────────────────
# Every time a lecturer sets or changes their password, a new public key
# is generated and stored here with a timestamp.
#
# Why store key history? Because each ledger entry stores which key signed it.
# When we verify entry #5 (signed in Jan 2024), we use the key that was
# active in Jan 2024 — not whatever key the lecturer has now.
# This is Option C from our earlier discussion.
class LecturerPublicKey(Base):
    __tablename__ = "lecturer_public_keys"

    id = Column(Integer, primary_key=True, index=True)
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=False)
    # The public key stored as PEM text (a standard format for cryptographic keys)
    public_key_pem = Column(Text, nullable=False)
    # When this key became active
    active_from = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # When this key was retired (NULL means it's currently active)
    active_until = Column(DateTime, nullable=True)
    is_current = Column(Boolean, default=True)

    lecturer = relationship("Lecturer", back_populates="public_keys")


# ── TABLE 5: Courses ──────────────────────────────────────────────────────────
# Each course is assigned to exactly one lecturer by the dept head.
# A lecturer can only submit entries for their assigned courses.
class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=True)
    department = Column(String, nullable=False)
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lecturer = relationship("Lecturer", back_populates="courses")


# ── TABLE 6: Ledger Entries ───────────────────────────────────────────────────
# The heart of the system. Every score submission ever made lives here.
# Nothing is ever deleted or edited — corrections are new rows.
class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)  # Auto-incrementing entry number

    # Student and course info
    registration_number = Column(String, nullable=False)
    course_code = Column(String, nullable=False)
    department = Column(String, nullable=False)
    academic_session = Column(String, nullable=False)   # e.g. "2024/2025"
    semester = Column(String, nullable=False)            # "First" or "Second"

    # Scores — computed by the system, not stored manually for total/grade
    ca_score = Column(Integer, nullable=False)    # max 30
    exam_score = Column(Integer, nullable=False)  # max 70
    total_score = Column(Integer, nullable=False) # ca + exam, calculated server-side
    grade = Column(String, nullable=False)        # A/B/C/D/E/F, calculated server-side

    # Who submitted this entry
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=False)
    # We also store the lecturer code directly so it stays on the entry
    # even if something changes in the lecturer table
    lecturer_code = Column(String, nullable=False)

    # Cryptographic fields
    # The public key ID used to sign this entry — for verification later
    public_key_id = Column(Integer, ForeignKey("lecturer_public_keys.id"), nullable=False)
    # The digital signature — proof this entry came from this lecturer
    signature = Column(Text, nullable=False)
    # This entry's hash — SHA-256 of all entry data + previous hash
    entry_hash = Column(String, nullable=False)
    # The hash of the entry that came before this one (chain link)
    previous_hash = Column(String, nullable=False)

    # Entry type
    # "original" = normal submission
    # "correction" = fixing a mistake in a previous entry
    entry_type = Column(String, default="original")
    # If this is a correction, which entry number does it correct?
    corrects_entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)

    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    lecturer = relationship("Lecturer", back_populates="ledger_entries")
    corrects_entry = relationship("LedgerEntry", remote_side=[id], foreign_keys=[corrects_entry_id])


# ── Create all tables ─────────────────────────────────────────────────────────
# This function is called once when the app starts.
# It looks at all the classes above and creates the matching tables in the
# database file if they don't already exist.
def create_tables():
    Base.metadata.create_all(bind=engine)


# ── Database session dependency ───────────────────────────────────────────────
# FastAPI uses "dependency injection" — this function is called automatically
# before each API request to provide a fresh database session,
# and closes it cleanly when the request is done.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
