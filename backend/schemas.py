"""
schemas.py — Data shapes for API requests and responses

Pydantic schemas define exactly what data the API expects to receive
and what it will return. FastAPI uses these to:
  - Automatically validate incoming data (wrong type = clear error message)
  - Automatically generate API documentation
  - Serialize outgoing data into clean JSON

Think of schemas as contracts: "this endpoint expects THIS shape of data
and will return THAT shape of data."
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """What the frontend sends when a user clicks Sign In."""
    username: str
    password: str
    role: str  # "admin", "dept_head", or "lecturer"


class TokenResponse(BaseModel):
    """What the server sends back after a successful login."""
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    lecturer_code: Optional[str] = None  # Only for lecturers


# ── Lecturer Signup Schemas ───────────────────────────────────────────────────

class LecturerSignupRequest(BaseModel):
    """
    What a lecturer sends when completing their first-time signup.
    They provide their name + assigned code (to prove identity)
    and choose a permanent password.
    """
    full_name: str
    lecturer_code: str
    password: str = Field(min_length=8, description="Must be at least 8 characters")
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LecturerPasswordChangeRequest(BaseModel):
    """For when a lecturer wants to change their password after initial setup."""
    current_password: str
    new_password: str = Field(min_length=8)
    confirm_new_password: str

    @field_validator("confirm_new_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


# ── Admin / Dept Head Management Schemas ─────────────────────────────────────

class CreateDeptHeadRequest(BaseModel):
    """Admin uses this to create a department head account."""
    username: str
    password: str = Field(min_length=8)
    full_name: str
    department: str


class CreateLecturerRequest(BaseModel):
    """
    Dept head uses this to pre-register a lecturer.
    This just creates the record with name + code.
    The lecturer completes signup themselves later.
    """
    full_name: str
    lecturer_code: str
    department: str  # Must match dept head's department


class AssignCourseRequest(BaseModel):
    """Dept head uses this to assign a course to a lecturer."""
    course_code: str
    course_name: Optional[str] = None
    lecturer_code: str  # Which lecturer gets this course


# ── Ledger Entry Schemas ──────────────────────────────────────────────────────

class NewEntryRequest(BaseModel):
    """
    What a lecturer sends when submitting a new grade entry.
    The server will calculate total_score and grade — not trusted from client.
    The server will also handle signing and hashing.
    """
    registration_number: str
    course_code: str
    academic_session: str   # e.g. "2024/2025"
    semester: str           # "First" or "Second"
    ca_score: int = Field(ge=0, le=30, description="CA score: 0–30")
    exam_score: int = Field(ge=0, le=70, description="Exam score: 0–70")
    # The lecturer's password is needed to derive their private key for signing
    # NOTE: This is sent over HTTPS only — never logged or stored
    password: str
    department: Optional[str] = None  # Student's department (may differ from lecturer's department)

    @field_validator("semester")
    @classmethod
    def valid_semester(cls, v):
        if v not in ("First", "Second"):
            raise ValueError("Semester must be 'First' or 'Second'")
        return v

    @field_validator("academic_session")
    @classmethod
    def valid_session(cls, v):
        # Must look like "2024/2025"
        parts = v.split("/")
        if len(parts) != 2:
            raise ValueError("Session must be in format YYYY/YYYY e.g. 2024/2025")
        return v


class CorrectionEntryRequest(BaseModel):
    """
    What a lecturer sends when submitting a correction.
    Same as NewEntryRequest but includes which entry is being corrected.
    """
    corrects_entry_id: int  # The entry number being corrected
    registration_number: str
    course_code: str
    academic_session: str
    semester: str
    ca_score: int = Field(ge=0, le=30)
    exam_score: int = Field(ge=0, le=70)
    password: str


# ── Response Schemas ──────────────────────────────────────────────────────────

class LedgerEntryResponse(BaseModel):
    """
    What the API returns for each ledger entry.
    This is what populates the rows in the table on the frontend.
    """
    id: int
    registration_number: str
    course_code: str
    department: str
    academic_session: str
    semester: str
    ca_score: int
    exam_score: int
    total_score: int
    grade: str
    lecturer_code: str
    entry_type: str
    corrects_entry_id: Optional[int]
    signature: str
    entry_hash: str
    previous_hash: str
    submitted_at: datetime

    # Pydantic v2 way to allow reading from SQLAlchemy ORM objects
    model_config = {"from_attributes": True}


class VerificationResult(BaseModel):
    """Result of the full ledger verification check."""
    is_valid: bool
    total_entries_checked: int
    errors: list[dict]  # List of {entry_id, error_type, description}
    message: str


class LecturerResponse(BaseModel):
    """Public info about a lecturer (returned in lists etc.)"""
    id: int
    full_name: str
    lecturer_code: str
    department: str
    has_completed_signup: bool

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    """Course info returned by the API."""
    id: int
    course_code: str
    course_name: Optional[str]
    department: str
    lecturer_code: str

    model_config = {"from_attributes": True}
