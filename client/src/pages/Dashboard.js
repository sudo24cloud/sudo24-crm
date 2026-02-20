// client/src/pages/Dashboard.jsx
// ✅ SINGLE FILE (paste full) — no missing parts, no duplicate components
// ✅ Works even if backend APIs are not ready (auto-fallback demo data)
// ✅ Full width + responsive + long dashboard + lots of clickable UI
// ✅ SVG charts (no chart library) + html2canvas ID card download

import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "../auth/AuthContext";

/* =========================
   RBAC (UI-level only)
========================= */
const PERMS = {
  overview: ["superadmin", "admin", "manager", "employee"],
  myDay: ["superadmin", "admin", "manager", "employee"],
  myTasks: ["superadmin", "admin", "manager", "employee"],
  callCenter: ["superadmin", "admin", "manager", "employee"],
  teamPerformance: ["superadmin", "admin", "manager", "employee"],
  pipeline: ["superadmin", "admin", "manager"],
  reports: ["superadmin", "admin", "manager"],
  automation: ["superadmin", "admin"],
  settings: ["superadmin", "admin"]
};

function roleNorm(r) {
  return String(r || "employee").toLowerCase();
}
function canAccess(role, key) {
  return (PERMS[key] || []).includes(roleNorm(role));
}

const TABS = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "myDay", label: "My Day", icon: "🗓️" },
  { key: "myTasks", label: "My Tasks", icon: "✅" },
  { key: "callCenter", label: "Call Center", icon: "📞" },
  { key: "teamPerformance", label: "Team Performance", icon: "🏆" },
  { key: "pipeline", label: "Pipeline", icon: "🧩" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "automation", label: "Automation", icon: "⚡" },
  { key: "settings", label: "Settings", icon: "⚙️" }
];

/* =========================
   Demo fallback data
========================= */
function demoLeads() {
  const statuses = ["new", "contacted", "demo", "won", "lost"];
  const cities = ["Delhi", "Bareilly", "Lucknow", "Noida", "Gurgaon", "Jaipur"];
  const names = ["Aditi", "Rohan", "Sana", "Imran", "Kiran", "Neha", "Rahul", "Sahil", "Mehak", "Arjun"];
  const now = Date.now();

  return Array.from({ length: 28 }).map((_, i) => {
    const st = statuses[i % statuses.length];
    const next = new Date(now + ((i % 8) - 2) * 24 * 3600 * 1000 + (i % 6) * 3600 * 1000);
    return {
      _id: `demo-lead-${i + 1}`,
      name: `${names[i % names.length]} ${i + 1}`,
      phone: `9${String(100000000 + i * 123456).slice(0, 9)}`,
      email: `lead${i + 1}@example.com`,
      city: cities[i % cities.length],
      status: st,
      nextFollowUp: st === "won" || st === "lost" ? null : next.toISOString(),
      createdAt: new Date(now - (i % 12) * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now - (i % 6) * 12 * 3600 * 1000).toISOString()
    };
  });
}

function demoActivities() {
  const actions = ["created_lead", "called", "whatsapp", "note_added", "demo_scheduled", "status_changed"];
  const now = Date.now();
  return Array.from({ length: 22 }).map((_, i) => ({
    _id: `demo-act-${i + 1}`,
    action: actions[i % actions.length],
    createdAt: new Date(now - i * 6 * 3600 * 1000).toISOString(),
    actorId: { name: i % 2 === 0 ? "You" : "Team" },
    leadId: { name: `Lead ${i + 1}` },
    note: i % 3 === 0 ? "Follow-up done" : i % 3 === 1 ? "Shared details" : "Next call planned"
  }));
}

function demoTeamPerf() {
  const people = [
    { _id: "u1", name: "Aditi", email: "aditi@sudo24.com", role: "employee" },
    { _id: "u2", name: "Rohan", email: "rohan@sudo24.com", role: "employee" },
    { _id: "u3", name: "Sana", email: "sana@sudo24.com", role: "manager" },
    { _id: "u4", name: "Imran", email: "imran@sudo24.com", role: "employee" },
    { _id: "u5", name: "Neha", email: "neha@sudo24.com", role: "employee" }
  ];
  return people.map((p, i) => {
    const revenue = (5 - i) * 185000 + i * 42000;
    const won = 14 - i * 2;
    const lost = 6 + i;
    const conv = safePct(won, won + lost);
    return {
      ...p,
      revenue,
      wonCount: won,
      lostCount: lost,
      conversionRate: conv,
      avgDeal: Math.round(revenue / Math.max(1, won)),
      activitiesCount: 35 - i * 3
    };
  });
}

/* =========================
   Dashboard
========================= */
export default function Dashboard() {
  const { api, user } = useAuth();
  const role = roleNorm(user?.role);

  const allowedTabs = useMemo(() => TABS.filter((t) => canAccess(role, t.key)), [role]);
  const [tab, setTab] = useState(() => allowedTabs[0]?.key || "overview");

  // keep tab valid if role changes
  useEffect(() => {
    if (!allowedTabs.find((t) => t.key === tab)) setTab(allowedTabs[0]?.key || "overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // UI prefs
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [density, setDensity] = useState("comfortable"); // comfortable | compact | ultra
  const [accent, setAccent] = useState("indigo"); // indigo | emerald | amber | rose
  const [focusMode, setFocusMode] = useState(false);

  // data
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [todayStats, setTodayStats] = useState(null);

  // filters
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // team performance
  const [users, setUsers] = useState([]);
  const [teamPerf, setTeamPerf] = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfMsg, setPerfMsg] = useState("");
  const [perfFrom, setPerfFrom] = useState(() => toInputDate(getNDaysAgo(30)));
  const [perfTo, setPerfTo] = useState(() => toInputDate(new Date()));
  const [perfEmployeeId, setPerfEmployeeId] = useState("all");
  const [perfSort, setPerfSort] = useState("revenue_desc");
  const [perfSearch, setPerfSearch] = useState("");
  const [perfMinRevenue, setPerfMinRevenue] = useState("");
  const [perfMaxRevenue, setPerfMaxRevenue] = useState("");

  // overview toggles
  const [showWidgets, setShowWidgets] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [showOps, setShowOps] = useState(true);

  // My Day note
  const [quickNote, setQuickNote] = useState(() => {
    try {
      return localStorage.getItem("dash_quickNote") || "";
    } catch {
      return "";
    }
  });

  // toast
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const showToast = (t) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  /* =========================
     LOADERS (with fallback demo)
  ========================= */
  const loadAll = async () => {
    setMsg("");
    setLoading(true);
    try {
      // TODO BACKEND:
      // GET /api/leads
      // GET /api/activity
      // GET /api/stats/today -> {todayNewLeads, todayFollowups, pendingFollowups, dateKey}
      const [leadsRes, actRes, statsRes] = await Promise.all([
        api.get("/api/leads"),
        api.get("/api/activity"),
        api.get("/api/stats/today")
      ]);
      setLeads(leadsRes.data || []);
      setActivities(actRes.data || []);
      setTodayStats(statsRes.data || null);
    } catch (e) {
      // fallback demo so UI ALWAYS renders
      setLeads(demoLeads());
      setActivities(demoActivities());
      setTodayStats({
        todayNewLeads: 7,
        todayFollowups: 12,
        pendingFollowups: 19,
        dateKey: toInputDate(new Date())
      });
      setMsg(
        e?.response?.data?.message ||
          "Backend endpoints not available yet — showing DEMO data (UI working ✅)."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // TODO BACKEND: GET /api/users -> [{_id,name,role,email,employeeId}]
      const res = await api.get("/api/users");
      setUsers(res.data || []);
    } catch {
      setUsers(
        (demoTeamPerf() || []).map((x) => ({
          _id: x._id,
          name: x.name,
          role: x.role,
          email: x.email,
          employeeId: `EMP-${x._id.toUpperCase()}`
        }))
      );
    }
  };

  const loadTeamPerformance = async () => {
    setPerfMsg("");
    setPerfLoading(true);
    try {
      // TODO BACKEND:
      // GET /api/performance/team?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=all
      const params = new URLSearchParams();
      params.set("from", perfFrom || "");
      params.set("to", perfTo || "");
      params.set("employeeId", perfEmployeeId || "all");
      const res = await api.get(`/api/performance/team?${params.toString()}`);
      setTeamPerf(res.data || []);
    } catch (e) {
      setTeamPerf(demoTeamPerf());
      setPerfMsg(
        e?.response?.data?.message ||
          "Team performance API not ready — showing DEMO leaderboard (UI working ✅)."
      );
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (tab === "teamPerformance") loadTeamPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* =========================
     DERIVED (stats + graphs)
  ========================= */
  const stats = useMemo(() => {
    const total = leads.length;

    const byStatus = leads.reduce((acc, l) => {
      const s = l.status || "new";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const won = byStatus.won || 0;
    const lost = byStatus.lost || 0;
    const contacted = byStatus.contacted || 0;
    const demo = byStatus.demo || 0;
    const inPipe = total - won - lost;
    const winRate = safePct(won, Math.max(1, won + lost));

    const today = new Date();
    const todayFollowups = leads.filter((l) => {
      if (!l.nextFollowUp) return false;
      const d = new Date(l.nextFollowUp);
      return d.toDateString() === today.toDateString();
    }).length;

    const now = Date.now();
    const hotLeads = leads.filter((l) => {
      const s = l.status || "new";
      if (!(s === "demo" || s === "contacted")) return false;
      if (!l.nextFollowUp) return false;
      const t = new Date(l.nextFollowUp).getTime();
      return Number.isFinite(t) && t - now <= 48 * 3600 * 1000;
    }).length;

    const overdue = leads.filter((l) => {
      if (!l.nextFollowUp) return false;
      const dt = new Date(l.nextFollowUp);
      if (Number.isNaN(dt.getTime())) return false;
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return dt < startToday;
    }).length;

    return { total, byStatus, won, lost, contacted, demo, inPipe, winRate, todayFollowups, hotLeads, overdue };
  }, [leads]);

  const filteredLeadsPreview = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    const s = statusFilter;
    let arr = [...leads];

    if (s !== "all") arr = arr.filter((l) => String(l.status || "new") === s);

    if (q) {
      arr = arr.filter((l) => {
        const name = String(l.name || "").toLowerCase();
        const phone = String(l.phone || "").toLowerCase();
        const email = String(l.email || "").toLowerCase();
        const city = String(l.city || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || city.includes(q);
      });
    }

    arr.sort((a, b) => {
      const ta = a.nextFollowUp ? new Date(a.nextFollowUp).getTime() : Infinity;
      const tb = b.nextFollowUp ? new Date(b.nextFollowUp).getTime() : Infinity;
      return ta - tb;
    });

    return arr.slice(0, 12);
  }, [leads, globalSearch, statusFilter]);

  const callQueue = useMemo(() => {
    const now = Date.now();
    const arr = (leads || []).map((l) => {
      const next = l.nextFollowUp ? new Date(l.nextFollowUp).getTime() : null;
      const nextInHrs = next ? (next - now) / 3600000 : null;
      const scoreBase =
        (l.status === "demo" ? 50 : l.status === "contacted" ? 35 : l.status === "new" ? 25 : 10) +
        (nextInHrs !== null ? (nextInHrs < 0 ? 40 : nextInHrs <= 6 ? 30 : nextInHrs <= 24 ? 15 : 5) : 0);
      return { ...l, _score: scoreBase, _next: next };
    });

    arr.sort((a, b) => b._score - a._score);
    return arr.slice(0, 15);
  }, [leads]);

  const activityTrend = useMemo(() => {
    const days = 14;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toInputDate(d);
      map[key] = 0;
    }
    for (const a of activities || []) {
      const dt = new Date(a.createdAt || a.updatedAt || Date.now());
      const key = toInputDate(dt);
      if (key in map) map[key] += 1;
    }
    return Object.entries(map).map(([k, v]) => ({ x: k.slice(5), y: v }));
  }, [activities]);

  const leadsTrend = useMemo(() => {
    const days = 14;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toInputDate(d);
      map[key] = 0;
    }
    for (const l of leads || []) {
      const dt = new Date(l.createdAt || Date.now());
      const key = toInputDate(dt);
      if (key in map) map[key] += 1;
    }
    return Object.entries(map).map(([k, v]) => ({ x: k.slice(5), y: v }));
  }, [leads]);

  const statusSegments = useMemo(() => {
    const total = Math.max(1, stats.total);
    const items = [
      { key: "new", label: "New", value: stats.byStatus.new || 0 },
      { key: "contacted", label: "Contacted", value: stats.byStatus.contacted || 0 },
      { key: "demo", label: "Demo", value: stats.byStatus.demo || 0 },
      { key: "won", label: "Won", value: stats.byStatus.won || 0 },
      { key: "lost", label: "Lost", value: stats.byStatus.lost || 0 }
    ];
    return items.map((it) => ({ ...it, pct: Math.round((it.value / total) * 100) }));
  }, [stats]);

  const filteredTeamPerf = useMemo(() => {
    const q = perfSearch.trim().toLowerCase();
    let arr = [...(teamPerf || [])];

    if (q) arr = arr.filter((x) => String(x.name || "").toLowerCase().includes(q));

    const minR = perfMinRevenue === "" ? null : Number(perfMinRevenue);
    const maxR = perfMaxRevenue === "" ? null : Number(perfMaxRevenue);

    if (minR !== null && !Number.isNaN(minR)) arr = arr.filter((x) => Number(x.revenue || 0) >= minR);
    if (maxR !== null && !Number.isNaN(maxR)) arr = arr.filter((x) => Number(x.revenue || 0) <= maxR);

    arr.sort((a, b) => {
      const ra = Number(a.revenue || 0);
      const rb = Number(b.revenue || 0);
      const wa = Number(a.wonCount || 0);
      const wb = Number(b.wonCount || 0);
      const ca = Number(a.conversionRate || 0);
      const cb = Number(b.conversionRate || 0);

      switch (perfSort) {
        case "revenue_asc":
          return ra - rb;
        case "won_desc":
          return wb - wa;
        case "won_asc":
          return wa - wb;
        case "conv_desc":
          return cb - ca;
        case "conv_asc":
          return ca - cb;
        default:
          return rb - ra;
      }
    });

    return arr;
  }, [teamPerf, perfSearch, perfMinRevenue, perfMaxRevenue, perfSort]);

  const topPerformer = useMemo(() => (filteredTeamPerf.length ? filteredTeamPerf[0] : null), [filteredTeamPerf]);

  /* =========================
     ACTIONS
  ========================= */
  const actions = useMemo(() => {
    const all = [
      { key: "addLead", label: "Add Lead", icon: "➕", gate: ["superadmin", "admin", "manager", "employee"] },
      { key: "openLeads", label: "Leads Page", icon: "📋", gate: ["superadmin", "admin", "manager", "employee"] },
      { key: "callQueue", label: "Call Queue", icon: "📞", gate: ["superadmin", "admin", "manager", "employee"] },
      { key: "whatsapp", label: "WhatsApp", icon: "💬", gate: ["superadmin", "admin", "manager"] },
      { key: "email", label: "Email", icon: "✉️", gate: ["superadmin", "admin", "manager"] },
      { key: "calendar", label: "Calendar", icon: "🗓️", gate: ["superadmin", "admin", "manager", "employee"] },
      { key: "notes", label: "Notes", icon: "📝", gate: ["superadmin", "admin", "manager", "employee"] },
      { key: "import", label: "Import CSV", icon: "⬆️", gate: ["superadmin", "admin", "manager"] },
      { key: "export", label: "Export CSV", icon: "⬇️", gate: ["superadmin", "admin", "manager"] },
      { key: "assign", label: "Bulk Assign", icon: "👥", gate: ["superadmin", "admin", "manager"] },
      { key: "automation", label: "Automation", icon: "⚡", gate: ["superadmin", "admin"] },
      { key: "audit", label: "Audit Log", icon: "🧾", gate: ["superadmin", "admin"] }
    ];
    return all.filter((a) => a.gate.includes(role));
  }, [role]);

  const handleAction = (key) => {
    if (key === "export") {
      exportLeadsCSV(leads);
      showToast("Export started ✅");
      return;
    }
    if (key === "openLeads") {
      showToast("Route: /leads (add react-router later)");
      return;
    }
    if (key === "callQueue") {
      setTab("callCenter");
      showToast("Opened Call Center ✅");
      return;
    }
    if (key === "automation") {
      setTab("automation");
      showToast("Opened Automation ✅");
      return;
    }
    if (key === "audit") return showToast("Open Audit Log (later)");
    if (key === "whatsapp") return showToast("Open WhatsApp (later)");
    if (key === "email") return showToast("Open Email (later)");
    if (key === "calendar") return showToast("Open Calendar (later)");
    if (key === "notes") return showToast("Open Notes (later)");
    if (key === "import") return showToast("Import CSV (later)");
    if (key === "assign") return showToast("Bulk Assign (later)");
    if (key === "addLead") return showToast("Add Lead modal (later)");
    showToast(`Action: ${key} (wire later)`);
  };

  const rootClass =
    "dashRoot " +
    (density === "compact" ? "denCompact " : density === "ultra" ? "denUltra " : "denComfort ") +
    (focusMode ? "focusMode " : "") +
    (accent ? `accent-${accent} ` : "");

  return (
    <div className={rootClass}>
      {/* TOP BAR */}
      <div className="topShell">
        <div className="topLeft">
          <div className="logoBox">S24</div>
          <div className="brandTxt">
            <div className="brandLine">
              <div className="brandName">SUDO24 CRM</div>
              <span className="chip">{role}</span>
              {loading ? <span className="chip soft">Loading…</span> : <span className="chip soft">Live UI</span>}
            </div>
            <div className="brandSub">
              {user?.name ? `Welcome, ${user.name}` : "Welcome"} • Full-width dashboard
            </div>
          </div>
        </div>

        <div className="topRight">
          <div className="searchWrap">
            <span className="searchIcon">🔎</span>
            <input
              className="searchInput"
              placeholder="Search leads by name / phone / city / email…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            <select className="searchSelect" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="demo">Demo</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <button className="btn ghost" onClick={loadAll} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn ghost" onClick={() => setShowRightPanel((v) => !v)}>
              {showRightPanel ? "Hide Panel" : "Show Panel"}
            </button>
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div className="tabBar">
        <div className="tabs">
          {allowedTabs.map((t) => (
            <button
              key={t.key}
              className={`tabBtn ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              type="button"
            >
              <span className="tabIcon">{t.icon}</span>
              <span className="tabLabel">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="actionRow">
          {actions.map((a) => (
            <button key={a.key} className="actionBtn" onClick={() => handleAction(a.key)} type="button">
              <span className="actionIcon">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}

          <div className="prefsRow">
            <select className="pillSelect" value={density} onChange={(e) => setDensity(e.target.value)}>
              <option value="comfortable">Density: Comfortable</option>
              <option value="compact">Density: Compact</option>
              <option value="ultra">Density: Ultra</option>
            </select>

            <select className="pillSelect" value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="indigo">Accent: Indigo</option>
              <option value="emerald">Accent: Emerald</option>
              <option value="amber">Accent: Amber</option>
              <option value="rose">Accent: Rose</option>
            </select>

            <button className={`pillBtn ${focusMode ? "on" : ""}`} onClick={() => setFocusMode((v) => !v)} type="button">
              🎯 Focus {focusMode ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className={`mainGrid ${showRightPanel ? "" : "noRight"}`}>
        {/* MAIN */}
        <div className="mainCol">
          {msg ? <div className="alert">{msg}</div> : null}

          {/* OVERVIEW */}
          {tab === "overview" && (
            <>
              <div className="kpiGrid">
                <Kpi title="Today New Leads" value={todayStats?.todayNewLeads ?? "-"} hint={todayStats?.dateKey ? `Date: ${todayStats.dateKey}` : ""} />
                <Kpi title="Today Follow-ups" value={todayStats?.todayFollowups ?? "-"} />
                <Kpi title="Pending Follow-ups" value={todayStats?.pendingFollowups ?? "-"} />
                <Kpi title="Overdue Follow-ups" value={stats.overdue} hint="Before today" />
                <Kpi title="Win Rate" value={`${stats.winRate}%`} hint="Won / (Won + Lost)" />
                <Kpi title="Hot Leads (48h)" value={stats.hotLeads} hint="Demo/Contacted + followup soon" />
              </div>

              <div className="toggleRow">
                <Toggle label="Widgets" value={showWidgets} onChange={setShowWidgets} />
                <Toggle label="Insights" value={showInsights} onChange={setShowInsights} />
                <Toggle label="Ops Panel" value={showOps} onChange={setShowOps} />
              </div>

              {showWidgets && (
                <div className="wideGrid4">
                  <div className="card">
                    <Head title="Leads Trend (14 days)" sub="New leads per day" right={<span className="tag">SVG</span>} />
                    <div style={{ marginTop: 10 }}>
                      <LineChartSvg data={leadsTrend} height={150} />
                    </div>
                    <div className="miniGrid">
                      <Mini label="Total Leads" value={stats.total} />
                      <Mini label="Pipeline" value={stats.inPipe} />
                      <Mini label="Won" value={stats.won} />
                      <Mini label="Lost" value={stats.lost} />
                    </div>
                  </div>

                  <div className="card">
                    <Head title="Activity Trend (14 days)" sub="Total actions recorded" right={<span className="tag">SVG</span>} />
                    <div style={{ marginTop: 10 }}>
                      <BarChartSvg data={activityTrend} height={150} />
                    </div>
                    <div className="miniGrid">
                      <Mini label="Activities" value={activities?.length || 0} />
                      <Mini label="Today Followups" value={stats.todayFollowups} />
                      <Mini label="Overdue" value={stats.overdue} />
                      <Mini label="Hot 48h" value={stats.hotLeads} />
                    </div>
                  </div>

                  <div className="card">
                    <Head title="Status Mix" sub="Donut chart (no lib)" right={<span className="tag">SVG</span>} />
                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center" }}>
                      <DonutChartSvg segments={statusSegments} size={170} />
                      <div style={{ display: "grid", gap: 8 }}>
                        {statusSegments.map((s) => (
                          <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: donutColor(s.key) }} />
                              <span style={{ fontWeight: 950, color: "#111827" }}>{s.label}</span>
                            </div>
                            <span className="muted" style={{ fontWeight: 950 }}>
                              {s.value} ({s.pct}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <Head title="Lead Preview" sub="Upcoming follow-ups first" right={<span className="tag">Top 12</span>} />
                    <div className="leadList">
                      {filteredLeadsPreview.length === 0 ? (
                        <div className="muted">No leads found.</div>
                      ) : (
                        filteredLeadsPreview.map((l) => (
                          <div key={l._id} className="leadItem clickable" onClick={() => showToast("Open lead (route later)")}>
                            <div className="leadLeft">
                              <Avatar name={l.name || "Lead"} />
                              <div className="leadText">
                                <div className="leadName">{l.name || "-"}</div>
                                <div className="leadMeta">
                                  {l.phone || "-"} • {l.city || "—"} • <span className="cap">{l.status || "new"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="leadRight">
                              <div className="leadTime">{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "—"}</div>
                              <div className="leadBtns">
                                <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("Call (later)"))}>
                                  Call
                                </button>
                                <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("WhatsApp (later)"))}>
                                  WA
                                </button>
                                <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("Add note (later)"))}>
                                  Note
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showInsights && (
                <div className="twoGrid">
                  <div className="card">
                    <Head title="Activity Feed" sub="Latest actions" right={<span className="tag soft">Live</span>} />
                    <div className="feed">
                      {activities.length === 0 ? (
                        <div className="muted">No activity yet.</div>
                      ) : (
                        activities.slice(0, 24).map((a) => (
                          <div key={a._id} className="feedItem clickable" onClick={() => showToast("Open activity (later)")}>
                            <div className="feedTop">
                              <div className="feedActor">
                                <Avatar name={a.actorId?.name || "User"} />
                                <div>
                                  <div className="feedName">{a.actorId?.name || "User"}</div>
                                  <div className="feedTime">{new Date(a.createdAt || Date.now()).toLocaleString()}</div>
                                </div>
                              </div>
                              <span className="tag soft">#{a.action || "event"}</span>
                            </div>
                            <div className="feedText">{formatAction(a)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <Head
                      title="Quick Ops"
                      sub="Fast actions for employees"
                      right={
                        <button className="btn tiny ghostDark" onClick={() => showToast("Customize ops (later)")}>
                          Customize
                        </button>
                      }
                    />
                    {showOps ? (
                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        <OpsCard title="Start Calling Sprint" desc="Open Call Center & prioritize leads" icon="📞" onClick={() => setTab("callCenter")} />
                        <OpsCard title="Plan My Day" desc="Write checklist + notes + focus timer" icon="🗓️" onClick={() => setTab("myDay")} />
                        <OpsCard title="My Tasks" desc="Overdue + due today follow-ups" icon="✅" onClick={() => setTab("myTasks")} />
                        <OpsCard title="Team Performance" desc="Leaderboard & revenue" icon="🏆" onClick={() => setTab("teamPerformance")} />
                      </div>
                    ) : (
                      <div className="muted" style={{ marginTop: 12 }}>
                        Ops panel hidden.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* MY DAY */}
          {tab === "myDay" && (
            <div className="card">
              <Head title="My Day" sub="Everything you need today (notes + checklist + focus)" right={<span className="tag">Personal</span>} />
              <div style={{ marginTop: 12 }} className="myDayGrid">
                <div className="subCard">
                  <div style={{ fontWeight: 950 }}>Quick Note</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Saved locally (wire API later)
                  </div>
                  <textarea
                    className="textarea"
                    placeholder="Write your plan, call script, objections, follow-ups…"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={() => {
                        try {
                          localStorage.setItem("dash_quickNote", quickNote);
                          showToast("Saved ✅");
                        } catch {
                          showToast("Save failed");
                        }
                      }}
                    >
                      Save Note
                    </button>
                    <button
                      className="btn ghostDark"
                      onClick={() => {
                        try {
                          const x = localStorage.getItem("dash_quickNote") || "";
                          setQuickNote(x);
                          showToast("Loaded ✅");
                        } catch {
                          showToast("Load failed");
                        }
                      }}
                    >
                      Load
                    </button>
                    <button className="btn ghostDark" onClick={() => (setQuickNote(""), showToast("Cleared ✅"))}>
                      Clear
                    </button>
                  </div>
                </div>

                <div className="subCard">
                  <div style={{ fontWeight: 950 }}>Today KPI Snapshot</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <Mini label="Today New Leads" value={todayStats?.todayNewLeads ?? "-"} />
                    <Mini label="Today Follow-ups" value={todayStats?.todayFollowups ?? "-"} />
                    <Mini label="Pending Follow-ups" value={todayStats?.pendingFollowups ?? "-"} />
                    <Mini label="Overdue Follow-ups" value={stats.overdue} />
                    <div style={{ marginTop: 6 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Win Rate
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <ProgressBar pct={stats.winRate} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="subCard">
                  <div style={{ fontWeight: 950 }}>Focus Mode</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Toggle focus mode to reduce distractions
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <button className={`pillBtn ${focusMode ? "on" : ""}`} onClick={() => setFocusMode((v) => !v)}>
                      {focusMode ? "✅ Focus ON" : "🎯 Focus OFF"}
                    </button>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Tip: Focus mode hides the right panel.
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button className="btn ghostDark" onClick={() => showToast("Start 25-min Pomodoro (later)")}>
                        Start 25 min
                      </button>
                      <button className="btn ghostDark" onClick={() => showToast("Start 50-min Deep Work (later)")}>
                        Start 50 min
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MY TASKS */}
          {tab === "myTasks" && (
            <div className="card">
              <Head title="My Tasks" sub="Overdue + due today + upcoming follow-ups" right={<span className="tag">Personal</span>} />
              <MyTasks leads={leads} onToast={showToast} />
            </div>
          )}

          {/* CALL CENTER */}
          {tab === "callCenter" && (
            <div className="card">
              <Head title="Call Center" sub="Auto-prioritized call queue (UI only)" right={<span className="tag">Queue</span>} />
              <div style={{ marginTop: 12 }} className="callGrid">
                <div className="subCard">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 950 }}>Call Queue</div>
                    <span className="tag soft">Top {callQueue.length}</span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {callQueue.map((l) => (
                      <div key={l._id} className="queueItem clickable" onClick={() => showToast("Open lead (later)")}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                          <Avatar name={l.name || "Lead"} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {l.name || "-"}{" "}
                              <span className="tag soft" style={{ marginLeft: 8 }}>
                                {String(l.status || "new")}
                              </span>
                            </div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {l.phone || "-"} • {l.city || "—"}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 950 }}>Score: {Math.round(l._score || 0)}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Next: {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "—"}
                          </div>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
                            <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("Dial (later)"))}>
                              Dial
                            </button>
                            <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("WA (later)"))}>
                              WA
                            </button>
                            <button className="chipBtn" onClick={(e) => (e.stopPropagation(), showToast("Add note (later)"))}>
                              Note
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {callQueue.length === 0 ? <div className="muted">No leads to call.</div> : null}
                  </div>
                </div>

                <div className="subCard">
                  <div style={{ fontWeight: 950 }}>Quick Scripts</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Click to copy (edit later)
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <CopyCard
                      title="Opening Line"
                      text="Hi, I’m calling from SUDO24 Learning. I saw your enquiry—can I take 30 seconds to understand your goal and then I’ll guide you properly?"
                      showToast={showToast}
                    />
                    <CopyCard
                      title="Pricing Objection"
                      text="Totally understand. Instead of discount, can I help you choose the right plan? If we match your goal + timeline, the ROI becomes clearer."
                      showToast={showToast}
                    />
                    <CopyCard
                      title="Close"
                      text="If you’re ready, we can lock your seat today and I’ll share the next steps + schedule on WhatsApp."
                      showToast={showToast}
                    />
                  </div>
                </div>

                <div className="subCard">
                  <div style={{ fontWeight: 950 }}>Mini Performance</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Based on current data
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div className="miniStat">
                      <div className="muted">Pipeline</div>
                      <div style={{ fontWeight: 950 }}>{stats.inPipe}</div>
                      <SparklineSvg data={leadsTrend.map((d) => d.y)} height={34} />
                    </div>

                    <div className="miniStat">
                      <div className="muted">Activities</div>
                      <div style={{ fontWeight: 950 }}>{activities?.length || 0}</div>
                      <SparklineSvg data={activityTrend.map((d) => d.y)} height={34} />
                    </div>

                    <div className="miniStat">
                      <div className="muted">Win Rate</div>
                      <div style={{ fontWeight: 950 }}>{stats.winRate}%</div>
                      <ProgressBar pct={stats.winRate} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TEAM PERFORMANCE */}
          {tab === "teamPerformance" && (
            <div className="card">
              <Head
                title="Team Performance"
                sub="Filter + sort • Export • No chart lib"
                right={
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn tiny ghostDark" onClick={loadTeamPerformance} disabled={perfLoading}>
                      {perfLoading ? "Loading…" : "Refresh"}
                    </button>
                    <button className="btn tiny ghostDark" onClick={() => exportTeamPerfCSV(filteredTeamPerf)}>
                      Export
                    </button>
                    <span className="tag">Team</span>
                  </div>
                }
              />

              {perfMsg ? <div className="alert">{perfMsg}</div> : null}

              <div className="filterGrid">
                <Field label="From">
                  <input className="input" type="date" value={perfFrom} onChange={(e) => setPerfFrom(e.target.value)} />
                </Field>
                <Field label="To">
                  <input className="input" type="date" value={perfTo} onChange={(e) => setPerfTo(e.target.value)} />
                </Field>
                <Field label="Employee">
                  <select className="input" value={perfEmployeeId} onChange={(e) => setPerfEmployeeId(e.target.value)}>
                    <option value="all">All Employees</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({roleNorm(u.role)})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sort">
                  <select className="input" value={perfSort} onChange={(e) => setPerfSort(e.target.value)}>
                    <option value="revenue_desc">Revenue ↓</option>
                    <option value="revenue_asc">Revenue ↑</option>
                    <option value="won_desc">Won Deals ↓</option>
                    <option value="won_asc">Won Deals ↑</option>
                    <option value="conv_desc">Conversion ↓</option>
                    <option value="conv_asc">Conversion ↑</option>
                  </select>
                </Field>
                <Field label="Search">
                  <input className="input" placeholder="Search employee…" value={perfSearch} onChange={(e) => setPerfSearch(e.target.value)} />
                </Field>
                <Field label="Min Revenue">
                  <input className="input" inputMode="numeric" placeholder="0" value={perfMinRevenue} onChange={(e) => setPerfMinRevenue(e.target.value)} />
                </Field>
                <Field label="Max Revenue">
                  <input className="input" inputMode="numeric" placeholder="999999" value={perfMaxRevenue} onChange={(e) => setPerfMaxRevenue(e.target.value)} />
                </Field>

                <div className="filterBtns">
                  <button className="btn" onClick={loadTeamPerformance} disabled={perfLoading}>
                    Apply
                  </button>
                  <button
                    className="btn ghostDark"
                    onClick={() => {
                      setPerfSearch("");
                      setPerfMinRevenue("");
                      setPerfMaxRevenue("");
                      setPerfSort("revenue_desc");
                      setPerfEmployeeId("all");
                      setPerfFrom(toInputDate(getNDaysAgo(30)));
                      setPerfTo(toInputDate(new Date()));
                      showToast("Filters reset ✅");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="kpiGrid" style={{ marginTop: 12 }}>
                <Kpi title="Top Performer" value={topPerformer ? topPerformer.name : "-"} hint={topPerformer ? `Revenue: ${formatINR(topPerformer.revenue || 0)}` : ""} small />
                <Kpi title="Total Revenue" value={formatINR(sum(filteredTeamPerf.map((x) => x.revenue || 0)))} hint="Selected range" small />
                <Kpi title="Won Deals" value={sum(filteredTeamPerf.map((x) => x.wonCount || 0))} hint="Selected range" small />
                <Kpi title="Avg Conversion" value={`${avg(filteredTeamPerf.map((x) => Number(x.conversionRate || 0))).toFixed(1)}%`} hint="Average" small />
                <Kpi title="Total Activities" value={sum(filteredTeamPerf.map((x) => x.activitiesCount || 0))} hint="Selected range" small />
                <Kpi title="Avg Deal" value={formatINR(avg(filteredTeamPerf.map((x) => Number(x.avgDeal || 0))))} hint="Average" small />
              </div>

              <div className="card" style={{ marginTop: 12, borderRadius: 22 }}>
                <Head title="Revenue Bars" sub="Top 12 by revenue" right={<span className="tag">SVG</span>} />
                <div style={{ marginTop: 10 }}>
                  <BarChartSvg
                    data={filteredTeamPerf.slice(0, 12).map((x) => ({ x: (x.name || "-").split(" ")[0], y: Number(x.revenue || 0) }))}
                    height={170}
                    formatY={(v) => {
                      const n = Number(v || 0);
                      if (n >= 10000000) return `${Math.round(n / 10000000)}Cr`;
                      if (n >= 100000) return `${Math.round(n / 100000)}L`;
                      if (n >= 1000) return `${Math.round(n / 1000)}K`;
                      return String(Math.round(n));
                    }}
                  />
                </div>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 54 }}>#</th>
                      <th>Employee</th>
                      <th>Role</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                      <th style={{ textAlign: "right" }}>Won</th>
                      <th style={{ textAlign: "right" }}>Lost</th>
                      <th style={{ textAlign: "right" }}>Conversion</th>
                      <th style={{ textAlign: "right" }}>Avg Deal</th>
                      <th style={{ textAlign: "right" }}>Activities</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfLoading ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 16 }} className="muted">
                          Loading…
                        </td>
                      </tr>
                    ) : filteredTeamPerf.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 16 }} className="muted">
                          No data found.
                        </td>
                      </tr>
                    ) : (
                      filteredTeamPerf.map((x, idx) => (
                        <tr key={x._id || idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="rowUser">
                              <Avatar name={x.name || "User"} />
                              <div className="rowUserTxt">
                                <div style={{ fontWeight: 900 }}>
                                  {x.name || "-"} {idx === 0 ? <span className="trophy">🏆</span> : null}
                                </div>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {x.email || ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="cap">{x.role || "employee"}</td>
                          <td style={{ textAlign: "right", fontWeight: 900 }}>{formatINR(x.revenue || 0)}</td>
                          <td style={{ textAlign: "right" }}>{x.wonCount || 0}</td>
                          <td style={{ textAlign: "right" }}>{x.lostCount || 0}</td>
                          <td style={{ textAlign: "right" }}>{toFixed1(x.conversionRate)}%</td>
                          <td style={{ textAlign: "right" }}>{formatINR(x.avgDeal || 0)}</td>
                          <td style={{ textAlign: "right" }}>{x.activitiesCount || 0}</td>
                          <td style={{ textAlign: "right" }}>
                            <div className="rowBtns">
                              <button className="chipBtn" onClick={() => showToast("Open profile (later)")}>
                                Profile
                              </button>
                              <button className="chipBtn" onClick={() => showToast("View deals (later)")}>
                                Deals
                              </button>
                              <button className="chipBtn" onClick={() => showToast("Message (later)")}>
                                Msg
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="note">
                <b>TODO BACKEND:</b> Implement <code>/api/performance/team</code> aggregation (revenue/won/lost etc).
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {tab === "pipeline" && (
            <div className="card">
              <Head title="Pipeline Board" sub="Kanban style (UI only)" right={<span className="tag">Manager+</span>} />
              <PipelineBoard leads={leads} onAction={(t) => showToast(t)} />
              <div className="note">
                <b>TODO:</b> Move stage → call backend PATCH <code>/api/leads/:id/status</code>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {tab === "reports" && (
            <div className="card">
              <Head title="Reports Center" sub="Exports + insights (UI only)" right={<span className="tag">Reports</span>} />
              <ReportsCenter role={role} leads={leads} onAction={(t) => showToast(t)} />
            </div>
          )}

          {/* AUTOMATION */}
          {tab === "automation" && (
            <div className="card">
              <Head title="Automation Rules" sub="Auto-assign + SLA + reminders (UI only)" right={<span className="tag">Admin</span>} />
              <AutomationPanel onAction={(t) => showToast(t)} />
              <div className="note">
                <b>TODO BACKEND:</b> Save rules + run cron/queue for reminders.
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div className="card">
              <Head title="Settings" sub="Company configuration (UI only)" right={<span className="tag">Admin</span>} />
              <SettingsPanel role={role} onAction={(t) => showToast(t)} />
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        {showRightPanel ? (
          <div className="rightCol">
            <EmployeeIdCard user={user} showToast={showToast} />

            <div className="card">
              <Head title="Quick KPIs" sub="At a glance" right={<span className="tag soft">Live</span>} />
              <div className="miniGrid" style={{ marginTop: 12 }}>
                <Mini label="Total" value={stats.total} />
                <Mini label="Pipeline" value={stats.inPipe} />
                <Mini label="Win Rate" value={`${stats.winRate}%`} />
                <Mini label="Overdue" value={stats.overdue} />
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <button className="btn" onClick={() => (exportLeadsCSV(leads), showToast("Exported ✅"))}>
                  Export Leads
                </button>
                <button className="btn ghostDark" onClick={() => showToast("Notifications (later)")}>
                  Notifications
                </button>
                <button className="btn ghostDark" onClick={() => showToast("Help Center (later)")}>
                  Help Center
                </button>
              </div>
            </div>

            <div className="card">
              <Head title="Mini Leaderboard" sub="Top 5" right={<span className="tag">Team</span>} />
              <MiniLeaderboard perf={teamPerf} />
            </div>

            <div className="card">
              <Head title="Download ID Card" sub="PNG with html2canvas" right={<span className="tag">PNG</span>} />
              <IdCardDownloader user={user} showToast={showToast} />
            </div>
          </div>
        ) : null}
      </div>

      {/* TOAST */}
      {toast ? <div className="toast">{toast}</div> : null}

      {/* STYLES */}
      <style>{dashboardCSS}</style>
    </div>
  );
}

/* =========================================================
   ✅ UI COMPONENTS (single definitions only)
========================================================= */
function Head({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
      <div>
        <div style={{ fontWeight: 950, color: "#111827" }}>{title}</div>
        {sub ? <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginTop: 3 }}>{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="btn ghostDark"
      style={{
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: value ? "#111827" : "#fff",
        color: value ? "#fff" : "#111827"
      }}
      type="button"
    >
      {label}: {value ? "ON" : "OFF"}
    </button>
  );
}

function Kpi({ title, value, hint, small, right }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        padding: 14,
        background: "linear-gradient(180deg,#ffffff,#fbfdff)",
        boxShadow: "0 12px 34px rgba(0,0,0,.06)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 900 }}>{title}</div>
        {right}
      </div>
      <div style={{ fontSize: small ? 16 : 28, fontWeight: 950, marginTop: 6, color: "#111827" }}>{String(value)}</div>
      {hint ? <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{hint}</div> : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 950, color: "#6b7280" }}>{label}</div>
      {children}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ padding: 10, borderRadius: 16, border: "1px solid #eef2f7", background: "#f9fafb" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 950, color: "#111827" }}>{value}</div>
    </div>
  );
}

function Avatar({ name }) {
  const url =
    "https://ui-avatars.com/api/?name=" +
    encodeURIComponent(name || "User") +
    "&background=111827&color=fff&size=128";
  return <img src={url} alt={name} style={{ width: 34, height: 34, borderRadius: 14, border: "1px solid #e5e7eb" }} />;
}

function OpsCard({ title, desc, icon, onClick }) {
  return (
    <div
      className="clickable"
      onClick={onClick}
      style={{
        padding: 14,
        borderRadius: 22,
        border: "1px solid #eef2f7",
        background: "#f9fafb",
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center"
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: 16, background: "#fff", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {desc}
          </div>
        </div>
      </div>
      <span className="tag">Open</span>
    </div>
  );
}

function ProgressBar({ pct }) {
  const p = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div style={{ height: 10, borderRadius: 999, background: "#e5e7eb", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: "#111827" }} />
    </div>
  );
}

/* =========================================================
   ✅ SVG CHARTS (no libs)
========================================================= */
function LineChartSvg({ data, height = 140 }) {
  const w = 520;
  const h = height;
  const pad = 18;
  const arr = (data || []).map((d) => ({ x: d.x, y: Number(d.y || 0) }));
  const maxY = Math.max(1, ...arr.map((d) => d.y));
  const minY = Math.min(0, ...arr.map((d) => d.y));

  const xStep = arr.length > 1 ? (w - pad * 2) / (arr.length - 1) : 0;
  const yScale = (v) => {
    const t = (v - minY) / (maxY - minY || 1);
    return h - pad - t * (h - pad * 2);
  };

  const pts = arr.map((d, i) => `${pad + i * xStep},${yScale(d.y)}`).join(" ");
  const fillPts = `${pad},${h - pad} ${pts} ${pad + (arr.length - 1) * xStep},${h - pad}`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={`M ${fillPts}`} fill="rgba(17,24,39,0.08)" />
      <polyline points={pts} fill="none" stroke="#111827" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {arr.map((d, i) => (
        <circle key={i} cx={pad + i * xStep} cy={yScale(d.y)} r="4" fill="#111827" />
      ))}
      {arr.map((d, i) => (
        <text key={i} x={pad + i * xStep} y={h - 4} fontSize="10" textAnchor="middle" fill="#6b7280" fontWeight="800">
          {String(d.x || "")}
        </text>
      ))}
    </svg>
  );
}

function BarChartSvg({ data, height = 140, formatY }) {
  const w = 520;
  const h = height;
  const pad = 18;
  const arr = (data || []).map((d) => ({ x: String(d.x || ""), y: Number(d.y || 0) }));
  const maxY = Math.max(1, ...arr.map((d) => d.y));
  const barW = arr.length ? (w - pad * 2) / arr.length : 0;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e5e7eb" strokeWidth="2" />
      {arr.map((d, i) => {
        const bh = ((d.y || 0) / maxY) * (h - pad * 2);
        const x = pad + i * barW + 6;
        const y = h - pad - bh;
        const bw = Math.max(8, barW - 12);
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx="10" fill="#111827" opacity="0.92" />
            <text x={x + bw / 2} y={h - 4} fontSize="10" textAnchor="middle" fill="#6b7280" fontWeight="800">
              {d.x}
            </text>
          </g>
        );
      })}
      <text x={w - pad} y={12} fontSize="10" textAnchor="end" fill="#6b7280" fontWeight="800">
        Max: {formatY ? formatY(maxY) : String(Math.round(maxY))}
      </text>
    </svg>
  );
}

function SparklineSvg({ data, height = 30 }) {
  const w = 140;
  const h = height;
  const pad = 3;
  const arr = (data || []).map((v) => Number(v || 0));
  const maxY = Math.max(1, ...arr);
  const minY = Math.min(0, ...arr);

  const xStep = arr.length > 1 ? (w - pad * 2) / (arr.length - 1) : 0;
  const yScale = (v) => {
    const t = (v - minY) / (maxY - minY || 1);
    return h - pad - t * (h - pad * 2);
  };

  const pts = arr.map((v, i) => `${pad + i * xStep},${yScale(v)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function DonutChartSvg({ segments, size = 160 }) {
  const r = 54;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 16;
  const circ = 2 * Math.PI * r;

  let acc = 0;
  const segs = (segments || []).filter((s) => Number(s.value || 0) > 0);

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      {segs.map((s) => {
        const pct = Math.max(0, Math.min(100, Number(s.pct || 0)));
        const dash = (pct / 100) * circ;
        const dashArr = `${dash} ${circ - dash}`;
        const rot = (acc / 100) * 360 - 90;
        acc += pct;
        return (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={donutColor(s.key)}
            strokeWidth={stroke}
            strokeDasharray={dashArr}
            strokeLinecap="round"
            transform={`rotate(${rot} ${cx} ${cy})`}
          />
        );
      })}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="16" fill="#111827" fontWeight="950">
        {segments?.reduce((a, b) => a + Number(b.value || 0), 0) || 0}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="800">
        total
      </text>
    </svg>
  );
}

function donutColor(key) {
  switch (key) {
    case "new":
      return "#111827";
    case "contacted":
      return "#2563eb";
    case "demo":
      return "#f59e0b";
    case "won":
      return "#10b981";
    case "lost":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

/* =========================================================
   ✅ Right-panel + tools
========================================================= */
function MiniLeaderboard({ perf = [] }) {
  const top = (perf || []).slice(0, 5);
  if (!top.length) return <div className="muted" style={{ marginTop: 10 }}>No performance data loaded yet.</div>;

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {top.map((x, i) => (
        <div
          key={x._id || i}
          className="clickable"
          onClick={() => alert("Route later: employee details")}
          style={{
            padding: 12,
            borderRadius: 18,
            border: "1px solid #eef2f7",
            background: "#f9fafb",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Avatar name={x.name || "User"} />
            <div>
              <div style={{ fontWeight: 950 }}>{x.name || "-"}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Revenue: {formatINR(x.revenue || 0)}
              </div>
            </div>
          </div>
          <div style={{ fontWeight: 950 }}>{i === 0 ? "🏆" : `#${i + 1}`}</div>
        </div>
      ))}
    </div>
  );
}

function CopyCard({ title, text, showToast }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      showToast?.("Copied ✅");
    } catch {
      showToast?.("Copy failed");
    }
  };

  return (
    <div className="clickable" onClick={copy} style={{ padding: 12, borderRadius: 18, border: "1px solid #eef2f7", background: "#f9fafb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <span className="tag">Copy</span>
      </div>
      <div className="muted" style={{ marginTop: 8, lineHeight: 1.4 }}>
        {text}
      </div>
    </div>
  );
}

function IdCardDownloader({ user, showToast }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const safe = user || {};
  const photo =
    safe.photoUrl ||
    safe.avatar ||
    safe.profilePic ||
    safe.photo ||
    "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(safe.name || "User") +
      "&background=111827&color=fff&size=512";

  const empId = safe.employeeId || safe.empId || safe._id || "—";

  const download = async () => {
    try {
      setBusy(true);
      const node = ref.current;
      if (!node) return;
      const canvas = await html2canvas(node, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ID-${String(empId).replace(/\s+/g, "_")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast?.("Downloaded ✅");
      }, "image/png");
    } catch {
      showToast?.("Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <div
        ref={ref}
        style={{
          borderRadius: 22,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          background: "#fff"
        }}
      >
        <div style={{ padding: 12, background: "linear-gradient(135deg,#111827,#1f2937)", color: "#fff" }}>
          <div style={{ fontWeight: 950 }}>SUDO24 • ID CARD</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{safe.role || "employee"}</div>
        </div>
        <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <img src={photo} alt="emp" style={{ width: 56, height: 56, borderRadius: 18, objectFit: "cover", border: "1px solid #e5e7eb" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {safe.name || "User"}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              ID: <b style={{ color: "#111827" }}>{String(empId)}</b>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {safe.email || ""}
            </div>
          </div>
        </div>
      </div>

      <button className="btn" onClick={download} disabled={busy}>
        {busy ? "Downloading..." : "Download PNG"}
      </button>
    </div>
  );
}

/* =========================================================
   ✅ Missing Panels
========================================================= */
function EmployeeIdCard({ user, showToast }) {
  const u = user || {};
  const empId = u.employeeId || u.empId || u._id || "—";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(empId));
      showToast?.("Employee ID copied ✅");
    } catch {
      showToast?.("Copy failed");
    }
  };

  return (
    <div className="card">
      <Head title="Employee" sub="Your login identity" right={<span className="tag">ID</span>} />
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <Avatar name={u.name || "User"} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, color: "#111827" }}>{u.name || "User"}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Role: <b style={{ color: "#111827" }}>{u.role || "employee"}</b>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Employee ID: <b style={{ color: "#111827" }}>{String(empId)}</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn ghostDark" onClick={copy}>
          Copy ID
        </button>
        <button className="btn ghostDark" onClick={() => showToast?.("Open profile (later)")}>
          Profile
        </button>
      </div>
    </div>
  );
}

function MyTasks({ leads, onToast }) {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const overdue = (leads || []).filter((l) => {
    if (!l?.nextFollowUp) return false;
    const t = new Date(l.nextFollowUp);
    if (Number.isNaN(t.getTime())) return false;
    return t < startToday;
  });

  const dueToday = (leads || []).filter((l) => {
    if (!l?.nextFollowUp) return false;
    const t = new Date(l.nextFollowUp);
    if (Number.isNaN(t.getTime())) return false;
    return t >= startToday && t < endToday;
  });

  const upcoming = (leads || [])
    .filter((l) => {
      if (!l?.nextFollowUp) return false;
      const t = new Date(l.nextFollowUp);
      if (Number.isNaN(t.getTime())) return false;
      return t >= endToday;
    })
    .sort((a, b) => new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime())
    .slice(0, 20);

  const Block = ({ title, items, tag }) => (
    <div className="subCard">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <span className="tag">{tag}</span>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {items.length === 0 ? (
          <div className="muted">No items.</div>
        ) : (
          items.map((l) => (
            <div
              key={l._id}
              style={{
                padding: 12,
                borderRadius: 18,
                border: "1px solid #eef2f7",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center"
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                <Avatar name={l.name || "Lead"} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.name || "-"}{" "}
                    <span className="tag soft" style={{ marginLeft: 8 }}>
                      {l.status || "new"}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {l.phone || "-"} • {l.city || "—"}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 950, fontSize: 12 }}>
                  {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "—"}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
                  <button className="chipBtn" onClick={() => onToast?.("Call (later)")}>Call</button>
                  <button className="chipBtn" onClick={() => onToast?.("Note (later)")}>Note</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Block title="Overdue" items={overdue} tag={overdue.length} />
        <Block title="Due Today" items={dueToday} tag={dueToday.length} />
      </div>
      <Block title="Upcoming" items={upcoming} tag={upcoming.length} />
    </div>
  );
}

function PipelineBoard({ leads, onAction }) {
  const cols = [
    { key: "new", label: "New" },
    { key: "contacted", label: "Contacted" },
    { key: "demo", label: "Demo" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" }
  ];

  const grouped = cols.reduce((acc, c) => {
    acc[c.key] = (leads || []).filter((l) => String(l.status || "new") === c.key);
    return acc;
  }, {});

  const Card = ({ l }) => (
    <div style={{ padding: 12, borderRadius: 18, border: "1px solid #eef2f7", background: "#fff", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <div style={{ fontWeight: 950, color: "#111827" }}>{l.name || "-"}</div>
        <span className="tag soft">{l.city || "—"}</span>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {l.phone || "-"} • {l.email || "-"}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <button className="chipBtn" onClick={() => onAction?.("Move stage (wire later)")}>Move</button>
        <button className="chipBtn" onClick={() => onAction?.("Open lead (wire later)")}>Open</button>
        <button className="chipBtn" onClick={() => onAction?.("Add note (wire later)")}>Note</button>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(260px, 1fr))", gap: 12, minWidth: 1300 }}>
        {cols.map((c) => (
          <div key={c.key} style={{ borderRadius: 22, border: "1px solid #eef2f7", background: "#f9fafb", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 950 }}>{c.label}</div>
              <span className="tag">{grouped[c.key]?.length || 0}</span>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(grouped[c.key] || []).slice(0, 50).map((l) => (
                <Card key={l._id} l={l} />
              ))}
              {(grouped[c.key] || []).length === 0 ? <div className="muted">No leads</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsCenter({ leads, onAction }) {
  const total = (leads || []).length;
  const byStatus = (leads || []).reduce((acc, l) => {
    const s = l.status || "new";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const won = byStatus.won || 0;
  const lost = byStatus.lost || 0;
  const winRate = safePct(won, Math.max(1, won + lost));

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      <div className="kpiGrid">
        <Kpi title="Total Leads" value={total} small />
        <Kpi title="Won" value={won} small />
        <Kpi title="Lost" value={lost} small />
        <Kpi title="Win Rate" value={`${winRate}%`} small />
        <Kpi title="Demo" value={byStatus.demo || 0} small />
        <Kpi title="Contacted" value={byStatus.contacted || 0} small />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="subCard">
          <div style={{ fontWeight: 950 }}>Exports</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Download reports to share with management
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => exportLeadsCSV(leads)}>
              Export Leads CSV
            </button>
            <button className="btn ghostDark" onClick={() => onAction?.("Export revenue report (later)")}>
              Export Revenue (later)
            </button>
            <button className="btn ghostDark" onClick={() => onAction?.("Export activity report (later)")}>
              Export Activity (later)
            </button>
          </div>
        </div>

        <div className="subCard">
          <div style={{ fontWeight: 950 }}>Insights (UI only)</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Add backend aggregation when ready
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="miniStat">
              <div className="muted">Pipeline</div>
              <div style={{ fontWeight: 950 }}>{total - won - lost}</div>
            </div>
            <div className="miniStat">
              <div className="muted">Quality</div>
              <div style={{ fontWeight: 950 }}>{winRate >= 30 ? "Good" : "Needs improvement"}</div>
            </div>
            <button className="btn ghostDark" onClick={() => onAction?.("Generate PDF report (later)")}>
              Generate PDF (later)
            </button>
          </div>
        </div>
      </div>

      <div className="note">
        <b>Tip:</b> Reports page should call backend aggregations like <code>/api/reports/summary</code> for accuracy.
      </div>
    </div>
  );
}

function AutomationPanel({ onAction }) {
  const [autoAssign, setAutoAssign] = React.useState(true);
  const [slaHours, setSlaHours] = React.useState("6");
  const [reminders, setReminders] = React.useState(true);

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      <div className="subCard">
        <div style={{ fontWeight: 950 }}>Auto Assign</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Round-robin assign new leads to employees (wire later)
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className={`pillBtn ${autoAssign ? "on" : ""}`} onClick={() => setAutoAssign((v) => !v)}>
            {autoAssign ? "ON" : "OFF"}
          </button>
          <button className="btn ghostDark" onClick={() => onAction?.("Configure rules (later)")}>
            Configure
          </button>
        </div>
      </div>

      <div className="subCard">
        <div style={{ fontWeight: 950 }}>SLA</div>
        <div className="muted" style={{ marginTop: 6 }}>
          If lead not contacted in SLA time → escalate (wire later)
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" style={{ maxWidth: 180 }} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
          <span className="tag">Hours</span>
          <button className="btn" onClick={() => onAction?.(`Saved SLA = ${slaHours}h (later)`)}>
            Save
          </button>
        </div>
      </div>

      <div className="subCard">
        <div style={{ fontWeight: 950 }}>Reminders</div>
        <div className="muted" style={{ marginTop: 6 }}>
          WhatsApp/Email reminders for followups (wire later)
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className={`pillBtn ${reminders ? "on" : ""}`} onClick={() => setReminders((v) => !v)}>
            {reminders ? "ON" : "OFF"}
          </button>
          <button className="btn ghostDark" onClick={() => onAction?.("Add template (later)")}>
            Add Template
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ onAction }) {
  const [companyName, setCompanyName] = React.useState("SUDO24 Learning");
  const [timezone, setTimezone] = React.useState("Asia/Kolkata");
  const [currency, setCurrency] = React.useState("INR");

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      <div className="subCard">
        <div style={{ fontWeight: 950 }}>Company</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Admin can update company settings (wire later)
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 620 }}>
          <Field label="Company Name">
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Timezone">
            <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </Field>
          <Field label="Currency">
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => onAction?.("Saved settings (later)")}>
              Save
            </button>
            <button className="btn ghostDark" onClick={() => onAction?.("Manage roles (later)")}>
              Manage Roles
            </button>
            <button className="btn ghostDark" onClick={() => onAction?.("Branding (later)")}>
              Branding
            </button>
          </div>
        </div>
      </div>

      <div className="note">
        <b>TODO BACKEND:</b> create endpoints like <code>/api/company</code>, <code>/api/roles</code> to save settings.
      </div>
    </div>
  );
}

/* =========================================================
   ✅ Helpers
========================================================= */
function safePct(a, b) {
  const x = Number(a || 0);
  const y = Number(b || 0);
  if (!y) return 0;
  return Math.round((x / y) * 100);
}

function getNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - Number(n || 0));
  return d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toInputDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function toFixed1(n) {
  const x = Number(n || 0);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

function sum(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
}

function avg(arr) {
  const a = (arr || []).map((x) => Number(x || 0)).filter((x) => Number.isFinite(x));
  if (!a.length) return 0;
  return sum(a) / a.length;
}

function formatINR(v) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));
  } catch {
    return `₹${Math.round(Number(v || 0))}`;
  }
}

function formatAction(a) {
  const action = a?.action || "event";
  const lead = a?.leadId?.name || a?.leadName || "";
  const note = a?.note || a?.text || a?.message || "";
  const who = a?.actorId?.name || a?.byName || "User";
  const bits = [];
  bits.push(`${who} • ${action}`);
  if (lead) bits.push(`Lead: ${lead}`);
  if (note) bits.push(note);
  return bits.join(" — ");
}

/* =========================
   CSV Export
========================= */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function exportLeadsCSV(leads) {
  const arr = leads || [];
  const header = ["Name", "Phone", "Email", "City", "Status", "AssignedTo", "NextFollowUp", "CreatedAt", "UpdatedAt"];
  const rows = [header];

  for (const l of arr) {
    rows.push([
      l?.name || "",
      l?.phone || "",
      l?.email || "",
      l?.city || "",
      l?.status || "new",
      l?.assignedTo?.name || l?.assignedToName || l?.assignedTo || "",
      l?.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "",
      l?.createdAt ? new Date(l.createdAt).toLocaleString() : "",
      l?.updatedAt ? new Date(l.updatedAt).toLocaleString() : ""
    ]);
  }

  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `leads-${toInputDate(new Date())}.csv`);
}

function exportTeamPerfCSV(perf) {
  const arr = perf || [];
  const header = ["Employee", "Email", "Role", "Revenue", "Won", "Lost", "ConversionRate", "AvgDeal", "Activities"];
  const rows = [header];

  for (const x of arr) {
    rows.push([
      x?.name || "",
      x?.email || "",
      x?.role || "",
      Number(x?.revenue || 0),
      Number(x?.wonCount || 0),
      Number(x?.lostCount || 0),
      Number(x?.conversionRate || 0),
      Number(x?.avgDeal || 0),
      Number(x?.activitiesCount || 0)
    ]);
  }

  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `team-performance-${toInputDate(new Date())}.csv`);
}

/* =========================================================
   ✅ CSS (single string)
========================================================= */
const dashboardCSS = `
 .dashRoot{
  /* ✅ FULL BLEED FIX (even if parent has max-width + center) */
  width: 98vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);

  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(17,24,39,0.15), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(99,102,241,0.12), transparent 55%),
    #f4f6fb;
  padding: 0;
}


  .topShell{
    width: 100%;
    display:flex;
    justify-content:space-between;
    gap: 14px;
    padding: 14px 18px;
    background: linear-gradient(135deg,#0b1220,#111827,#1f2937);
    border-bottom: 1px solid rgba(255,255,255,.08);
    box-shadow: 0 14px 40px rgba(0,0,0,.12);
    color: #fff;
  }
  .topLeft{ display:flex; align-items:center; gap: 12px; min-width: 260px; }
  .logoBox{
    width: 44px; height: 44px;
    border-radius: 14px;
    display:flex; align-items:center; justify-content:center;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.18);
    font-weight: 900;
  }
  .brandTxt{ display:grid; gap: 4px; }
  .brandLine{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
  .brandName{ font-weight: 900; letter-spacing: .4px; }
  .brandSub{ font-size: 12px; opacity: .92; }
  .chip{
    display:inline-flex;
    align-items:center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.14);
    text-transform: capitalize;
    font-weight: 900;
    font-size: 11px;
  }
  .chip.soft{ background: rgba(255,255,255,.06); }

  .topRight{
    display:flex; align-items:center; gap: 10px; flex-wrap: wrap;
    justify-content:flex-end; flex: 1;
  }
  .searchWrap{
    display:flex; align-items:center; gap: 8px;
    padding: 8px 10px;
    border-radius: 16px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12);
    min-width: min(720px, 100%);
  }
  .searchIcon{ opacity: .9; }
  .searchInput{
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: #fff;
    font-weight: 800;
    min-width: 160px;
  }
  .searchInput::placeholder{ color: rgba(255,255,255,.7); }
  .searchSelect{
    border-radius: 12px;
    padding: 8px 10px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.06);
    color: #fff;
    font-weight: 900;
    outline: none;
  }

  .btn{
    border-radius: 14px;
    border: 1px solid #111827;
    background: #111827;
    color: #fff;
    font-weight: 900;
    padding: 10px 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:disabled{ opacity: .7; cursor:not-allowed; }
  .btn.ghost{
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.14);
  }
  .btn.tiny{
    padding: 8px 10px;
    border-radius: 12px;
    font-size: 12px;
  }
  .ghostDark{
    background: #fff;
    color: #111827;
    border: 1px solid #e5e7eb;
  }

  .tabBar{
    width: 100%;
    padding: 12px 18px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    display:grid;
    gap: 10px;
  }
  .tabs{
    display:flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items:center;
  }
  .tabBtn{
    display:flex; align-items:center; gap: 10px;
    border: 1px solid #e5e7eb;
    background: #fff;
    padding: 10px 12px;
    border-radius: 16px;
    font-weight: 900;
    cursor: pointer;
    color: #111827;
  }
  .tabBtn.active{
    background: #111827;
    color: #fff;
    border-color:#111827;
  }
  .tabIcon{ opacity: .95; }
  .tabLabel{ font-size: 13px; }

  .actionRow{
    display:flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items:center;
  }
  .actionBtn{
    display:flex; align-items:center; gap: 8px;
    padding: 9px 12px;
    border-radius: 14px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    cursor: pointer;
    font-weight: 900;
    color: #111827;
  }
  .actionBtn:hover{ background: #eef2ff; border-color: #c7d2fe; }
  .actionIcon{ opacity: .95; }

  .prefsRow{
    margin-left: auto;
    display:flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items:center;
  }
  .pillSelect{
    padding: 9px 10px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    font-weight: 900;
    outline: none;
  }
  .pillBtn{
    padding: 9px 12px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    font-weight: 950;
    cursor: pointer;
    color:#111827;
  }
  .pillBtn.on{
    background:#111827;
    color:#fff;
    border-color:#111827;
  }

  .mainGrid{
    width: 100%;
    padding: 14px 18px;
    display:grid;
    grid-template-columns: 1fr 420px;
    gap: 14px;
    align-items:start;
  }
  .mainGrid.noRight{ grid-template-columns: 1fr; }
  .mainCol{ min-width:0; }
  .rightCol{ position: sticky; top: 12px; display:grid; gap: 12px; height: fit-content; }

  .alert{
    padding: 12px;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #fecaca;
    color: #7f1d1d;
    font-weight: 900;
    box-shadow: 0 10px 28px rgba(0,0,0,.05);
    margin-bottom: 12px;
  }
  .card{
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 22px;
    padding: 14px;
    box-shadow: 0 12px 34px rgba(0,0,0,.06);
  }
  .subCard{
    background: #fff;
    border: 1px solid #eef2f7;
    border-radius: 22px;
    padding: 14px;
    box-shadow: 0 10px 24px rgba(0,0,0,.04);
  }

  .kpiGrid{
    display:grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
  }

  .wideGrid4{
    margin-top: 12px;
    display:grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    align-items:start;
  }

  .twoGrid{
    margin-top: 12px;
    display:grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 12px;
    align-items:start;
  }

  .toggleRow{
    margin-top: 12px;
    display:flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tag{
    font-size: 11px;
    font-weight: 900;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    color: #111827;
    white-space: nowrap;
  }
  .tag.soft{ background: #fff; }

  .muted{ color: #6b7280; font-weight: 800; font-size: 13px; }
  .cap{ text-transform: capitalize; }

  .miniGrid{
    margin-top: 12px;
    display:grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .leadList{ display:grid; gap: 10px; margin-top: 12px; }
  .leadItem{
    padding: 12px;
    border-radius: 18px;
    border: 1px solid #eef2f7;
    background: #f9fafb;
    display:flex;
    justify-content:space-between;
    gap: 12px;
  }
  .leadLeft{ display:flex; gap: 10px; align-items:center; min-width:0; }
  .leadText{ min-width:0; }
  .leadName{
    font-weight: 900;
    color:#111827;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    max-width: 260px;
  }
  .leadMeta{ font-size: 12px; color:#6b7280; font-weight: 800; margin-top: 2px; }
  .leadRight{ display:grid; justify-items:end; gap: 6px; }
  .leadTime{ font-size: 12px; color:#6b7280; font-weight: 900; }
  .leadBtns{ display:flex; gap: 6px; flex-wrap: wrap; justify-content:flex-end; }

  .feed{ display:grid; gap: 10px; margin-top: 12px; }
  .feedItem{
    padding: 12px;
    border-radius: 18px;
    border: 1px solid #eef2f7;
    background: #f9fafb;
  }
  .feedTop{ display:flex; justify-content:space-between; gap: 10px; align-items:flex-start; }
  .feedActor{ display:flex; gap: 10px; align-items:center; }
  .feedName{ font-weight: 900; color:#111827; }
  .feedTime{ font-size: 12px; color:#6b7280; font-weight: 800; }
  .feedText{ margin-top: 8px; font-weight: 800; color:#111827; }

  .filterGrid{
    margin-top: 10px;
    display:grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
    padding: 12px;
    border-radius: 18px;
    background: #f9fafb;
    border: 1px solid #eef2f7;
  }
  .filterBtns{
    display:flex;
    gap: 8px;
    align-items:flex-end;
    justify-content:flex-end;
    grid-column: span 7;
  }
  .input{
    width: 100%;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid #e5e7eb;
    background: #fff;
    outline:none;
    font-weight: 900;
    color:#111827;
  }

  .textarea{
    width: 100%;
    min-height: 180px;
    margin-top: 10px;
    padding: 12px;
    border-radius: 18px;
    border: 1px solid #e5e7eb;
    outline: none;
    font-weight: 850;
    resize: vertical;
  }

  .tableWrap{
    margin-top: 12px;
    border-radius: 18px;
    overflow:auto;
    border: 1px solid #eef2f7;
  }
  .table{
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
    background: #fff;
  }
  .table th{
    text-align:left;
    font-size: 12px;
    color:#6b7280;
    padding: 12px;
    border-bottom: 1px solid #eef2f7;
    background: #fcfcfd;
    position: sticky;
    top: 0;
    z-index: 1;
    font-weight: 900;
  }
  .table td{
    padding: 12px;
    border-bottom: 1px solid #f1f5f9;
    color:#111827;
    font-weight: 900;
  }
  .rowUser{ display:flex; gap: 10px; align-items:center; }
  .rowUserTxt{ display:grid; }
  .rowBtns{ display:flex; gap: 6px; justify-content:flex-end; flex-wrap: wrap; }
  .chipBtn{
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    font-weight: 900;
    cursor: pointer;
    color:#111827;
    font-size: 12px;
  }
  .chipBtn:hover{ background: #eef2ff; border-color: #c7d2fe; }
  .trophy{ margin-left: 6px; }

  .note{
    margin-top: 12px;
    padding: 12px;
    border-radius: 18px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #7c2d12;
    font-weight: 900;
  }

  .toast{
    position: fixed;
    right: 16px;
    bottom: 16px;
    background: #111827;
    color: #fff;
    padding: 12px 14px;
    border-radius: 16px;
    font-weight: 900;
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 18px 55px rgba(0,0,0,.22);
    z-index: 9999;
  }

  .clickable{ cursor: pointer; }
  .clickable:hover{ filter: brightness(.99); }

  .denComfort .card{ padding: 14px; }
  .denCompact .card{ padding: 12px; }
  .denUltra .card{ padding: 10px; }
  .denUltra .tabBtn, .denUltra .actionBtn, .denUltra .btn{ transform: scale(.98); }

  .focusMode .rightCol{ display: none; }
  .focusMode .mainGrid{ grid-template-columns: 1fr; }

  .myDayGrid{
    display:grid;
    grid-template-columns: 1.4fr .8fr .8fr;
    gap: 12px;
  }

  .callGrid{
    display:grid;
    grid-template-columns: 1.4fr .9fr .7fr;
    gap: 12px;
    align-items:start;
  }
  .queueItem{
    padding: 12px;
    border-radius: 18px;
    border: 1px solid #eef2f7;
    background: #f9fafb;
    display:flex;
    justify-content:space-between;
    gap: 12px;
    align-items:center;
  }
  .miniStat{
    padding: 12px;
    border-radius: 18px;
    border: 1px solid #eef2f7;
    background: #fff;
    display:grid;
    gap: 8px;
  }

  /* Accent (tiny touch) */
  .accent-indigo .tabBtn.active{ box-shadow: 0 10px 26px rgba(99,102,241,.18); }
  .accent-emerald .tabBtn.active{ box-shadow: 0 10px 26px rgba(16,185,129,.18); }
  .accent-amber .tabBtn.active{ box-shadow: 0 10px 26px rgba(245,158,11,.18); }
  .accent-rose .tabBtn.active{ box-shadow: 0 10px 26px rgba(244,63,94,.18); }

  /* responsive */
  @media (max-width: 1400px){
    .kpiGrid{ grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .wideGrid4{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .twoGrid{ grid-template-columns: 1fr; }
    .mainGrid{ grid-template-columns: 1fr; }
    .rightCol{ position: static; }
    .filterGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .filterBtns{ grid-column: span 2; }
    .searchWrap{ min-width: min(520px, 100%); }
    .myDayGrid{ grid-template-columns: 1fr; }
    .callGrid{ grid-template-columns: 1fr; }
  }
  @media (max-width: 520px){
    .kpiGrid{ grid-template-columns: 1fr; }
    .miniGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .wideGrid4{ grid-template-columns: 1fr; }
  }
`;
