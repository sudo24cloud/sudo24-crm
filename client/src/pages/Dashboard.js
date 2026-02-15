import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { api, user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);

  // ✅ NEW: server stats (today)
  const [todayStats, setTodayStats] = useState(null);
  const [msg, setMsg] = useState("");

  const loadAll = async () => {
    setMsg("");
    try {
      const [leadsRes, actRes, statsRes] = await Promise.all([
        api.get("/api/leads"),
        api.get("/api/activity"),
        api.get("/api/stats/today") // ✅ NEW
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
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button onClick={loadAll} style={{ marginLeft: "auto" }}>Refresh</button>
      </div>

      {msg ? (
        <div style={{ marginTop: 10, padding: 12, background: "#f5f5f5", borderRadius: 12 }}>
          {msg}
        </div>
      ) : null}

      {/* ✅ NEW: Employee-friendly cards */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12
        }}
      >
        <Card title="Today New Leads" value={todayStats?.todayNewLeads ?? "-"} hint={todayStats?.dateKey ? `Date: ${todayStats.dateKey}` : ""} />
        <Card title="Today Follow-ups" value={todayStats?.todayFollowups ?? "-"} />
        <Card title="Pending Follow-ups" value={todayStats?.pendingFollowups ?? "-"} />
        <Card title="Logged in as" value={`${user?.name || "-"} (${user?.role || "-"})`} small />
      </div>

      {/* Existing Stats Cards (keep) */}
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
                <div style={{ fontSize: 12, color: "#666" }}>
                  {new Date(a.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 4 }}>
                  <b>{a.actorId?.name || "User"}</b> — {formatAction(a)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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

      {hint ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>{hint}</div>
      ) : null}
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
