import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// ── Reusable Field ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>{hint}</div>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box", background: "#fff", transition: "border-color 0.15s" }}
        onFocus={e => e.target.style.borderColor = "#7c3aed"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
    </div>
  );
}

// ── Status Banner ─────────────────────────────────────────────────────────────
function StatusBadge({ success, message }) {
  if (!message) return null;
  return (
    <div style={{
      padding: "9px 12px", borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500,
      background: success ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${success ? "#bbf7d0" : "#fecaca"}`,
      color: success ? "#15803d" : "#dc2626"
    }}>
      {success ? "✓ " : "✕ "}{message}
    </div>
  );
}

// ── Add Lecturer Form ─────────────────────────────────────────────────────────
function AddLecturerForm({ token, department, onCreated }) {
  const [form, setForm] = useState({ full_name: "", lecturer_code: "", department: department || "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.full_name || !form.lecturer_code) {
      setStatus({ success: false, message: "Full name and lecturer code are required." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await axios.post(`${API}/dept-head/lecturers`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ success: true, message: `Lecturer "${form.full_name}" added. They can now complete their signup using code: ${form.lecturer_code}` });
      setForm({ full_name: "", lecturer_code: "", department: department || "" });
      onCreated();
    } catch (err) {
      setStatus({ success: false, message: err.response?.data?.detail || "Failed to add lecturer." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <StatusBadge {...(status || {})} />
      <Field
        label="Full Name"
        value={form.full_name}
        onChange={v => set("full_name", v)}
        placeholder="e.g. Dr. Emeka Nwosu"
      />
      <Field
        label="Lecturer Code"
        value={form.lecturer_code}
        onChange={v => set("lecturer_code", v)}
        placeholder="e.g. LC-2024-001"
        hint="The lecturer will use this code to complete their signup."
      />
      <Field
        label="Department"
        value={form.department}
        onChange={v => set("department", v)}
        placeholder="e.g. Computer Science"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
          background: loading ? "#c4b5fd" : "#7c3aed", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
          marginTop: 4, transition: "background 0.15s"
        }}
      >
        {loading ? "Adding…" : "Add Lecturer"}
      </button>
    </div>
  );
}

// ── Assign Course Form ────────────────────────────────────────────────────────
function AssignCourseForm({ token, lecturers }) {
  const [form, setForm] = useState({ course_code: "", course_name: "", lecturer_code: "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.course_code || !form.lecturer_code) {
      setStatus({ success: false, message: "Course code and lecturer are required." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await axios.post(`${API}/dept-head/courses`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ success: true, message: `Course "${form.course_code}" assigned successfully.` });
      setForm({ course_code: "", course_name: "", lecturer_code: "" });
    } catch (err) {
      setStatus({ success: false, message: err.response?.data?.detail || "Failed to assign course." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <StatusBadge {...(status || {})} />
      <Field label="Course Code" value={form.course_code} onChange={v => set("course_code", v)} placeholder="e.g. COS301" />
      <Field label="Course Name" value={form.course_name} onChange={v => set("course_name", v)} placeholder="e.g. Data Structures (optional)" />
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Assign To Lecturer</label>
        <select
          value={form.lecturer_code}
          onChange={e => set("lecturer_code", e.target.value)}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: form.lecturer_code ? "#0f172a" : "#94a3b8", outline: "none", background: "#fff", boxSizing: "border-box" }}
        >
          <option value="">Select a lecturer…</option>
          {lecturers.map(l => (
            <option key={l.id} value={l.lecturer_code}>
              {l.full_name} ({l.lecturer_code})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
          background: loading ? "#c4b5fd" : "#7c3aed", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
          marginTop: 4
        }}
      >
        {loading ? "Assigning…" : "Assign Course"}
      </button>
    </div>
  );
}

// ── Lecturer List ─────────────────────────────────────────────────────────────
function LecturerList({ token, refreshTrigger }) {
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API}/dept-head/lecturers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLecturers(res.data);
      } catch (err) {
        setError("Could not load lecturers.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token, refreshTrigger]);

  if (loading) return <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>Loading…</div>;
  if (error) return <div style={{ fontSize: 13, color: "#dc2626", padding: "12px 0" }}>{error}</div>;
  if (lecturers.length === 0) return (
    <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
      No lecturers yet. Add one using the other tabs.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lecturers.map(l => (
        <div key={l.id} style={{ padding: "11px 13px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{l.full_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{l.department}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", padding: "3px 8px", borderRadius: 5, fontFamily: "monospace" }}>
                {l.lecturer_code}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                background: l.has_completed_signup ? "#f0fdf4" : "#fff7ed",
                color: l.has_completed_signup ? "#15803d" : "#c2410c",
                border: `1px solid ${l.has_completed_signup ? "#bbf7d0" : "#fed7aa"}`
              }}>
                {l.has_completed_signup ? "✓ Signed up" : "⏳ Pending signup"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dept Head Panel ──────────────────────────────────────────────────────
export default function DeptHeadPanel({ token, department, onClose }) {
  const [activeTab, setActiveTab] = useState("add");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lecturers, setLecturers] = useState([]);

  // Keep a shared lecturer list for the course assignment dropdown
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/dept-head/lecturers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLecturers(res.data);
      } catch (_) {}
    };
    fetch();
  }, [token, refreshTrigger]);

  const handleLecturerCreated = () => {
    setRefreshTrigger(t => t + 1);
    setActiveTab("list");
  };

  const tabs = [
    { key: "add", label: "➕ Add Lecturer" },
    { key: "course", label: "📚 Assign Course" },
    { key: "list", label: "👥 View Lecturers" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 1100 }}
      />

      {/* Slide-in Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 420,
        background: "#fff", zIndex: 1200, boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column", animation: "slideIn 0.25s ease"
      }}>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Panel Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Dept Head Panel</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{department || "Manage your lecturers & courses"}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  background: activeTab === tab.key ? "#f5f3ff" : "#f8fafc",
                  color: activeTab === tab.key ? "#7c3aed" : "#64748b",
                  boxShadow: activeTab === tab.key ? "inset 0 0 0 1.5px #ddd6fe" : "none"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {activeTab === "add" && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                Pre-register a lecturer by providing their name and assigning them a unique code. They will use this code to complete their own signup and set a password.
              </div>
              <AddLecturerForm token={token} department={department} onCreated={handleLecturerCreated} />
            </>
          )}
          {activeTab === "course" && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                Assign a course to one of your lecturers. They will only be able to submit grade entries for courses assigned to them.
              </div>
              {lecturers.length === 0 ? (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#c2410c" }}>
                  ⚠ You need to add at least one lecturer before assigning courses.
                </div>
              ) : (
                <AssignCourseForm token={token} lecturers={lecturers} />
              )}
            </>
          )}
          {activeTab === "list" && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                All lecturers in your department. Pending lecturers have not yet completed their signup.
              </div>
              <LecturerList token={token} refreshTrigger={refreshTrigger} />
            </>
          )}
        </div>

        {/* Panel Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
            Grade Ledger · Department Head Console
          </div>
        </div>
      </div>
    </>
  );
}
