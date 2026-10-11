"""
main.py — The Grade Ledger API Server

This is the entry point for the backend. When you run this file,
it starts a web server that the React frontend can talk to.

FastAPI automatically generates interactive API documentation at:
  http://localhost:8000/docs  ← you can test every endpoint here in the browser

Run with:
  uvicorn main:app --reload
"""

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List

from database import get_db, create_tables, Lecturer, LecturerPublicKey, \
    LedgerEntry, Admin, DepartmentHead, Course
from schemas import (
    LoginRequest, TokenResponse,
    LecturerSignupRequest, LecturerPasswordChangeRequest,
    CreateDeptHeadRequest, CreateLecturerRequest, AssignCourseRequest,
    NewEntryRequest, CorrectionEntryRequest,
    LedgerEntryResponse, VerificationResult,
    LecturerResponse, CourseResponse
)
from auth import hash_password, verify_password, create_access_token, decode_access_token
from crypto import (
    generate_salt, get_public_key_pem, sign_entry,
    verify_signature, compute_entry_hash, get_data_for_signing,
    calculate_grade, validate_scores, GENESIS_HASH
)

# ── App Setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Grade Ledger API",
    description="Cryptographically signed, tamper-proof student grade ledger",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) — allows the React frontend
# (running on localhost:5173) to make requests to this server (localhost:8000).
# Without this, the browser blocks the requests for security reasons.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables when the server starts
@app.on_event("startup")
def on_startup():
    create_tables()
    _seed_admin()


# ── Auth Dependency ───────────────────────────────────────────────────────────

def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Dependency that extracts and verifies the JWT token from the
    Authorization header. Used to protect routes that require login.

    The frontend sends: Authorization: Bearer <token>
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    return payload


def require_role(*roles: str):
    """
    Dependency factory that restricts a route to specific roles.
    Usage: Depends(require_role("admin")) or Depends(require_role("lecturer", "dept_head"))
    """
    def check_role(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(roles)}"
            )
        return user
    return check_role


# ── Seed Admin Account ────────────────────────────────────────────────────────

def _seed_admin():
    """
    Create the default admin account on first run if it doesn't exist.
    Default credentials: username=admin, password=admin123
    IMPORTANT: Change this password immediately after first login.
    """
    db = next(get_db())
    try:
        existing = db.query(Admin).filter(Admin.username == "admin").first()
        if not existing:
            admin = Admin(
                username="admin",
                password_hash=hash_password("admin123")
            )
            db.add(admin)
            db.commit()
            print("✓ Default admin account created. Username: admin, Password: admin123")
            print("  IMPORTANT: Change the admin password after first login!")
    finally:
        db.close()


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Simple health check — confirms the server is running."""
    return {"status": "Grade Ledger API is running", "version": "1.0.0"}


# ── AUTH ROUTES ───────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint for all user types.
    The frontend sends role + username + password.
    Returns a JWT token if credentials are correct.
    """
    if request.role == "admin":
        user = db.query(Admin).filter(Admin.username == request.username).first()
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token({
            "sub": str(user.id),
            "role": "admin",
            "name": "Admin",
            "username": user.username
        })
        return TokenResponse(access_token=token, role="admin", name="Admin")

    elif request.role == "dept_head":
        user = db.query(DepartmentHead).filter(
            DepartmentHead.username == request.username
        ).first()
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token({
            "sub": str(user.id),
            "role": "dept_head",
            "name": user.full_name,
            "department": user.department,
            "username": user.username
        })
        return TokenResponse(access_token=token, role="dept_head", name=user.full_name)

    elif request.role == "lecturer":
        user = db.query(Lecturer).filter(
            Lecturer.lecturer_code == request.username
        ).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.has_completed_signup:
            raise HTTPException(
                status_code=403,
                detail="Account setup not complete. Please complete signup first."
            )
        if not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token({
            "sub": str(user.id),
            "role": "lecturer",
            "name": user.full_name,
            "lecturer_code": user.lecturer_code,
            "department": user.department
        })
        return TokenResponse(
            access_token=token,
            role="lecturer",
            name=user.full_name,
            lecturer_code=user.lecturer_code
        )

    raise HTTPException(status_code=400, detail="Invalid role")


@app.post("/auth/signup/lecturer")
def lecturer_signup(request: LecturerSignupRequest, db: Session = Depends(get_db)):
    """
    First-time setup for a lecturer.
    They provide their full name + lecturer code (assigned by dept head)
    and choose a password. The name must exactly match what the dept head registered.
    """
    # Find the pre-registered lecturer record
    lecturer = db.query(Lecturer).filter(
        Lecturer.lecturer_code == request.lecturer_code
    ).first()

    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer code not found. Contact your department head.")

    # Verify the name matches (case-insensitive)
    if lecturer.full_name.lower().strip() != request.full_name.lower().strip():
        raise HTTPException(
            status_code=400,
            detail="Name does not match our records. Contact your department head."
        )

    if lecturer.has_completed_signup:
        raise HTTPException(status_code=400, detail="Signup already completed for this code.")

    # Generate salt and derive public key from password
    salt = generate_salt()
    public_key_pem = get_public_key_pem(request.password, salt)

    # Save password hash and salt
    lecturer.password_hash = hash_password(request.password)
    lecturer.key_salt = salt
    lecturer.has_completed_signup = True

    # Store the public key
    pub_key = LecturerPublicKey(
        lecturer_id=lecturer.id,
        public_key_pem=public_key_pem,
        is_current=True
    )
    db.add(pub_key)
    db.commit()

    return {"message": "Signup complete. You can now log in."}


@app.post("/auth/change-password")
def change_password(
    request: LecturerPasswordChangeRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("lecturer"))
):
    """
    Allows a lecturer to change their password.
    Because the private key is derived from the password, this also
    generates a new key pair. Old entries retain their old public key (Option C).
    """
    lecturer = db.query(Lecturer).filter(
        Lecturer.id == int(user["sub"])
    ).first()

    if not verify_password(request.current_password, lecturer.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Retire the current public key
    old_key = db.query(LecturerPublicKey).filter(
        LecturerPublicKey.lecturer_id == lecturer.id,
        LecturerPublicKey.is_current == True
    ).first()
    if old_key:
        old_key.is_current = False
        old_key.active_until = datetime.now(timezone.utc)

    # Generate new salt and derive new public key
    new_salt = generate_salt()
    new_public_key_pem = get_public_key_pem(request.new_password, new_salt)

    # Update lecturer record
    lecturer.password_hash = hash_password(request.new_password)
    lecturer.key_salt = new_salt

    # Store new public key
    new_key = LecturerPublicKey(
        lecturer_id=lecturer.id,
        public_key_pem=new_public_key_pem,
        is_current=True
    )
    db.add(new_key)
    db.commit()

    return {"message": "Password changed successfully. New key generated."}


# ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

@app.post("/admin/dept-heads", status_code=201)
def create_dept_head(
    request: CreateDeptHeadRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin"))
):
    """Admin creates a department head account."""
    existing = db.query(DepartmentHead).filter(
        DepartmentHead.username == request.username
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    dept_head = DepartmentHead(
        username=request.username,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        department=request.department
    )
    db.add(dept_head)
    db.commit()
    return {"message": f"Department head account created for {request.full_name}"}


@app.get("/admin/dept-heads")
def list_dept_heads(
    db: Session = Depends(get_db),
    user=Depends(require_role("admin"))
):
    """List all department heads."""
    heads = db.query(DepartmentHead).all()
    return [{"id": h.id, "username": h.username, "full_name": h.full_name, "department": h.department} for h in heads]


# ── DEPARTMENT HEAD ROUTES ────────────────────────────────────────────────────

@app.post("/dept-head/lecturers", status_code=201)
def create_lecturer(
    request: CreateLecturerRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("dept_head"))
):
    """
    Dept head pre-registers a lecturer with their name and assigned code.
    The lecturer will complete signup themselves.
    """
    # Dept heads can only add lecturers to their own department
    if request.department != user.get("department"):
        raise HTTPException(status_code=403, detail="You can only add lecturers to your own department")

    existing = db.query(Lecturer).filter(
        Lecturer.lecturer_code == request.lecturer_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lecturer code already in use")

    dept_head = db.query(DepartmentHead).filter(
        DepartmentHead.id == int(user["sub"])
    ).first()

    lecturer = Lecturer(
        full_name=request.full_name,
        lecturer_code=request.lecturer_code,
        department=request.department,
        department_head_id=dept_head.id
    )
    db.add(lecturer)
    db.commit()
    return {"message": f"Lecturer {request.full_name} pre-registered with code {request.lecturer_code}"}


@app.post("/dept-head/courses", status_code=201)
def assign_course(
    request: AssignCourseRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("dept_head"))
):
    """Dept head assigns a course to a lecturer."""
    lecturer = db.query(Lecturer).filter(
        Lecturer.lecturer_code == request.lecturer_code,
        Lecturer.department == user.get("department")
    ).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found in your department")

    # Check if course already assigned to someone in this dept
    existing = db.query(Course).filter(
        Course.course_code == request.course_code,
        Course.department == user.get("department")
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Course {request.course_code} is already assigned to another lecturer"
        )

    course = Course(
        course_code=request.course_code,
        course_name=request.course_name,
        department=user.get("department"),
        lecturer_id=lecturer.id
    )
    db.add(course)
    db.commit()
    return {"message": f"Course {request.course_code} assigned to {lecturer.full_name}"}


@app.get("/dept-head/lecturers", response_model=List[LecturerResponse])
def list_lecturers(
    db: Session = Depends(get_db),
    user=Depends(require_role("dept_head"))
):
    """List all lecturers in this dept head's department."""
    lecturers = db.query(Lecturer).filter(
        Lecturer.department == user.get("department")
    ).all()
    return lecturers


@app.get("/dept-head/courses", response_model=List[CourseResponse])
def list_courses(
    db: Session = Depends(get_db),
    user=Depends(require_role("dept_head"))
):
    """List all courses in this dept head's department."""
    courses = db.query(Course).filter(
        Course.department == user.get("department")
    ).all()
    result = []
    for c in courses:
        result.append({
            "id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "department": c.department,
            "lecturer_code": c.lecturer.lecturer_code
        })
    return result


# ── LEDGER ROUTES ─────────────────────────────────────────────────────────────

@app.post("/ledger/entries", status_code=201)
def submit_entry(
    request: NewEntryRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("lecturer"))
):
    """
    Submit a new grade entry to the ledger.

    The server:
      1. Verifies the lecturer is authorized for this course
      2. Validates scores
      3. Calculates total and grade
      4. Derives the private key from the password to sign
      5. Computes the hash (chained to previous entry)
      6. Stores everything
    """
    lecturer = db.query(Lecturer).filter(
        Lecturer.id == int(user["sub"])
    ).first()

    # Check lecturer is assigned to this course
    course = db.query(Course).filter(
        Course.course_code == request.course_code,
        Course.lecturer_id == lecturer.id
    ).first()
    if not course:
        raise HTTPException(
            status_code=403,
            detail=f"You are not authorized to submit entries for {request.course_code}"
        )

    # Validate scores
    is_valid, error_msg = validate_scores(request.ca_score, request.exam_score)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Calculate total and grade server-side (never trust the client)
    total_score = request.ca_score + request.exam_score
    grade = calculate_grade(total_score)

    # Verify the password is correct before signing
    if not verify_password(request.password, lecturer.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Cannot sign entry.")

    # Get the current public key for this lecturer
    current_key = db.query(LecturerPublicKey).filter(
        LecturerPublicKey.lecturer_id == lecturer.id,
        LecturerPublicKey.is_current == True
    ).first()
    if not current_key:
        raise HTTPException(status_code=500, detail="No signing key found. Contact admin.")

    # Get the hash of the last entry (for chaining)
    last_entry = db.query(LedgerEntry).order_by(LedgerEntry.id.desc()).first()
    previous_hash = last_entry.entry_hash if last_entry else GENESIS_HASH

    submitted_at = datetime.now(timezone.utc).isoformat()

    # Build the data dictionary that will be signed and hashed
    entry_data = get_data_for_signing(
        registration_number=request.registration_number,
        course_code=request.course_code,
        department=request.department if hasattr(request, "department") and request.department else course.department,
        academic_session=request.academic_session,
        semester=request.semester,
        ca_score=request.ca_score,
        exam_score=request.exam_score,
        total_score=total_score,
        grade=grade,
        lecturer_code=lecturer.lecturer_code,
        entry_type="original",
        corrects_entry_id=None,
        submitted_at=submitted_at
    )

    # Sign the entry with the lecturer's derived private key
    signature = sign_entry(entry_data, request.password, lecturer.key_salt)

    # Compute the hash (includes previous hash for chaining)
    entry_hash = compute_entry_hash(entry_data, previous_hash)

    # Save to database
    new_entry = LedgerEntry(
        registration_number=request.registration_number,
        course_code=request.course_code,
        department=request.department if hasattr(request, "department") and request.department else course.department,
        academic_session=request.academic_session,
        semester=request.semester,
        ca_score=request.ca_score,
        exam_score=request.exam_score,
        total_score=total_score,
        grade=grade,
        lecturer_id=lecturer.id,
        lecturer_code=lecturer.lecturer_code,
        public_key_id=current_key.id,
        signature=signature,
        entry_hash=entry_hash,
        previous_hash=previous_hash,
        entry_type="original",
        corrects_entry_id=None,
        submitted_at=datetime.fromisoformat(submitted_at)
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return {"message": "Entry submitted and signed successfully", "entry_id": new_entry.id}


@app.post("/ledger/corrections", status_code=201)
def submit_correction(
    request: CorrectionEntryRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("lecturer"))
):
    """
    Submit a correction entry.
    The original entry is NOT modified — a new correction entry is added
    that references the original. The original gets flagged on the frontend.
    """
    lecturer = db.query(Lecturer).filter(
        Lecturer.id == int(user["sub"])
    ).first()

    # Find the entry being corrected
    original_entry = db.query(LedgerEntry).filter(
        LedgerEntry.id == request.corrects_entry_id
    ).first()
    if not original_entry:
        raise HTTPException(status_code=404, detail="Entry to correct not found")

    # Lecturers can only correct their own entries
    if original_entry.lecturer_id != lecturer.id:
        raise HTTPException(
            status_code=403,
            detail="You can only correct your own entries"
        )

    # Cannot correct an entry that is already a correction
    if original_entry.entry_type == "correction":
        raise HTTPException(
            status_code=400,
            detail="Cannot correct a correction entry. Correct the original instead."
        )

    # Cannot correct an entry that already has a correction
    existing_correction = db.query(LedgerEntry).filter(
        LedgerEntry.corrects_entry_id == request.corrects_entry_id
    ).first()
    if existing_correction:
        raise HTTPException(
            status_code=400,
            detail=f"Entry {request.corrects_entry_id} already has a correction (Entry {existing_correction.id})"
        )

    # Check course authorization
    course = db.query(Course).filter(
        Course.course_code == request.course_code,
        Course.lecturer_id == lecturer.id
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail=f"Not authorized for {request.course_code}")

    is_valid, error_msg = validate_scores(request.ca_score, request.exam_score)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    if not verify_password(request.password, lecturer.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Cannot sign entry.")

    total_score = request.ca_score + request.exam_score
    grade = calculate_grade(total_score)

    current_key = db.query(LecturerPublicKey).filter(
        LecturerPublicKey.lecturer_id == lecturer.id,
        LecturerPublicKey.is_current == True
    ).first()

    last_entry = db.query(LedgerEntry).order_by(LedgerEntry.id.desc()).first()
    previous_hash = last_entry.entry_hash if last_entry else GENESIS_HASH

    submitted_at = datetime.now(timezone.utc).isoformat()

    entry_data = get_data_for_signing(
        registration_number=request.registration_number,
        course_code=request.course_code,
        department=request.department if hasattr(request, "department") and request.department else course.department,
        academic_session=request.academic_session,
        semester=request.semester,
        ca_score=request.ca_score,
        exam_score=request.exam_score,
        total_score=total_score,
        grade=grade,
        lecturer_code=lecturer.lecturer_code,
        entry_type="correction",
        corrects_entry_id=request.corrects_entry_id,
        submitted_at=submitted_at
    )

    signature = sign_entry(entry_data, request.password, lecturer.key_salt)
    entry_hash = compute_entry_hash(entry_data, previous_hash)

    correction = LedgerEntry(
        registration_number=request.registration_number,
        course_code=request.course_code,
        department=request.department if hasattr(request, "department") and request.department else course.department,
        academic_session=request.academic_session,
        semester=request.semester,
        ca_score=request.ca_score,
        exam_score=request.exam_score,
        total_score=total_score,
        grade=grade,
        lecturer_id=lecturer.id,
        lecturer_code=lecturer.lecturer_code,
        public_key_id=current_key.id,
        signature=signature,
        entry_hash=entry_hash,
        previous_hash=previous_hash,
        entry_type="correction",
        corrects_entry_id=request.corrects_entry_id,
        submitted_at=datetime.fromisoformat(submitted_at)
    )
    db.add(correction)
    db.commit()
    db.refresh(correction)

    return {"message": "Correction submitted and signed successfully", "entry_id": correction.id}


@app.get("/ledger/entries", response_model=List[LedgerEntryResponse])
def get_entries(
    search: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[str] = None,
    course_code: Optional[str] = None,
    session: Optional[str] = None,
    sort_by: str = "id",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    """
    Public endpoint — no login required.
    Returns ledger entries with filtering, sorting, and pagination.
    This is what populates the main table on the frontend.
    """
    query = db.query(LedgerEntry)

    # Apply filters
    if search:
        query = query.filter(
            LedgerEntry.registration_number.ilike(f"%{search}%") |
            LedgerEntry.course_code.ilike(f"%{search}%") |
            LedgerEntry.department.ilike(f"%{search}%")
        )
    if department:
        query = query.filter(LedgerEntry.department == department)
    if semester:
        query = query.filter(LedgerEntry.semester == semester)
    if course_code:
        query = query.filter(LedgerEntry.course_code == course_code)
    if session:
        query = query.filter(LedgerEntry.academic_session == session)

    # Apply sorting
    sort_column = getattr(LedgerEntry, sort_by, LedgerEntry.id)
    if sort_dir == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    page_size = min(page_size, 200)  # Cap at 200
    offset = (page - 1) * page_size
    entries = query.offset(offset).limit(page_size).all()

    return entries


@app.get("/ledger/entries/count")
def get_entry_count(
    search: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns total count for pagination calculations."""
    query = db.query(LedgerEntry)
    if search:
        query = query.filter(
            LedgerEntry.registration_number.ilike(f"%{search}%") |
            LedgerEntry.course_code.ilike(f"%{search}%") |
            LedgerEntry.department.ilike(f"%{search}%")
        )
    if department:
        query = query.filter(LedgerEntry.department == department)
    if semester:
        query = query.filter(LedgerEntry.semester == semester)
    return {
        "total": query.count(),
        "corrections": db.query(LedgerEntry).filter(LedgerEntry.entry_type == "correction").count(),
        "pending": 0  # All entries are signed on submission; kept for future use
    }


# ── VERIFICATION ROUTE ────────────────────────────────────────────────────────

@app.get("/ledger/verify", response_model=VerificationResult)
def verify_ledger(db: Session = Depends(get_db)):
    """
    Verify the integrity of the entire ledger.
    Public endpoint — anyone can click Verify.

    Checks:
      1. Every entry's signature matches its stored public key
      2. Every entry's hash correctly chains to the previous entry
      3. No hashes have been tampered with

    Returns a detailed report including any failed entries.
    """
    entries = db.query(LedgerEntry).order_by(LedgerEntry.id.asc()).all()
    errors = []
    previous_hash = GENESIS_HASH

    for entry in entries:
        entry_data = get_data_for_signing(
            registration_number=entry.registration_number,
            course_code=entry.course_code,
            department=entry.department,
            academic_session=entry.academic_session,
            semester=entry.semester,
            ca_score=entry.ca_score,
            exam_score=entry.exam_score,
            total_score=entry.total_score,
            grade=entry.grade,
            lecturer_code=entry.lecturer_code,
            entry_type=entry.entry_type,
            corrects_entry_id=entry.corrects_entry_id,
            submitted_at=entry.submitted_at.replace(tzinfo=timezone.utc).isoformat()
        )

        # Check 1: Verify signature
        pub_key_record = db.query(LecturerPublicKey).filter(
            LecturerPublicKey.id == entry.public_key_id
        ).first()

        if not pub_key_record:
            errors.append({
                "entry_id": entry.id,
                "error_type": "MISSING_KEY",
                "description": f"Entry {entry.id}: Public key record not found"
            })
        else:
            sig_valid = verify_signature(entry_data, entry.signature, pub_key_record.public_key_pem)
            if not sig_valid:
                errors.append({
                    "entry_id": entry.id,
                    "error_type": "INVALID_SIGNATURE",
                    "description": f"Entry {entry.id}: Digital signature is invalid. Entry may have been tampered with."
                })

        # Check 2: Verify hash chain
        if entry.previous_hash != previous_hash:
            errors.append({
                "entry_id": entry.id,
                "error_type": "BROKEN_HASH_CHAIN",
                "description": f"Entry {entry.id}: Hash chain is broken. The previous hash does not match Entry {entry.id - 1}."
            })

        # Check 3: Verify the stored hash matches recomputed hash
        expected_hash = compute_entry_hash(entry_data, entry.previous_hash)
        if entry.entry_hash != expected_hash:
            errors.append({
                "entry_id": entry.id,
                "error_type": "HASH_MISMATCH",
                "description": f"Entry {entry.id}: Entry hash does not match its data. Content may have been altered."
            })

        previous_hash = entry.entry_hash

    is_valid = len(errors) == 0
    message = (
        f"All {len(entries)} entries verified successfully. Ledger integrity confirmed."
        if is_valid
        else f"Verification failed. {len(errors)} issue(s) found across {len(entries)} entries."
    )

    return VerificationResult(
        is_valid=is_valid,
        total_entries_checked=len(entries),
        errors=errors,
        message=message
    )



# ── FILTER OPTIONS ROUTES ─────────────────────────────────────────────────────

@app.get("/ledger/departments")
def get_departments(db: Session = Depends(get_db)):
    """
    Returns a sorted list of all unique departments currently in the ledger.
    Public endpoint — used to populate the All Departments dropdown.
    """
    results = db.query(LedgerEntry.department).distinct().all()
    departments = sorted([r[0] for r in results if r[0]])
    return {"departments": departments}


@app.get("/ledger/sessions")
def get_sessions(db: Session = Depends(get_db)):
    """
    Returns a sorted list of all unique academic sessions currently in the ledger.
    Public endpoint — used to populate the All Sessions dropdown.
    """
    results = db.query(LedgerEntry.academic_session).distinct().all()
    sessions = sorted([r[0] for r in results if r[0]], reverse=True)
    return {"sessions": sessions}


# ── LECTURER INFO ROUTES ──────────────────────────────────────────────────────

@app.get("/lecturer/my-courses", response_model=List[CourseResponse])
def my_courses(
    db: Session = Depends(get_db),
    user=Depends(require_role("lecturer"))
):
    """Returns the courses assigned to the currently logged-in lecturer."""
    courses = db.query(Course).filter(
        Course.lecturer_id == int(user["sub"])
    ).all()
    return [{"id": c.id, "course_code": c.course_code, "course_name": c.course_name,
             "department": c.department, "lecturer_code": user["lecturer_code"]} for c in courses]
