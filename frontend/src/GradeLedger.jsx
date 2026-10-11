import React, { useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import AdminPanel from "./AdminPanel";
import DeptHeadPanel from "./DeptHeadPanel";

// ── API base URL — all requests go to the FastAPI backend ─────────────────────
const API = "http://127.0.0.1:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function calcGrade(total) {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  if (total >= 40) return "E";
  return "F";
}

// ── Verify Modal ──────────────────────────────────────────────────────────────
function VerifyModal({ onClose, totalEntries }) {
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runVerify = async () => {
    setVerifying(true);
    setError(null);

    // Animate progress bar while waiting for the API
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 90) { p = 90; clearInterval(iv); }
      setProgress(Math.min(p, 90));
    }, 120);

    try {
      const res = await axios.get(`${API}/ledger/verify`);
      clearInterval(iv);
      setProgress(100);
      setResult(res.data);
      setDone(true);
    } catch (err) {
      clearInterval(iv);
      setError("Could not connect to the server. Make sure the backend is running.");
      setVerifying(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Ledger Integrity Verification</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Checks all signatures and hash chains</div>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: 12, marginBottom: 14, fontSize: 13, color: "#dc2626" }}>{error}</div>
        )}

        {!verifying && !done && (
          <>
            <div style={{ background: "#f8fafc", borderRadius: 9, padding: 13, marginBottom: 16, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
              This will verify every entry by:<br />
              <span style={{ color: "#2563eb" }}>①</span> Checking each lecturer's digital signature<br />
              <span style={{ color: "#2563eb" }}>②</span> Verifying hash chain links<br />
              <span style={{ color: "#2563eb" }}>③</span> Flagging any tampered entries with entry number and cause
            </div>
            <button onClick={runVerify} style={{ width: "100%", padding: 11, background: "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Run Verification</button>
            <button onClick={onClose} style={{ width: "100%", marginTop: 7, padding: 9, background: "transparent", color: "#94a3b8", border: "none", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </>
        )}

        {verifying && !done && (
          <div style={{ textAlign: "center", padding: "6px 0 14px" }}>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>Verifying {totalEntries} entries…</div>
            <div style={{ background: "#f1f5f9", borderRadius: 99, height: 7, overflow: "hidden", marginBottom: 7 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#2563eb", borderRadius: 99, transition: "width 0.15s ease" }} />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{Math.floor(progress)}% complete</div>
          </div>
        )}

        {done && result && (
          <>
            {result.is_valid ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, padding: 13, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <svg width="15" height="15" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span style={{ fontWeight: 700, color: "#15803d", fontSize: 13 }}>All {result.total_entries_checked} entries verified</span>
                </div>
                <div style={{ fontSize: 12, color: "#166534" }}>Hash chain intact · All signatures valid · No tampering detected</div>
              </div>
            ) : (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: 13, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <svg width="15" height="15" fill="none" stroke="#dc2626" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span style={{ fontWeight: 700, color: "#dc2626", fontSize: 13 }}>Verification Failed — {result.errors.length} issue(s) found</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: "#dc2626" }}>Entry #{err.entry_id}</span>
                      <span style={{ color: "#6b7280", margin: "0 5px" }}>·</span>
                      <span style={{ color: "#374151" }}>{err.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onClose} style={{ width: "100%", padding: 10, background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Login Modal ───────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin }) {
  const [role, setRole] = useState("lecturer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Signup state (lecturer first-time signup)
  const [isSignup, setIsSignup] = useState(false);
  const [signupForm, setSignupForm] = useState({ full_name: "", lecturer_code: "", password: "", confirm_password: "" });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const setS = (k, v) => setSignupForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!username || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/auth/login`, { username, password, role });
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupForm.full_name || !signupForm.lecturer_code || !signupForm.password || !signupForm.confirm_password) {
      setSignupError("All fields are required."); return;
    }
    if (signupForm.password !== signupForm.confirm_password) {
      setSignupError("Passwords do not match."); return;
    }
    if (signupForm.password.length < 8) {
      setSignupError("Password must be at least 8 characters."); return;
    }
    setSignupLoading(true);
    setSignupError(null);
    try {
      await axios.post(`${API}/auth/signup/lecturer`, {
        full_name: signupForm.full_name,
        lecturer_code: signupForm.lecturer_code,
        password: signupForm.password,
        confirm_password: signupForm.confirm_password,
      });
      // After signup, log them in automatically
      const res = await axios.post(`${API}/auth/login`, {
        username: signupForm.lecturer_code,
        password: signupForm.password,
        role: "lecturer"
      });
      onLogin(res.data);
    } catch (err) {
      setSignupError(err.response?.data?.detail || "Signup failed. Check your details and try again.");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>

        {!isSignup ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 3 }}>Sign In</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Access the Grade Ledger system</div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#dc2626" }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
              {["lecturer", "dept_head", "admin"].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `2px solid ${role === r ? "#2563eb" : "#e2e8f0"}`, background: role === r ? "#eff6ff" : "#fff", color: role === r ? "#2563eb" : "#64748b", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                  {r === "dept_head" ? "Dept Head" : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 11 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                {role === "lecturer" ? "Lecturer Code" : "Username"}
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={role === "lecturer" ? "e.g. LC-2024-001" : "e.g. admin"}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                type="password"
                placeholder="••••••••"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Signup link — only shown for lecturer role */}
            {role === "lecturer" && (
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <span
                  onClick={() => { setIsSignup(true); setError(null); }}
                  style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}
                >
                  First time? Sign up here
                </span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{ width: "100%", padding: 10, background: loading ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", marginBottom: 7 }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <button onClick={onClose} style={{ width: "100%", padding: 8, background: "transparent", color: "#94a3b8", border: "none", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 3 }}>Lecturer Sign Up</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Set your password to activate your account</div>

            {signupError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#dc2626" }}>{signupError}</div>
            )}

            {[
              { label: "Full Name", key: "full_name", placeholder: "e.g. Dr. Emeka Nwosu", type: "text" },
              { label: "Lecturer Code", key: "lecturer_code", placeholder: "e.g. LC-2024-001 (assigned by dept head)", type: "text" },
              { label: "Password", key: "password", placeholder: "Min. 8 characters", type: "password" },
              { label: "Confirm Password", key: "confirm_password", placeholder: "Re-enter password", type: "password" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 11 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={signupForm[f.key]}
                  onChange={e => setS(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            <button
              onClick={handleSignup}
              disabled={signupLoading}
              style={{ width: "100%", padding: 10, background: signupLoading ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: signupLoading ? "not-allowed" : "pointer", marginBottom: 10, marginTop: 4 }}
            >
              {signupLoading ? "Creating account…" : "Create Account & Sign In"}
            </button>
            <div style={{ textAlign: "center" }}>
              <span
                onClick={() => { setIsSignup(false); setSignupError(null); }}
                style={{ fontSize: 12, color: "#64748b", textDecoration: "underline", cursor: "pointer" }}
              >
                ← Back to Sign In
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── New Entry Modal ───────────────────────────────────────────────────────────
function NewEntryModal({ onClose, onSubmit, token, deptOptions, sessionOptions }) {
  const [form, setForm] = useState({ regNo: "", courseCode: "", ca: "", exam: "", session: "", semester: "First", department: "" });
  const [customDept, setCustomDept] = useState("");
  const [customSession, setCustomSession] = useState("");
  const [deptError, setDeptError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ca = parseInt(form.ca) || 0;
  const exam = parseInt(form.exam) || 0;
  const total = ca + exam;
  const grade = (form.ca || form.exam) ? calcGrade(total) : "-";
  const caOver = form.ca !== "" && parseInt(form.ca) > 30;
  const examOver = form.exam !== "" && parseInt(form.exam) > 70;
  const effectiveDept = form.department === "__new__" ? customDept.trim() : form.department;
  const effectiveSession = form.session === "__new__" ? customSession.trim() : form.session;
  const valid = form.regNo && form.courseCode && form.ca !== "" && form.exam !== "" && !caOver && !examOver && password && effectiveDept && effectiveSession && !deptError && !sessionError;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${API}/ledger/entries`,
        {
          registration_number: form.regNo,
          course_code: form.courseCode,
          academic_session: effectiveSession,
          semester: form.semester,
          department: effectiveDept,
          ca_score: parseInt(form.ca),
          exam_score: parseInt(form.exam),
          password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSubmit(); // signals parent to refresh entries
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit entry. Check your password and try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 3 }}>New Ledger Entry</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Entry will be signed with your private key.</div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#dc2626" }}>{error}</div>
        )}

        {/* Department field */}
        <div style={{ marginBottom: 11 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Department</label>
          <select
            value={form.department}
            onChange={e => { set("department", e.target.value); setDeptError(""); setCustomDept(""); }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", color: form.department ? "#0f172a" : "#94a3b8", outline: "none", boxSizing: "border-box" }}
          >
            <option value="">Select department…</option>
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
            <option value="__new__">+ Add new department</option>
          </select>
          {form.department === "__new__" && (
            <div style={{ marginTop: 6 }}>
              <input
                value={customDept}
                onChange={e => {
                  const val = e.target.value;
                  setCustomDept(val);
                  if (val && /[0-9]/.test(val)) setDeptError('Department name must not contain numbers. e.g. Computer Science');
                  else if (val && !/^[a-zA-Z\s]+$/.test(val)) setDeptError('Department name must contain letters only. e.g. Physics');
                  else setDeptError("");
                }}
                placeholder="e.g. Physics"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${deptError ? "#dc2626" : "#e2e8f0"}`, fontSize: 13, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }}
              />
              {deptError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{deptError}</div>}
            </div>
          )}
        </div>

        {/* Academic Session field */}
        <div style={{ marginBottom: 11 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Academic Session</label>
          <select
            value={form.session}
            onChange={e => { set("session", e.target.value); setSessionError(""); setCustomSession(""); }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", color: form.session ? "#0f172a" : "#94a3b8", outline: "none", boxSizing: "border-box" }}
          >
            <option value="">Select session…</option>
            {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__new__">+ Add new session</option>
          </select>
          {form.session === "__new__" && (
            <div style={{ marginTop: 6 }}>
              <input
                value={customSession}
                onChange={e => {
                  const val = e.target.value;
                  setCustomSession(val);
                  if (val && !/^\d{4}\/\d{4}$/.test(val)) setSessionError('Session must follow the format YYYY/YYYY e.g. 2025/2026');
                  else setSessionError("");
                }}
                placeholder="e.g. 2025/2026"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${sessionError ? "#dc2626" : "#e2e8f0"}`, fontSize: 13, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }}
              />
              {sessionError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>{sessionError}</div>}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
          {[{ label: "Student Reg. No.", key: "regNo", placeholder: "21/SC/CO/001" }, { label: "Course Code", key: "courseCode", placeholder: "COS111" }].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>CA Score <span style={{ color: "#94a3b8", fontWeight: 400 }}>(max 30)</span></label>
            <input type="number" max={30} min={0} value={form.ca} onChange={e => set("ca", e.target.value)} placeholder="0–30" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${caOver ? "#dc2626" : "#e2e8f0"}`, fontSize: 13, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
            {caOver && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>Exceeds max of 30</div>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Exam Score <span style={{ color: "#94a3b8", fontWeight: 400 }}>(max 70)</span></label>
            <input type="number" max={70} min={0} value={form.exam} onChange={e => set("exam", e.target.value)} placeholder="0–70" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${examOver ? "#dc2626" : "#e2e8f0"}`, fontSize: 13, background: "#ffffff", color: "#0f172a", outline: "none", boxSizing: "border-box", WebkitTextFillColor: "#0f172a", WebkitBoxShadow: "0 0 0px 1000px #ffffff inset" }} />
            {examOver && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>Exceeds max of 70</div>}
          </div>
        </div>
        {(form.ca !== "" || form.exam !== "") && (
          <div style={{ background: "#f8fafc", borderRadius: 7, padding: "9px 13px", marginBottom: 11, display: "flex", gap: 18 }}>
            <span style={{ fontSize: 13, color: "#475569" }}>Total: <strong style={{ color: "#0f172a" }}>{total}</strong></span>
            <span style={{ fontSize: 13, color: "#475569" }}>Grade: <strong style={{ color: "#0f172a" }}>{grade}</strong></span>
          </div>
        )}
        <div style={{ marginBottom: 11 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Semester</label>
          <select value={form.semester} onChange={e => set("semester", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }}>
            <option>First</option><option>Second</option>
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
            Your Password <span style={{ color: "#94a3b8", fontWeight: 400 }}>(used to sign this entry)</span>
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#ffffff", color: "#0f172a", outline: "none", boxSizing: "border-box", WebkitBoxShadow: "0 0 0px 1000px #ffffff inset", WebkitTextFillColor: "#0f172a" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!valid || loading}
            style={{ flex: 2, padding: 10, background: "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: valid && !loading ? "pointer" : "not-allowed", opacity: valid && !loading ? 1 : 0.5 }}
          >
            {loading ? "Signing & Submitting…" : "Sign & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Correction Modal ──────────────────────────────────────────────────────────
function CorrectionModal({ entries, onClose, onSubmit, token }) {
  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ ca: "", exam: "" });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selected = entries.find(e => e.id === selectedId);
  const ca = parseInt(form.ca) || 0;
  const exam = parseInt(form.exam) || 0;
  const total = ca + exam;
  const grade = (form.ca || form.exam) ? calcGrade(total) : "-";

  const handleSubmit = async () => {
    if (!form.ca || !form.exam || !password || !selected) return;
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${API}/ledger/corrections`,
        {
          corrects_entry_id: selected.id,
          registration_number: selected.registration_number,
          course_code: selected.course_code,
          academic_session: selected.academic_session,
          semester: selected.semester,
          ca_score: parseInt(form.ca),
          exam_score: parseInt(form.exam),
          password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSubmit();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit correction.");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 3 }}>Append Correction</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Select the entry to correct, then provide corrected scores.</div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#dc2626" }}>{error}</div>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 7 }}>Select entry to correct:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
              {entries.filter(e => e.entry_type !== "correction").map(e => (
                <div key={e.id} onClick={() => setSelectedId(e.id)} style={{ padding: "9px 11px", borderRadius: 7, border: `2px solid ${selectedId === e.id ? "#2563eb" : "#e2e8f0"}`, background: selectedId === e.id ? "#eff6ff" : "#f8fafc", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>#{e.id} — {e.registration_number}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{e.course_code} · CA {e.ca_score} / Exam {e.exam_score}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => selectedId && setStep(2)} style={{ flex: 2, padding: 10, background: selectedId ? "#2563eb" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: selectedId ? "pointer" : "not-allowed" }}>Next →</button>
            </div>
          </>
        )}
        {step === 2 && selected && (
          <>
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 9, padding: 11, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", marginBottom: 3 }}>⚠ Correcting Entry #{selected.id}</div>
              <div style={{ fontSize: 13, color: "#7c3aed" }}>{selected.registration_number} · {selected.course_code}</div>
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>Original: CA {selected.ca_score} + Exam {selected.exam_score} = {selected.total_score} ({selected.grade})</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Corrected CA <span style={{ color: "#94a3b8", fontWeight: 400 }}>(max 30)</span></label>
                <input type="number" max={30} min={0} value={form.ca} onChange={e => set("ca", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Corrected Exam <span style={{ color: "#94a3b8", fontWeight: 400 }}>(max 70)</span></label>
                <input type="number" max={70} min={0} value={form.exam} onChange={e => set("exam", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            {(form.ca !== "" || form.exam !== "") && (
              <div style={{ background: "#f8fafc", borderRadius: 7, padding: "9px 13px", marginBottom: 11, display: "flex", gap: 18 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>New Total: <strong style={{ color: "#0f172a" }}>{total}</strong></span>
                <span style={{ fontSize: 13, color: "#475569" }}>New Grade: <strong style={{ color: "#0f172a" }}>{grade}</strong></span>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                Your Password <span style={{ color: "#94a3b8", fontWeight: 400 }}>(used to sign this correction)</span>
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#ffffff", color: "#0f172a", outline: "none", boxSizing: "border-box", WebkitBoxShadow: "0 0 0px 1000px #ffffff inset", WebkitTextFillColor: "#0f172a" }} />
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.ca || !form.exam || !password}
                style={{ flex: 2, padding: 10, background: (!loading && form.ca && form.exam && password) ? "#2563eb" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: (!loading && form.ca && form.exam && password) ? "pointer" : "not-allowed" }}
              >
                {loading ? "Signing & Submitting…" : "Sign & Submit Correction"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Expanded Row ──────────────────────────────────────────────────────────────
function ExpandedRow({ entry, allEntries }) {
  const correctedBy = allEntries.find(e => e.corrects_entry_id === entry.id);
  const corrects = entry.corrects_entry_id ? allEntries.find(e => e.id === entry.corrects_entry_id) : null;
  return (
    <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "14px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: (correctedBy || corrects) ? 12 : 0 }}>
        {[
          { label: "Department", value: entry.department },
          { label: "Academic Session", value: entry.academic_session },
          { label: "Semester", value: entry.semester + " Semester" },
          { label: "Entry Type", value: entry.entry_type === "correction" ? "Correction" : "Original" },
          { label: "Signature", value: "✓ Signed", color: "#16a34a" },
          { label: "Entry Hash", value: entry.entry_hash?.slice(0, 16) + "...", mono: true },
          { label: "Previous Hash", value: entry.previous_hash?.slice(0, 16) + "...", mono: true },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: f.color || "#0f172a", fontFamily: f.mono ? "monospace" : "inherit", fontWeight: f.color ? 600 : 400 }}>{f.value}</div>
          </div>
        ))}
      </div>
      {correctedBy && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: "7px 11px", marginTop: 8, fontSize: 12, color: "#92400e" }}>
          ⚠ This entry has been corrected by <strong>Entry #{correctedBy.id}</strong>
        </div>
      )}
      {corrects && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "7px 11px", marginTop: 8, fontSize: 12, color: "#1e40af" }}>
          ↩ This correction replaces <strong>Entry #{corrects.id}</strong> ({corrects.registration_number} · {corrects.course_code})
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GradeLedger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [showVerify, setShowVerify] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [user, setUser] = useState(null);   // { role, name, token, lecturer_code }
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showDeptPanel, setShowDeptPanel] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  // ── Fetch entries from backend ─────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterDept) params.department = filterDept;
      if (filterSession) params.session = filterSession;
      if (filterSemester) params.semester = filterSemester;
      params.sort_by = sortBy === "regNo" ? "registration_number"
        : sortBy === "courseCode" ? "course_code"
        : sortBy === "ca" ? "ca_score"
        : sortBy === "exam" ? "exam_score"
        : sortBy === "total" ? "total_score"
        : sortBy === "time" ? "submitted_at"
        : sortBy;
      params.sort_dir = sortDir;
      params.page = page;
      params.page_size = pageSize;

      const res = await axios.get(`${API}/ledger/entries`, { params });
      setEntries(res.data);
    } catch (err) {
      setFetchError("Could not load entries. Make sure the backend is running at http://127.0.0.1:8000");
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterSession, filterSemester, sortBy, sortDir, page, pageSize]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Fetch dynamic filter options ───────────────────────────────────────────
  const [deptOptions, setDeptOptions] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [dRes, sRes] = await Promise.all([
        axios.get(`${API}/ledger/departments`),
        axios.get(`${API}/ledger/sessions`)
      ]);
      setDeptOptions(dRes.data.departments);
      setSessionOptions(sRes.data.sessions);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // ── Computed values ────────────────────────────────────────────────────────
  const correctedIds = useMemo(() => new Set(entries.filter(e => e.corrects_entry_id).map(e => e.corrects_entry_id)), [entries]);
  const totalPages = Math.ceil(entries.length / pageSize) || 1;

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const handleLogin = (data) => {
    // data = { access_token, role, name, lecturer_code }
    setUser({ role: data.role, name: data.name, token: data.access_token, lecturer_code: data.lecturer_code, department: data.department });
    setShowLogin(false);
  };

  const handleLogout = () => { setUser(null); setShowAdminPanel(false); setShowDeptPanel(false); };

  const th = (sortable) => ({
    padding: "9px 13px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
    cursor: sortable ? "pointer" : "default", userSelect: "none",
    whiteSpace: "nowrap", background: "#f8fafc", borderBottom: "1px solid #e2e8f0"
  });
  const td = { padding: "7px 13px", fontSize: 13, color: "#475569" };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 27, height: 27, borderRadius: 7, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap" }}>Grade Ledger</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <button onClick={() => setShowVerify(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Verify
          </button>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {user.role === "admin" && (
                  <button onClick={() => setShowAdminPanel(true)} style={{ padding: "5px 9px", borderRadius: 6, border: "1.5px solid #1e40af", background: "#eff6ff", color: "#1e40af", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>⚙ Admin Panel</button>
                )}
                {user.role === "dept_head" && (
                  <button onClick={() => setShowDeptPanel(true)} style={{ padding: "5px 9px", borderRadius: 6, border: "1.5px solid #7c3aed", background: "#f5f3ff", color: "#7c3aed", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>👥 Dept Panel</button>
                )}
                {user.role === "lecturer" && (
                <>
                  <button onClick={() => setShowNewEntry(true)} style={{ padding: "5px 9px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ New</button>
                  <button onClick={() => setShowCorrection(true)} style={{ padding: "5px 9px", borderRadius: 6, border: "1.5px solid #f97316", background: "#fff7ed", color: "#ea580c", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>↩ Fix</button>
                </>
              )}
              <div style={{ padding: "4px 8px", borderRadius: 6, background: "#f1f5f9", fontSize: 11, color: "#475569", fontWeight: 600, whiteSpace: "nowrap", maxWidth: 85, overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <button onClick={handleLogout} style={{ padding: "4px 7px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>Out</button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} style={{ padding: "5px 11px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Sign In</button>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "18px 14px" }}>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
            <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search reg no., course, department…" style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
          </div>
          <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }} style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff", color: "#0f172a", outline: "none" }}>
            <option value="">All Departments</option>
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterSession} onChange={e => { setFilterSession(e.target.value); setPage(1); }} style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff", color: "#0f172a", outline: "none" }}>
            <option value="">All Sessions</option>
            {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setPage(1); }} style={{ padding: "8px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff", color: "#0f172a", outline: "none" }}>
            <option value="">All Semesters</option>
            <option>First</option>
            <option>Second</option>
          </select>
          <button onClick={fetchEntries} style={{ padding: "8px 12px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Refresh</button>
        </div>

        {/* Error banner */}
        {fetchError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#dc2626" }}>{fetchError}</div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 11, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th(false), padding: "9px 8px 9px 13px", width: 22 }}></th>
                  <th style={th(false)}>Entry No.</th>
                  {[
                    { label: "Reg No.", col: "regNo" },
                    { label: "Course Code", col: "courseCode" },
                    { label: "CA Score", col: "ca" },
                    { label: "Exam Score", col: "exam" },
                    { label: "Total", col: "total" },
                    { label: "Grade", col: "grade" },
                    { label: "Lecturer", col: "lecturer_code" },
                    { label: "Time of Entry", col: "time" },
                  ].map(h => (
                    <th key={h.col} style={th(true)} onClick={() => handleSort(h.col)}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ padding: 36, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading entries…</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 36, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No entries found.</td></tr>
                ) : entries.map(entry => {
                  const isFlagged = correctedIds.has(entry.id);
                  const isCorrection = entry.entry_type === "correction";
                  const isExpanded = expandedId === entry.id;
                  const rowBg = isExpanded ? "#f0f6ff" : isFlagged ? "#fffbeb" : isCorrection ? "#f0fdf4" : "#fff";

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: rowBg, transition: "background 0.1s" }}
                      >
                        <td style={{ padding: "7px 8px 7px 13px", width: 22 }}>
                          {isFlagged
                            ? <span style={{ fontSize: 12 }}>⚠️</span>
                            : isCorrection
                              ? <span style={{ fontSize: 11, color: "#94a3b8" }}>↩</span>
                              : <svg width="10" height="10" fill="none" stroke="#cbd5e1" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "block" }}><path d="M9 18l6-6-6-6" /></svg>
                          }
                        </td>
                        <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{entry.id}</td>
                        <td style={td}>{entry.registration_number}</td>
                        <td style={td}>{entry.course_code}</td>
                        <td style={{ ...td, textAlign: "center" }}>{entry.ca_score}</td>
                        <td style={{ ...td, textAlign: "center" }}>{entry.exam_score}</td>
                        <td style={{ ...td, textAlign: "center" }}>{entry.total_score}</td>
                        <td style={td}>{entry.grade}</td>
                        <td style={td}>{entry.lecturer_code}</td>
                        <td style={{ ...td, fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{formatTime(entry.submitted_at)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} style={{ padding: 0 }}>
                            <ExpandedRow entry={entry} allEntries={entries} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: "9px 13px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                <span style={{ color: "#475569" }}>{entries.length} entries loaded</span>
                <span style={{ margin: "0 4px", color: "#e2e8f0" }}>|</span>
                <span style={{ color: "#d97706" }}>{entries.filter(e => e.entry_type === "correction").length} corrections</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Per page:</span>
                {[50, 100, 200].map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setPage(1); }} style={{ padding: "2px 6px", borderRadius: 4, border: `1.5px solid ${pageSize === n ? "#2563eb" : "#e2e8f0"}`, background: pageSize === n ? "#eff6ff" : "#fff", color: pageSize === n ? "#2563eb" : "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{n}</button>
                ))}
                <div style={{ width: 1, height: 12, background: "#e2e8f0", margin: "0 2px" }} />
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "2px 8px", borderRadius: 4, border: "1.5px solid #e2e8f0", background: page === 1 ? "#f8fafc" : "#fff", color: page === 1 ? "#cbd5e1" : "#475569", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", fontWeight: 600 }}>←</button>
                <span style={{ fontSize: 11, color: "#475569" }}>{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "2px 8px", borderRadius: 4, border: "1.5px solid #e2e8f0", background: page >= totalPages ? "#f8fafc" : "#fff", color: page >= totalPages ? "#cbd5e1" : "#475569", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", fontWeight: 600 }}>→</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
              {[{ icon: "⚠️", label: "Original entry corrected" }, { icon: "↩", label: "Correction entry" }, { icon: "🟡", label: "Flagged row" }, { icon: "🟢", label: "Correction row" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#94a3b8" }}>
                  <span style={{ fontSize: 9 }}>{l.icon}</span>{l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeptPanel && user?.role === "dept_head" && (
        <DeptHeadPanel token={user.token} department={user.department} onClose={() => setShowDeptPanel(false)} />
      )}
      {showAdminPanel && user?.role === "admin" && (
        <AdminPanel token={user.token} onClose={() => setShowAdminPanel(false)} />
      )}
      {showVerify && <VerifyModal onClose={() => setShowVerify(false)} totalEntries={entries.length} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      {showNewEntry && user?.role === "lecturer" && (
        <NewEntryModal
          onClose={() => setShowNewEntry(false)}
          onSubmit={() => { setShowNewEntry(false); fetchEntries(); fetchFilterOptions(); }}
          token={user.token}
          deptOptions={deptOptions}
          sessionOptions={sessionOptions}
        />
      )}
      {showCorrection && user?.role === "lecturer" && (
        <CorrectionModal
          entries={entries}
          onClose={() => setShowCorrection(false)}
          onSubmit={() => { setShowCorrection(false); fetchEntries(); }}
          token={user.token}
        />
      )}
    </div>
  );
}
