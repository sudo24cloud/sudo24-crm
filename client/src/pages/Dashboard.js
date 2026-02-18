// Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { api, user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);

  // ✅ server stats (today)
  const [todayStats, setTodayStats] = useState(null);
  const [msg, setMsg] = useState("");

  const loadAll = async () => {
    setMsg("");
    try {
      const [leadsRes, actRes, statsRes] = await Promise.all([
        api.get("/api/leads"),
        api.get("/api/activity"),
        api.get("/api/stats/today")
      ]);

      setLeads(leadsRes.data || []);
      setActivities(actRes.data || []);
      setTodayStats(statsRes.data || null);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error loading dashboard");
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const stats = useMemo(() => {
    const total = leads.length;

    const byStatus = leads.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    const todayFollowups = leads.filter((l) => {
      if (!l.nextFollowUp) return false;
      const d = new Date(l.nextFollowUp);
      return d.toDateString() === today.toDateString();
    }).length;

    return { total, byStatus, todayFollowups };
  }, [leads]);

  return (
    <div
      className="dash-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 16,
        alignItems: "start"
      }}
    >
      {/* ✅ LEFT: MAIN */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <button onClick={loadAll} style={{ marginLeft: "auto" }}>
            Refresh
          </button>
        </div>

        {msg ? (
          <div style={{ marginTop: 10, padding: 12, background: "#f5f5f5", borderRadius: 12 }}>
            {msg}
          </div>
        ) : null}

        {/* ✅ NEW: cards */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          <Card
            title="Today New Leads"
            value={todayStats?.todayNewLeads ?? "-"}
            hint={todayStats?.dateKey ? `Date: ${todayStats.dateKey}` : ""}
          />
          <Card title="Today Follow-ups" value={todayStats?.todayFollowups ?? "-"} />
          <Card title="Pending Follow-ups" value={todayStats?.pendingFollowups ?? "-"} />
          <Card title="Logged in as" value={`${user?.name || "-"} (${user?.role || "-"})`} small />
        </div>

        {/* Existing stats */}
        <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Card title="Total Leads" value={stats.total} />
          <Card title="Today Follow-ups (local)" value={stats.todayFollowups} />
          <Card title="Won" value={stats.byStatus.won || 0} />
          <Card title="Lost" value={stats.byStatus.lost || 0} />
        </div>

        {/* ✅ Activity Feed */}
        <div
          style={{
            marginTop: 24,
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 16
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800 }}>Activity Feed</div>
            <div style={{ color: "#666", fontSize: 12 }}>Latest 20</div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {activities.length === 0 ? (
              <div style={{ color: "#666" }}>No activity yet.</div>
            ) : (
              activities.slice(0, 20).map((a) => (
                <div
                  key={a._id}
                  style={{
                    padding: 12,
                    background: "#f7f7f7",
                    borderRadius: 12,
                    border: "1px solid #eee"
                  }}
                >
                  <div style={{ fontSize: 12, color: "#666" }}>{new Date(a.createdAt).toLocaleString()}</div>
                  <div style={{ marginTop: 4 }}>
                    <b>{a.actorId?.name || "User"}</b> — {formatAction(a)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ✅ RIGHT: ID CARD + DOWNLOAD */}
      <div style={{ position: "sticky", top: 12 }}>
        <EmployeeIdCard user={user} />
      </div>

      {/* ✅ Responsive */}
      <style>{`
        @media (max-width: 980px){
          .dash-grid{
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================
   ✅ Employee ID Card
========================= */
function EmployeeIdCard({ user }) {
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const safeUser = user || {};

  // ✅ Photo field mapping (add more if needed)
  const photo =
    safeUser.photoUrl ||
    safeUser.avatar ||
    safeUser.profilePic ||
    safeUser.photo ||
    "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(safeUser.name || "User") +
      "&background=111827&color=fff&size=512";

  const id = safeUser.employeeId || safeUser.empId || safeUser._id || "-";
  const company = safeUser.companyName || "SUDO24 CRM";
  const role = safeUser.role || "employee";

  const downloadCard = async () => {
    try {
      setDownloading(true);

      const node = cardRef.current;
      if (!node) return;

      const canvas = await html2canvas(node, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `ID-Card-${(safeUser.name || "User").replace(/\s+/g, "_")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ✅ CARD */}
      <div
        ref={cardRef}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,.08)"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 14,
            background: "linear-gradient(135deg,#111827,#1f2937)",
            color: "#fff"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, letterSpacing: 0.4 }}>EMPLOYEE ID CARD</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{company}</div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, opacity: 0.85 }}>ID</div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>
                {String(id).length > 12 ? String(id).slice(0, 12) + "…" : String(id)}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Photo */}
            <div
              style={{
                width: 92,
                height: 118,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                background: "#f3f4f6",
                flex: "0 0 auto"
              }}
            >
              <img
                src={photo}
                alt="employee"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.currentTarget.src =
                    "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(safeUser.name || "User") +
                    "&background=111827&color=fff&size=512";
                }}
              />
            </div>

            {/* Name + role */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {safeUser.name || "-"}
              </div>

              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge text={role} />
                {safeUser.status ? <Badge text={safeUser.status} soft /> : null}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Valid: {new Date().getFullYear()} – {new Date().getFullYear() + 1}
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: "grid", gap: 8 }}>
            <InfoRow label="Employee ID" value={id} />
            <InfoRow label="Email" value={safeUser.email || "-"} />
            <InfoRow label="Phone" value={safeUser.phone || "-"} />
            <InfoRow label="Department" value={safeUser.department || "-"} />
            <InfoRow label="City" value={safeUser.city || "-"} />
          </div>

          {/* Footer strip */}
          <div
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 14,
              background: "#f9fafb",
              border: "1px dashed #e5e7eb",
              fontSize: 12,
              color: "#374151"
            }}
          >
            If found, please return to <b>{company}</b>.
          </div>
        </div>
      </div>

      {/* ✅ Download */}
      <button
        onClick={downloadCard}
        disabled={downloading}
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "12px 14px",
          borderRadius: 14,
          border: "1px solid #111827",
          background: "#111827",
          color: "#fff",
          fontWeight: 800,
          cursor: downloading ? "not-allowed" : "pointer",
          opacity: downloading ? 0.85 : 1
        }}
      >
        {downloading ? "Downloading..." : "Download ID Card (PNG)"}
      </button>

      <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 360 }}>
        Note: For best quality, make sure user photo URL is public or served from your backend with proper CORS.
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#111827",
          textAlign: "right",
          maxWidth: 210,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
        title={String(value || "")}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function Badge({ text, soft }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "6px 10px",
        borderRadius: 999,
        border: soft ? "1px solid #e5e7eb" : "1px solid #111827",
        background: soft ? "#f9fafb" : "#111827",
        color: soft ? "#111827" : "#fff",
        textTransform: "capitalize"
      }}
    >
      {text}
    </span>
  );
}

/* =========================
   ✅ Existing Card
========================= */
function Card({ title, value, hint, small }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 14,
        background: "#fff"
      }}
    >
      <div style={{ color: "#666", fontSize: 13 }}>{title}</div>

      <div style={{ fontSize: small ? 16 : 28, fontWeight: 800, marginTop: 6 }}>
        {value}
      </div>

      {hint ? <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>{hint}</div> : null}
    </div>
  );
}

// ✅ Human readable activity messages
function formatAction(a) {
  switch (a.action) {
    case "lead_created":
      return `created lead "${a.meta?.name || ""}"`;
    case "status_changed":
      return `changed status from "${a.meta?.from}" to "${a.meta?.to}"`;
    case "note_added":
      return `added note`;
    case "assigned":
      return `assigned lead`;
    default:
      return a.action;
  }
}
