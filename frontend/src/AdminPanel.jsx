import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// ── Small reusable components ─────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box", background: "#fff", transition: "border-color 0.15s" }}
        onFocus={e => e.target.style.borderColor = "#2563eb"}
        onBlur={e => e.target.style.borderColor = "#e2e8f0"}
      />
    </div>
  );
}

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

// ── Create Dept Head Form ─────────────────────────────────────────────────────

function CreateDeptHeadForm({ token, onCreated }) {
  const [form, setForm] = useState({ username: "", password: "", full_name: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { success, message }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.username || !form.password || !form.full_name || !form.department) {
      setStatus({ success: false, message: "All fields are required." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await axios.post(`${API}/admin/dept-heads`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ success: true, message: `Department head "${form.full_name}" created successfully.` });
      setForm({ username: "", password: "", full_name: "", department: "" });
      onCreated(); // refresh the list
    } catch (err) {
      setStatus({ success: false, message: err.response?.data?.detail || "Failed to create department head." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <StatusBadge {...status} />
      <Field label="Full Name" value={form.full_name} onChange={v => set("full_name", v)} placeholder="e.g. Dr. Amaka Okonkwo" />
      <Field label="Department" value={form.department} onChange={v => set("department", v)} placeholder="e.g. Computer Science" />
      <Field label="Username" value={form.username} onChange={v => set("username", v)} placeholder="e.g. hod_cs" />
      <Field label="Password" value={form.password} onChange={v => set("password", v)} type="password" placeholder="Min. 8 characters" />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
          background: loading ? "#93c5fd" : "#2563eb", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
          marginTop: 4, transition: "background 0.15s"
        }}
      >
        {loading ? "Creating…" : "Create Department Head"}
      </button>
    </div>
  );
}

// ── Dept Head List ────────────────────────────────────────────────────────────

function DeptHeadList({ token, refreshTrigger }) {
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API}/admin/dept-heads`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHeads(res.data);
      } catch (err) {
        setError("Could not load department heads.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token, refreshTrigger]);

  if (loading) return <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>Loading…</div>;
  if (error) return <div style={{ fontSize: 13, color: "#dc2626", padding: "12px 0" }}>{error}</div>;
  if (heads.length === 0) return (
    <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
      No department heads yet. Create one above.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {heads.map(h => (
        <div key={h.id} style={{ padding: "11px 13px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{h.full_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{h.department}</div>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "3px 8px", borderRadius: 5, fontFamily: "monospace" }}>
              @{h.username}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────

export default function AdminPanel({ token, onClose }) {
  const [activeTab, setActiveTab] = useState("create");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreated = () => {
    setRefreshTrigger(t => t + 1);
    setActiveTab("list"); // switch to list so user sees the new entry
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 1100, transition: "opacity 0.2s" }}
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
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Admin Panel</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Manage department heads</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
            {[{ key: "create", label: "➕ Create New" }, { key: "list", label: "👥 View All" }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  background: activeTab === tab.key ? "#eff6ff" : "#f8fafc",
                  color: activeTab === tab.key ? "#2563eb" : "#64748b",
                  boxShadow: activeTab === tab.key ? "inset 0 0 0 1.5px #bfdbfe" : "none"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {activeTab === "create" && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                Create a department head account. They will be able to log in and manage lecturers within their department.
              </div>
              <CreateDeptHeadForm token={token} onCreated={handleCreated} />
            </>
          )}
          {activeTab === "list" && (
            <>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                All department heads currently registered in the system.
              </div>
              <DeptHeadList token={token} refreshTrigger={refreshTrigger} />
            </>
          )}
        </div>

        {/* Panel Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
            Grade Ledger · Admin Console
          </div>
        </div>
      </div>
    </>
  );
}
