// client/src/pages/Leads.js
// ✅ SINGLE FILE — paste full (replaces your existing Leads.js)
// ✅ FULL-WIDTH + Sticky Sidebar + Collapsible Nav + Enterprise SaaS layout
// ✅ Dark Mode + Glassmorphism toggle (no libs, no Tailwind required)
// ✅ Advanced UX + Employee/Admin flows + AI Assist (UI-first, backend optional)
// ✅ Keeps your existing endpoints working: /api/leads, /api/leads/:id, /notes, /history, /whatsapp, /target-folder, /targets

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/** ✅ Best practice: keep base endpoint in one place */
const LEADS_URL = "/api/leads";

/* =========================
   THEME TOKENS (Enterprise)
========================= */
const THEME = {
  light: {
    bg:
      "radial-gradient(1100px 680px at 25% -10%, rgba(99,102,241,0.14), transparent 55%), radial-gradient(900px 620px at 85% 10%, rgba(16,185,129,0.12), transparent 55%), #f6f7fb",
    panel: "rgba(255,255,255,0.86)",
    panelSolid: "#ffffff",
    text: "#0b1220",
    muted: "rgba(11,18,32,0.62)",
    border: "rgba(17,24,39,0.12)",
    borderStrong: "rgba(17,24,39,0.22)",
    shadow: "0 18px 60px rgba(0,0,0,0.08)",
    shadowSoft: "0 10px 30px rgba(0,0,0,0.07)",
    accent: "#111827",
    accent2: "#4f46e5",
    success: "#065f46",
    warning: "#9a3412",
    danger: "#991b1b",
    chipBg: "rgba(17,24,39,0.06)",
    chipBorder: "rgba(17,24,39,0.12)",
  },
  dark: {
    bg:
      "radial-gradient(1200px 740px at 30% -10%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(900px 620px at 85% 10%, rgba(16,185,129,0.18), transparent 55%), #070a12",
    panel: "rgba(14,18,30,0.72)",
    panelSolid: "#0e1220",
    text: "#eaf0ff",
    muted: "rgba(234,240,255,0.62)",
    border: "rgba(234,240,255,0.10)",
    borderStrong: "rgba(234,240,255,0.18)",
    shadow: "0 18px 70px rgba(0,0,0,0.50)",
    shadowSoft: "0 10px 30px rgba(0,0,0,0.42)",
    accent: "#eaf0ff",
    accent2: "#a5b4fc",
    success: "#34d399",
    warning: "#fdba74",
    danger: "#fb7185",
    chipBg: "rgba(234,240,255,0.06)",
    chipBorder: "rgba(234,240,255,0.12)",
  },
};

function cssVars(t) {
  return {
    "--bg": t.bg,
    "--panel": t.panel,
    "--panelSolid": t.panelSolid,
    "--text": t.text,
    "--muted": t.muted,
    "--border": t.border,
    "--borderStrong": t.borderStrong,
    "--shadow": t.shadow,
    "--shadowSoft": t.shadowSoft,
    "--accent": t.accent,
    "--accent2": t.accent2,
    "--success": t.success,
    "--warning": t.warning,
    "--danger": t.danger,
    "--chipBg": t.chipBg,
    "--chipBorder": t.chipBorder,
  };
}

/* =========================
   HELPERS
========================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatTimer(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}
function toInputDT(date) {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromInputDT(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function addHours(date, h) {
  const d = new Date(date);
  d.setHours(d.getHours() + h);
  return d;
}
function isToday(date) {
  if (!date) return false;
  const d = new Date(date);
  const t = new Date();
  return d.toDateString() === t.toDateString();
}
function safeStr(x) {
  return String(x || "").toLowerCase().trim();
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function moneyBucket(budget) {
  const s = safeStr(budget);
  if (s.includes("under")) return "low";
  if (s.includes("10k") || s.includes("20k")) return "mid";
  if (s.includes("40k")) return "high";
  if (s.includes("+")) return "high";
  return "mid";
}

/* =========================
   UI PRIMITIVES (Enterprise)
========================= */
function cardStyle({ glass = true } = {}) {
  return {
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 14,
    background: glass ? "var(--panel)" : "var(--panelSolid)",
    boxShadow: "var(--shadowSoft)",
    backdropFilter: glass ? "blur(14px) saturate(160%)" : "none",
  };
}
function subtleCard({ glass = true } = {}) {
  return {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: glass ? "rgba(255,255,255,0.03)" : "transparent",
  };
}
function badgeStyle(type) {
  const base = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    letterSpacing: 0.2,
    border: "1px solid var(--chipBorder)",
    background: "var(--chipBg)",
    color: "var(--text)",
    whiteSpace: "nowrap",
  };
  const map = {
    new: { background: "rgba(79,70,229,0.10)", borderColor: "rgba(79,70,229,0.28)", color: "var(--accent2)" },
    contacted: { background: "rgba(6,182,212,0.10)", borderColor: "rgba(6,182,212,0.25)", color: "rgba(6,182,212,1)" },
    demo: { background: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.28)", color: "var(--warning)" },
    won: { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.25)", color: "var(--success)" },
    lost: { background: "rgba(244,63,94,0.12)", borderColor: "rgba(244,63,94,0.25)", color: "var(--danger)" },
    due: { background: "rgba(17,24,39,0.18)", borderColor: "rgba(17,24,39,0.28)", color: "var(--text)" },
    overdue: { background: "rgba(244,63,94,0.12)", borderColor: "rgba(244,63,94,0.30)", color: "var(--danger)" },
    hot: { background: "rgba(17,24,39,0.18)", borderColor: "rgba(17,24,39,0.28)", color: "var(--text)" },
    warm: { background: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.28)", color: "var(--warning)" },
    cold: { background: "rgba(148,163,184,0.14)", borderColor: "rgba(148,163,184,0.24)", color: "var(--text)" },
    ai: { background: "rgba(167,139,250,0.14)", borderColor: "rgba(167,139,250,0.32)", color: "rgba(167,139,250,1)" },
  };
  const m = map[type] || {};
  return { ...base, ...(m || {}) };
}
function btnStyle(primary = false, danger = false) {
  const bg = danger ? "rgba(244,63,94,0.85)" : primary ? "rgba(17,24,39,0.92)" : "transparent";
  const color = danger ? "#fff" : primary ? "#fff" : "var(--text)";
  const border = danger ? "rgba(244,63,94,0.60)" : primary ? "rgba(17,24,39,0.65)" : "var(--border)";
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontWeight: 950,
    cursor: "pointer",
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    userSelect: "none",
    whiteSpace: "nowrap",
    boxShadow: primary || danger ? "0 14px 28px rgba(0,0,0,0.20)" : "none",
  };
}
function ghostBtn() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 950,
    cursor: "pointer",
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    userSelect: "none",
    whiteSpace: "nowrap",
  };
}
function inputStyle() {
  return {
    height: 42,
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "0 12px",
    outline: "none",
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
  };
}
function selectStyle() {
  return {
    height: 42,
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "0 10px",
    outline: "none",
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
  };
}
function labelStyle() {
  return { display: "grid", gap: 6, fontSize: 13, color: "var(--text)" };
}
function sectionTitle() {
  return { fontWeight: 950, fontSize: 13, marginBottom: 10, color: "var(--text)" };
}

/* =========================
   WhatsApp helpers
========================= */
function normalizePhoneForWA(phone) {
  const p = String(phone || "").replace(/[^\d]/g, "");
  if (!p) return "";
  if (p.length === 10) return `91${p}`;
  return p;
}
function buildWALink(phone, text) {
  const p = normalizePhoneForWA(phone);
  if (!p) return "";
  const msg = encodeURIComponent(text || "");
  return `https://wa.me/${p}?text=${msg}`;
}
function leadUrl(id, suffix = "") {
  const cleanSuffix = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";
  return `${LEADS_URL}/${id}${cleanSuffix}`;
}

/* =========================
   History isolation helpers
========================= */
function last10Digits(x) {
  const p = String(x || "").replace(/[^\d]/g, "");
  return p.length >= 10 ? p.slice(-10) : p;
}

function historyBelongsToLead(h, lead) {
  if (!h || !lead) return false;

  // ✅ 1) LeadId match
  const leadId = lead?._id ? String(lead._id) : "";
  const hLeadId =
    h?.leadId ||
    h?.lead?._id ||
    h?.meta?.leadId ||
    h?.meta?.lead?._id ||
    h?.meta?.lead_id;

  if (leadId && hLeadId && String(hLeadId) === leadId) return true;

  // ✅ 2) Phone/WhatsApp match (last 10 digits)
  const leadPhone10 = last10Digits(lead?.phone);
  const leadWa10 = last10Digits(lead?.whatsapp);

  const hPhone10 = last10Digits(
    h?.phone ||
      h?.meta?.phone ||
      h?.meta?.leadPhone ||
      h?.meta?.contactPhone ||
      h?.meta?.whatsapp ||
      h?.meta?.to ||
      h?.meta?.number
  );

  if (!hPhone10) return false;

  if (leadPhone10 && hPhone10 === leadPhone10) return true;
  if (leadWa10 && hPhone10 === leadWa10) return true;

  return false;
}
/* =========================
   “AI” (offline heuristics)
========================= */
function aiScoreLead(lead) {
  const now = Date.now();
  let score = 40;

  const status = safeStr(lead?.status);
  if (status === "demo") score += 20;
  if (status === "contacted") score += 10;
  if (status === "won") score = 100;
  if (status === "lost") score = 5;

  const fu = lead?.nextFollowUp ? new Date(lead.nextFollowUp).getTime() : null;
  if (fu) {
    const diff = fu - now;
    if (diff < 0) score += 18; // overdue
    else if (diff < 2 * 60 * 60 * 1000) score += 12;
    else if (diff < 24 * 60 * 60 * 1000) score += 8;
  }

  const src = safeStr(lead?.source);
  if (src.includes("google")) score += 8;
  if (src.includes("website")) score += 6;
  if (src.includes("walk")) score += 4;
  if (src.includes("ref")) score += 8;

  const budget = moneyBucket(lead?.budget || "");
  if (budget === "high") score += 12;
  if (budget === "mid") score += 6;

  const city = safeStr(lead?.city);
  if (city) score += 2;

  return clamp(score, 0, 100);
}
function aiTempTag(score) {
  if (score >= 75) return "hot";
  if (score >= 55) return "warm";
  return "cold";
}
function aiNextAction(lead) {
  const score = aiScoreLead(lead);
  const tag = aiTempTag(score);
  const status = safeStr(lead?.status);
  const fu = lead?.nextFollowUp ? new Date(lead.nextFollowUp) : null;
  const overdue = fu && fu.getTime() < Date.now() && !["won", "lost"].includes(status);

  if (status === "won") return { tag: "won", text: "Send onboarding + payment receipt." };
  if (status === "lost") return { tag: "lost", text: "Try re-engagement after 7 days with new offer." };
  if (overdue) return { tag: "overdue", text: "Overdue follow-up. Call now + WhatsApp reminder." };
  if (status === "new") return { tag, text: "Call within 15 mins. If no pickup: WhatsApp + schedule follow-up." };
  if (status === "contacted") return { tag, text: "Qualify needs + share fee & batch options + set demo." };
  if (status === "demo") return { tag, text: "Confirm demo time + send joining benefits + close for enrollment." };
  return { tag, text: "Do next follow-up + update stage." };
}
function aiCallScript(lead) {
  const name = lead?.name || "Customer";
  const course = lead?.course || lead?.product || "our service";
  const city = lead?.city || "";

  return (
    "Opening:\n" +
    `Hi ${name}, main SUDO24 se bol raha/rahi hoon. Aapne ${course} ke liye enquiry ki thi.\n\n` +
    "Qualify (3 Qs):\n" +
    "1) Aapka goal kya hai? (Purchase / Service / Consultation)\n" +
    `2) Aap Online / Offline prefer karte ho? ${city ? `(${city})` : ""}\n` +
    "3) Aapka budget / timeline kya hai?\n\n" +
    "Pitch:\n" +
    "Hum practical support + clear process + fast response dete hain.\n\n" +
    "Close:\n" +
    "Aapke liye aaj shaam ya kal kaunsa time best rahega?"
  );
}
function aiGenerateWhatsApp(lead, variant = "followup") {
  const name = lead?.name || "";
  const course = lead?.course || "course";
  const source = lead?.source || "your enquiry";
  const batch = lead?.batch || "Evening";
  const mode = lead?.mode || "Online";

  if (variant === "no_pick") {
    return (
      `Hi ${name}, SUDO24 Learning se baat kar rahe hain.\n` +
      `Aapka call miss ho gaya. Aap ${course} ke liye interested ho?\n` +
      `Aaj aapko kab call karun? (Time bata do)\n` +
      `Mode: ${mode} • Batch: ${batch}`
    );
  }

  if (variant === "demo_confirm") {
    return (
      `Hi ${name} 👋\n` +
      `${course} demo confirm karna tha.\n` +
      `Aapke liye demo time kya best rahega? (Today/Tomorrow)\n` +
      `Mode: ${mode} • Batch: ${batch}`
    );
  }

  if (variant === "fee") {
    return (
      `Hi ${name}, ${course} ke fee + batch details share kar raha/rahi hoon.\n` +
      `Aapka preferred budget range kya hai?\n` +
      `Aap Online/Offline me se kya prefer karte ho?`
    );
  }

  return (
    `Hi ${name}, SUDO24 Learning se baat kar rahe hain.\n` +
    `Aapke ${source} par follow-up.\n` +
    `Aap ${course} me interested ho?\n` +
    `Mode: ${mode} • Batch: ${batch}`
  );
}



/* =========================
   CSV Export (client-side)
========================= */
function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   MAIN COMPONENT
========================= */

export default function Leads() {
  const { api, user } = useAuth();

  // Enterprise shell toggles
  const [theme, setTheme] = useState("light"); // light | dark
  const [glassOn, setGlassOn] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // global msg
  const [msg, setMsg] = useState("");

  // list
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  // view modes
  const [viewMode, setViewMode] = useState("list"); // list | kanban
  const [dense, setDense] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);

  // advanced filters
  const [aiHotOnly, setAiHotOnly] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("all");

  // Employee/Admin
  const isEmployee = user?.role === "employee";
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";
  const [myOnly, setMyOnly] = useState(isEmployee ? true : false);
  const [showMineQuick, setShowMineQuick] = useState(false);

  // bulk
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Disposition
  const DISPOSITIONS = ["Interested", "Call back", "Not interested", "Wrong number", "Already enrolled"];
  const [disp, setDisp] = useState("");

  // Create lead modal
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({
    industry: "Education",
    name: "",
    phone: "",
    whatsapp: "",
    whatsappSame: true,
    email: "",
    city: "",
    course: "",
    courseOther: "",
    source: "Instagram",
    budget: "Under 10k",
    mode: "Online",
    batch: "Evening",
    status: "new",
    nextFollowUp: "",
    note: "",
  });

  // After Call panel
  const [afterCallOpenId, setAfterCallOpenId] = useState("");
  const [afterCallOutcome, setAfterCallOutcome] = useState("");
  const [afterCallNote, setAfterCallNote] = useState("");
  const [afterCallFollowUp, setAfterCallFollowUp] = useState("");
  const [saveHot, setSaveHot] = useState(false);

  // timer
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef(null);

  // demo popup
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoDT, setDemoDT] = useState(() => {
    const d = addHours(new Date(), 24);
    d.setMinutes(0);
    return toInputDT(d);
  });

  // history drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyErr, setHistoryErr] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Target folder
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetErr, setTargetErr] = useState("");
  const [targetGroups, setTargetGroups] = useState([]);

  // Target dashboard
  const [dashOpen, setDashOpen] = useState(false);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashErr, setDashErr] = useState("");
  const [dashData, setDashData] = useState(null);

  const [tgGroupBy, setTgGroupBy] = useState("week"); // day|week|month
  const [tgCreatedBy, setTgCreatedBy] = useState("all"); // admin/manager only
  const [tgFrom, setTgFrom] = useState(() => {
    const n = new Date();
    return toInputDT(new Date(n.getFullYear(), n.getMonth(), 1));
  });
  const [tgTo, setTgTo] = useState(() => {
    const n = new Date();
    return toInputDT(new Date(n.getFullYear(), n.getMonth() + 1, 1));
  });

  // AI Assist drawer
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLead, setAiLead] = useState(null);
  const [aiVariant, setAiVariant] = useState("followup");
  const [aiText, setAiText] = useState("");
  const [aiScript, setAiScript] = useState("");
  const [aiAction, setAiAction] = useState("");

  // Admin assign drawer
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLead, setAssignLead] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [assignTo, setAssignTo] = useState("");

  // Pagination
  const [limit, setLimit] = useState(40);

  const activeLead = useMemo(
    () => (afterCallOpenId ? leads.find((x) => x._id === afterCallOpenId) : null),
    [afterCallOpenId, leads]
  );

  /* =========================
     LOADERS
  ========================= */
  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await api.get(LEADS_URL);
      setLeads(res.data || []);
    } catch (err) {
      setMsg(err?.response?.data?.message || "Error loading leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTeamUsers = async () => {
    if (!isAdminOrManager) return;
    try {
      const res = await api.get("/api/users");
      const arr = Array.isArray(res.data) ? res.data : res.data?.users || [];
      setTeamUsers(arr || []);
    } catch {
      setTeamUsers([]);
    }
  };

  const loadTargetFolder = async () => {
    setTargetErr("");
    setTargetLoading(true);
    try {
      const res = await api.get(`${LEADS_URL}/target-folder`);
      setTargetGroups(res.data?.groups || []);
    } catch (err) {
      setTargetErr(err?.response?.data?.message || "Target folder not available (backend add required)");
    } finally {
      setTargetLoading(false);
    }
  };

  const loadTargetDashboard = async () => {
    setDashErr("");
    setDashLoading(true);
    try {
      const from = fromInputDT(tgFrom);
      const to = fromInputDT(tgTo);

      const params = new URLSearchParams();
      if (from) params.set("from", from.toISOString());
      if (to) params.set("to", to.toISOString());
      params.set("groupBy", tgGroupBy);

      if (isAdminOrManager) params.set("createdBy", tgCreatedBy || "all");

      const res = await api.get(`${LEADS_URL}/targets?${params.toString()}`);
      setDashData(res.data || null);
    } catch (err) {
      setDashErr(err?.response?.data?.message || "Target dashboard not available (backend add required)");
      setDashData(null);
    } finally {
      setDashLoading(false);
    }
  };

  const presetThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    mon.setHours(0, 0, 0, 0);
    const nextMon = new Date(mon);
    nextMon.setDate(mon.getDate() + 7);
    setTgFrom(toInputDT(mon));
    setTgTo(toInputDT(nextMon));
  };

  const presetThisMonth = () => {
    const n = new Date();
    const f = new Date(n.getFullYear(), n.getMonth(), 1);
    const t = new Date(n.getFullYear(), n.getMonth() + 1, 1);
    setTgFrom(toInputDT(f));
    setTgTo(toInputDT(t));
  };

  /* =========================
     CREATE LEAD
  ========================= */
  const saveLeadFromModal = async (e) => {
    e.preventDefault();
    setMsg("");

    const name = create.name.trim();
    const phone = create.phone.trim();
    if (!name) return setMsg("Student name required");
    if (!phone) return setMsg("Phone required");

    const whatsapp = create.whatsappSame ? phone : create.whatsapp.trim();
    const courseFinal = create.course === "Other" ? create.courseOther.trim() || "Other" : create.course || "";

    try {
      const payload = {
        name,
        phone,
        email: create.email.trim(),
        city: create.city.trim(),
        status: create.status,
        course: courseFinal,
        source: create.source,
        budget: create.budget,
        mode: create.mode,
        batch: create.batch,
        whatsapp,
      };

      const fu = fromInputDT(create.nextFollowUp);
      if (fu) payload.nextFollowUp = fu.toISOString();

      const res = await api.post(LEADS_URL, payload);

      const leadId = res?.data?._id;
      const educationNoteParts = [
        `WhatsApp: ${whatsapp || "-"}`,
        `Course: ${courseFinal || "-"}`,
        `Source: ${create.source || "-"}`,
        `Budget: ${create.budget || "-"}`,
        `Mode: ${create.mode || "-"}`,
        `Batch: ${create.batch || "-"}`,
        create.note?.trim() ? `Note: ${create.note.trim()}` : "",
      ].filter(Boolean);

      if (leadId && educationNoteParts.length) {
        try {
          await api.post(leadUrl(leadId, "notes"), { text: educationNoteParts.join(" | ") });
        } catch {}
      }

      setCreateOpen(false);
      setCreate({
        industry: "Education",
        name: "",
        phone: "",
        whatsapp: "",
        whatsappSame: true,
        email: "",
        city: "",
        course: "",
        courseOther: "",
        source: "Instagram",
        budget: "Under 10k",
        mode: "Online",
        batch: "Evening",
        status: "new",
        nextFollowUp: "",
        note: "",
      });

      setMsg("✅ Lead created");
      await load();
      if (targetOpen) await loadTargetFolder();
      if (dashOpen) await loadTargetDashboard();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Create error");
    }
  };

  /* =========================
     UPDATE HELPERS
  ========================= */
  const patchLead = async (leadId, payload) => {
    await api.patch(leadUrl(leadId), payload);
  };

  const quickStatus = async (leadId, status) => {
    setMsg("");
    try {
      await patchLead(leadId, { status });
      setMsg(`✅ Marked ${status}`);
      await load();
      if (targetOpen) await loadTargetFolder();
      if (dashOpen) await loadTargetDashboard();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Update error");
    }
  };

  /* =========================
     AFTER CALL PANEL
  ========================= */
  const openAfterCall = (lead) => {
    setMsg("");
    setAfterCallOpenId(lead._id);
    setAfterCallOutcome("");
    setAfterCallNote("");
    setAfterCallFollowUp("");
    setSaveHot(false);
    setDisp("");

    setDemoOpen(false);
    const d = addHours(new Date(), 24);
    d.setMinutes(0);
    setDemoDT(toInputDT(d));

    const start = new Date();
    setCallStartedAt(start);
    setElapsedMs(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - start.getTime()), 1000);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeAfterCall = () => {
    setAfterCallOpenId("");
    setAfterCallOutcome("");
    setAfterCallNote("");
    setAfterCallFollowUp("");
    setSaveHot(false);
    setDemoOpen(false);
    setDisp("");
    setCallStartedAt(null);
    setElapsedMs(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, []);

  const onOutcomeChange = (val) => {
    setAfterCallOutcome(val);
    setSaveHot(false);
    const now = new Date();

    if (val === "Not picked") {
      setAfterCallFollowUp(toInputDT(addHours(now, 2)));
      setSaveHot(true);
      setDemoOpen(false);
    } else if (val === "Busy") {
      setAfterCallFollowUp(toInputDT(addHours(now, 1)));
      setDemoOpen(false);
      setSaveHot(true);
    } else if (val === "Connected") {
      setDemoOpen(true);
    } else {
      setDemoOpen(false);
    }
  };

  const snoozeFollowup = (hours) => {
    const now = new Date();
    setAfterCallFollowUp(toInputDT(addHours(now, hours)));
    setSaveHot(true);
  };

  const confirmDemoSchedule = () => {
    const dt = fromInputDT(demoDT);
    if (!dt) return setMsg("Select demo date/time");
    setAfterCallFollowUp(toInputDT(dt));
    setDemoOpen(false);
    setSaveHot(true);
  };

  const onDispositionPick = (val) => {
    setDisp(val);
    if (!val) return;
    const text = `Disposition: ${val}`;
    setAfterCallNote((prev) => {
      const p = (prev || "").trim();
      if (!p) return text;
      if (p.toLowerCase().includes("disposition:")) return prev;
      return `${text} • ${p}`;
    });
    setSaveHot(true);
  };

  const saveAfterCall = async () => {
    if (!activeLead) return;
    setMsg("");
    try {
      const payload = {industry: create.industry,};
      const fu = fromInputDT(afterCallFollowUp);

      if (afterCallOutcome === "Connected") payload.status = "demo";
      else if (afterCallOutcome === "Busy" || afterCallOutcome === "Not picked") {
        if ((activeLead.status || "new") === "new") payload.status = "contacted";
      }

      if (fu) payload.nextFollowUp = fu.toISOString();
      await patchLead(activeLead._id, payload);

      const noteText = afterCallNote?.trim();
      if (noteText) {
        try {
          await api.post(leadUrl(activeLead._id, "notes"), { text: noteText });
        } catch {}
      }

      const duration = callStartedAt ? formatTimer(elapsedMs) : "00:00";
      setMsg(`✅ Saved. Outcome: ${afterCallOutcome || "-"} • Duration: ${duration}`);
      setSaveHot(false);
      await load();
      if (targetOpen) await loadTargetFolder();
      if (dashOpen) await loadTargetDashboard();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Save error");
    }
  };

  /* =========================
     WHATSAPP / COPY
  ========================= */
  // ✅ WhatsApp / Copy (FIXED)
const openWhatsApp = async (lead, variant = "followup") => {
  const phone = lead?.phone || "";
  if (!phone) return setMsg("Phone missing for WhatsApp");

  const templateText = aiGenerateWhatsApp(lead, variant);
  const link = buildWALink(phone, templateText);
  if (link) window.open(link, "_blank");

  try {
    await api.post(leadUrl(lead._id, "whatsapp"), {
      templateName: `ai_${variant}`,
      messageText: templateText,
    });
  } catch {}
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    setMsg("✅ Copied");
    setTimeout(() => setMsg(""), 1200);
  } catch {
    setMsg("Copy failed");
    setTimeout(() => setMsg(""), 1200);
  }
};

  /* =========================
     BULK
  ========================= */
  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const clearSelection = () => setSelectedIds([]);

  const bulkLeads = useMemo(() => {
    const map = new Map(leads.map((l) => [l._id, l]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [selectedIds, leads]);

  const bulkWhatsApp = async (variant) => {
    if (selectedIds.length === 0) return setMsg("Select leads first");
    const list = bulkLeads.slice(0, 5); // prevent popup blocking
    if (list.length === 0) return setMsg("No leads selected");
    setMsg(`Opening WhatsApp for ${list.length} leads (max 5)`);
    for (const l of list) {
      await new Promise((r) => setTimeout(r, 250));
      openWhatsApp(l, variant);
    }
  };

 /* =========================
/* =========================
   HISTORY
========================= */
const openHistory = async (lead) => {
  setHistoryOpen(true);
  setHistoryLead(lead);
  setHistoryItems([]);
  setHistoryErr("");
  setHistoryLoading(true);

  try {
    const res = await api.get(leadUrl(lead._id, "history"));
    const items = Array.isArray(res.data) ? res.data : [];

    // ✅ FIX: sirf isi lead ki history rakho
    const filteredItems = items.filter((h) => historyBelongsToLead(h, lead));
    setHistoryItems(filteredItems);
  } catch (err) {
    setHistoryErr(err?.response?.data?.message || "History not available (backend add required)");
  } finally {
    setHistoryLoading(false);
  }
};

const closeHistory = () => {
  setHistoryOpen(false);
  setHistoryLead(null);
  setHistoryItems([]);
  setHistoryErr("");
  setHistoryLoading(false);
};
  /* =========================
     AI DRAWER
  ========================= */
  const openAI = (lead) => {
    setAiLead(lead);
    setAiVariant("followup");
    setAiText(aiGenerateWhatsApp(lead, "followup"));
    setAiScript(aiCallScript(lead));
    const act = aiNextAction(lead);
    setAiAction(`${act.text}`);
    setAiOpen(true);
  };

  /* =========================
     ASSIGN (Admin)
  ========================= */
  const openAssign = async (lead) => {
    setAssignLead(lead);
    setAssignTo("");
    setAssignOpen(true);
    await loadTeamUsers();
  };

  const saveAssign = async () => {
    if (!assignLead) return;
    if (!assignTo) return setMsg("Select team member first");
    setMsg("");
    try {
      await patchLead(assignLead._id, { assignedTo: assignTo });
      setMsg("✅ Assigned");
      setAssignOpen(false);
      await load();
    } catch {
      setMsg("Assign not available (backend add required)");
    }
  };

  /* =========================
     STATS + FILTERS
  ========================= */
  const todayNewLeads = useMemo(() => {
    const t = new Date();
    return leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === t.toDateString()).length;
  }, [leads]);

  const todayFollowups = useMemo(() => leads.filter((l) => isToday(l.nextFollowUp)).length, [leads]);

  const pendingFollowups = useMemo(() => {
    const now = Date.now();
    return leads.filter(
      (l) => l.nextFollowUp && new Date(l.nextFollowUp).getTime() < now && !["won", "lost"].includes(l.status)
    ).length;
  }, [leads]);

  const myStats = useMemo(() => {
    const meId = user?._id;
    if (!meId) return { total: 0, dueToday: 0, overdue: 0, hot: 0 };
    const mine = leads.filter(
      (l) =>
        String(l.createdBy?._id || l.createdBy) === String(meId) ||
        String(l.assignedTo?._id || l.assignedTo) === String(meId)
    );
    const dueToday = mine.filter((l) => isToday(l.nextFollowUp)).length;
    const overdue = mine.filter(
      (l) =>
        l.nextFollowUp &&
        new Date(l.nextFollowUp).getTime() < Date.now() &&
        !["won", "lost"].includes(l.status)
    ).length;
    const hot = mine.filter((l) => aiTempTag(aiScoreLead(l)) === "hot" && !["won", "lost"].includes(l.status)).length;
    return { total: mine.length, dueToday, overdue, hot };
  }, [leads, user?._id]);

  const sources = useMemo(() => {
    return uniq(leads.map((l) => l.source).filter(Boolean)).sort((a, b) => String(a).localeCompare(String(b)));
  }, [leads]);

  const filteredAll = useMemo(() => {
    const query = safeStr(q);
    const meId = user?._id ? String(user._id) : "";

    return leads.filter((l) => {
      if (myOnly && meId) {
        const createdById = String(l.createdBy?._id || l.createdBy || "");
        const assignedToId = String(l.assignedTo?._id || l.assignedTo || "");
        if (createdById !== meId && assignedToId !== meId) return false;
      }

      if (statusFilter !== "all" && l.status !== statusFilter) return false;

      if (sourceFilter !== "all") {
        if (safeStr(l.source) !== safeStr(sourceFilter)) return false;
      }

      if (todayOnly && !isToday(l.nextFollowUp)) return false;

      if (pendingOnly) {
        if (!l.nextFollowUp) return false;
        const isOver = new Date(l.nextFollowUp).getTime() < Date.now();
        if (!isOver) return false;
        if (["won", "lost"].includes(l.status)) return false;
      }

      const score = aiScoreLead(l);
      if (aiHotOnly && aiTempTag(score) !== "hot") return false;
      if (score < Number(scoreMin || 0)) return false;

      if (!query) return true;

      const hay = [
        l.name,
        l.phone,
        l.city,
        l.email,
        l.course,
        l.source,
        l.assignedTo?.name,
        l.assignedTo?.email,
        l.createdBy?.name,
        l.createdBy?.email,
      ]
        .map(safeStr)
        .join(" ");

      return hay.includes(query);
    });
  }, [leads, q, statusFilter, todayOnly, pendingOnly, myOnly, user?._id, aiHotOnly, scoreMin, sourceFilter]);

  const filtered = useMemo(() => {
    const arr = [...filteredAll];
    arr.sort((a, b) => {
      const aFu = a?.nextFollowUp ? new Date(a.nextFollowUp).getTime() : Infinity;
      const bFu = b?.nextFollowUp ? new Date(b.nextFollowUp).getTime() : Infinity;
      const aOver = aFu < Date.now() && !["won", "lost"].includes(a?.status);
      const bOver = bFu < Date.now() && !["won", "lost"].includes(b?.status);
      if (aOver !== bOver) return aOver ? -1 : 1;
      const aS = aiScoreLead(a);
      const bS = aiScoreLead(b);
      if (aS !== bS) return bS - aS;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
    return arr;
  }, [filteredAll]);

  const paged = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  useEffect(() => {
    if (isEmployee && !showMineQuick) {
      setMyOnly(true);
      setShowMineQuick(true);
    }
  }, [isEmployee, showMineQuick]);

  /* =========================
     KEYBOARD SHORTCUTS
  ========================= */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("leadSearchBox");
        if (el) el.focus();
      }

      // ✅ Ctrl/Cmd + B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (sidebarHidden) setSidebarHidden(false); // ✅ open if hidden
        else setSidebarCollapsed((s) => !s);        // ✅ otherwise collapse toggle
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setTheme((t) => (t === "dark" ? "light" : "dark"));
      }

      if (e.key === "Escape") {
        setAiOpen(false);
        setAssignOpen(false);
        setCreateOpen(false);
        setHistoryOpen(false);
        closeAfterCall();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarHidden]);

  /* =========================
     KANBAN
  ========================= */
  const KANBAN = useMemo(
    () => [
      { key: "new", title: "New" },
      { key: "contacted", title: "Contacted" },
      { key: "demo", title: "Demo" },
      { key: "won", title: "Won" },
      { key: "lost", title: "Lost" },
    ],
    []
  );

  const kanbanGroups = useMemo(() => {
    const g = {};
    for (const c of KANBAN) g[c.key] = [];
    for (const l of filtered) {
      const k = g[l.status] ? l.status : "new";
      g[k].push(l);
    }
    return g;
  }, [filtered, KANBAN]);

  /* =========================
     SHELL STYLES
  ========================= */
  const t = THEME[theme] || THEME.light;

  const shell = {
  ...cssVars(t),
  width: "100vw",               // ✅ full screen width
  position: "relative",         // ✅ break out of parent container
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  boxSizing: "border-box",
};

  const layout = {
    display: "grid", // ✅ IMPORTANT
    gridTemplateColumns: sidebarHidden ? "1fr" : (sidebarCollapsed ? "72px 1fr" : "300px 1fr"),
    gap: 14,
    padding: 14,
    boxSizing: "border-box",
    alignItems: "start",
  };

  const sidebar = {
    position: "sticky",
    top: 14,
    alignSelf: "start",
    height: "calc(100vh - 28px)",
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid var(--border)",
    background: glassOn ? "var(--panel)" : "var(--panelSolid)",
    backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
    boxShadow: "var(--shadowSoft)",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
  };

  const content = {
    display: "grid",
    gap: 14,
    minWidth: 0,
  };

  const navItem = (active = false) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${active ? "var(--borderStrong)" : "transparent"}`,
    background: active ? "rgba(79,70,229,0.10)" : "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 950,
    userSelect: "none",
  });

  const topBar = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div style={shell}>
      {/* ✅ Open Sidebar button (shows only when hidden) */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebarHidden(false)}
          style={{
            position: "fixed",
            left: 16,
            top: 16,
            zIndex: 99999,
            background: "var(--panelSolid)",
            color: "var(--text)",
            border: "1px solid var(--borderStrong)",
            borderRadius: 14,
            padding: "10px 12px",
            fontWeight: 950,
            boxShadow: "var(--shadow)",
            cursor: "pointer",
          }}
          title="Open Sidebar"
        >
          ☰ Open Sidebar
        </button>
      )}

      {/* ✅ Global CSS (scrollbars / inputs) */}
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: rgba(99,102,241,0.22); }
        a { color: inherit; }
        input, select, textarea { color-scheme: ${theme === "dark" ? "dark" : "light"}; }
        /* Scrollbar (WebKit) */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.28); border-radius: 999px; border: 2px solid rgba(0,0,0,0); background-clip: padding-box; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0); }
      `}</style>

      <div style={layout}>
        {/* ================= SIDEBAR ================= */}
        {!sidebarHidden ? (
          <aside style={sidebar}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(79,70,229,0.14)",
                    border: "1px solid rgba(79,70,229,0.24)",
                    fontWeight: 950,
                  }}
                  title="Enterprise CRM"
                >
                  ⚡
                </div>

                {!sidebarCollapsed ? (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, letterSpacing: -0.2, lineHeight: 1.1 }}>Leads CRM</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Enterprise • Sticky • AI Assist
                    </div>
                  </div>
                ) : null}

                {/* ✅ RIGHT SIDE BUTTONS (fixed) */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((s) => !s)}
                    style={{ ...ghostBtn(), height: 38, padding: "8px 10px" }}
                    title="Collapse (Ctrl/Cmd + B)"
                  >
                    {sidebarCollapsed ? "➡️" : "⬅️"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarHidden(true)}
                    style={{ ...ghostBtn(), height: 38, padding: "8px 10px" }}
                    title="Close Sidebar"
                  >
                    ✖️
                  </button>
                </div>
              </div>

              {!sidebarCollapsed ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={badgeStyle("ai")}>AI Assist</span>
                  <span style={badgeStyle(isEmployee ? "contacted" : "new")}>
                    {isEmployee ? "Employee" : isAdminOrManager ? "Admin/Manager" : user?.role || "User"}
                  </span>
                </div>
              ) : null}
            </div>

            <div style={{ padding: 12, overflowY: "auto" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={navItem(true)}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  title="Leads"
                >
                  📌 {!sidebarCollapsed ? "Leads" : null}
                  {!sidebarCollapsed ? (
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                      {leads.length}
                    </span>
                  ) : null}
                </div>

                <div
                  style={navItem(targetOpen)}
                  onClick={async () => {
                    const next = !targetOpen;
                    setTargetOpen(next);
                    if (next) await loadTargetFolder();
                  }}
                  title="Target Folder"
                >
                  🎯 {!sidebarCollapsed ? "Target Folder" : null}
                </div>

                <div
                  style={navItem(dashOpen)}
                  onClick={async () => {
                    const next = !dashOpen;
                    setDashOpen(next);
                    if (next) await loadTargetDashboard();
                  }}
                  title="Target Dashboard"
                >
                  📊 {!sidebarCollapsed ? "Target Dashboard" : null}
                </div>

                <div style={{ marginTop: 10, ...subtleCard({ glass: glassOn }) }}>
                  {!sidebarCollapsed ? (
                    <>
                      <div style={{ fontWeight: 950 }}>Today Snapshot</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                        <div>
                          New: <b style={{ color: "var(--text)" }}>{todayNewLeads}</b>
                        </div>
                        <div>
                          Due Today: <b style={{ color: "var(--text)" }}>{todayFollowups}</b>
                        </div>
                        <div>
                          Overdue: <b style={{ color: "var(--text)" }}>{pendingFollowups}</b>
                        </div>

                        {isEmployee ? (
                          <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                            <div>
                              My Total: <b style={{ color: "var(--text)" }}>{myStats.total}</b>
                            </div>
                            <div>
                              My Due: <b style={{ color: "var(--text)" }}>{myStats.dueToday}</b>
                            </div>
                            <div>
                              My Overdue: <b style={{ color: "var(--text)" }}>{myStats.overdue}</b>
                            </div>
                            <div>
                              My Hot: <b style={{ color: "var(--text)" }}>{myStats.hot}</b>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "grid", gap: 8 }}>
                      <div title="New">{todayNewLeads}🆕</div>
                      <div title="Due">{todayFollowups}⏰</div>
                      <div title="Overdue">{pendingFollowups}⚠️</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setTheme((x) => (x === "dark" ? "light" : "dark"))}
                  style={ghostBtn()}
                  title="Toggle Dark (Ctrl/Cmd + D)"
                >
                  {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
                <button onClick={() => setGlassOn((s) => !s)} style={ghostBtn()} title="Glassmorphism">
                  {glassOn ? "🫧 Glass ON" : "🧱 Glass OFF"}
                </button>
              </div>

              {!sidebarCollapsed ? (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>
                  Shortcuts: <b>Ctrl/⌘+K</b> search • <b>Ctrl/⌘+B</b> sidebar • <b>Ctrl/⌘+D</b> theme • <b>Esc</b> close
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}

        {/* ================= CONTENT ================= */}
        <main style={content}>
          {/* Top Header Card */}
          <div style={cardStyle({ glass: glassOn })}>
            <div style={topBar}>
              <div style={{ minWidth: 280 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, letterSpacing: -0.3 }}>Leads Workspace</h2>
                  <span style={badgeStyle("ai")}>AI Assist</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    Full-width • Enterprise layout • Sticky sidebar
                  </span>
                </div>

                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
                  Today New: <b style={{ color: "var(--text)" }}>{todayNewLeads}</b> • Today Follow-ups:{" "}
                  <b style={{ color: "var(--text)" }}>{todayFollowups}</b> • Pending:{" "}
                  <b style={{ color: "var(--text)" }}>{pendingFollowups}</b>
                  {isEmployee ? (
                    <>
                      {" "}
                      • My Total: <b style={{ color: "var(--text)" }}>{myStats.total}</b> • My Due:{" "}
                      <b style={{ color: "var(--text)" }}>{myStats.dueToday}</b> • My Overdue:{" "}
                      <b style={{ color: "var(--text)" }}>{myStats.overdue}</b> • My Hot:{" "}
                      <b style={{ color: "var(--text)" }}>{myStats.hot}</b>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setCreateOpen(true)} style={btnStyle(true)}>
                  ➕ Add Lead
                </button>

                <button
                  onClick={() => setMyOnly((s) => !s)}
                  style={{
                    ...btnStyle(false),
                    borderColor: myOnly ? "var(--borderStrong)" : "var(--border)",
                    background: myOnly ? "rgba(17,24,39,0.20)" : "transparent",
                  }}
                  title="Only my leads (created/assigned)"
                >
                  👤 {myOnly ? "My Leads: ON" : "My Leads: OFF"}
                </button>

                <button
                  onClick={() => setViewMode((v) => (v === "list" ? "kanban" : "list"))}
                  style={ghostBtn()}
                  title="Switch view"
                >
                  {viewMode === "list" ? "🧩 Kanban" : "📋 List"}
                </button>

                <button onClick={() => setDense((s) => !s)} style={ghostBtn()} title="Dense layout">
                  {dense ? "↔️ Comfortable" : "↕️ Dense"}
                </button>

                <button
                  onClick={() => {
                    setBulkMode((s) => !s);
                    clearSelection();
                  }}
                  style={ghostBtn()}
                  title="Select multiple leads"
                >
                  ✅ {bulkMode ? "Exit Bulk" : "Bulk"}
                </button>

                <button onClick={load} style={ghostBtn()}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  onClick={() => {
                    const rows = [
                      ["Name", "Phone", "Email", "City", "Status", "NextFollowUp", "Source", "Course", "AssignedTo", "CreatedAt", "Score"],
                      ...filtered.map((l) => [
                        l.name,
                        l.phone,
                        l.email,
                        l.city,
                        l.status,
                        l.nextFollowUp ? new Date(l.nextFollowUp).toISOString() : "",
                        l.source,
                        l.course,
                        l.assignedTo?.name || "",
                        l.createdAt ? new Date(l.createdAt).toISOString() : "",
                        aiScoreLead(l),
                      ]),
                    ];
                    downloadCSV(`leads_export_${Date.now()}.csv`, rows);
                    setMsg("✅ Exported CSV (filtered)");
                  }}
                  style={ghostBtn()}
                  title="Export filtered"
                >
                  ⬇️ Export
                </button>
              </div>
            </div>

            {msg ? (
              <div style={{ marginTop: 12, ...subtleCard({ glass: glassOn }) }}>
                <div style={{ fontWeight: 900 }}>{msg}</div>
              </div>
            ) : null}

            {/* Filters */}
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  id="leadSearchBox"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search: name / phone / city / email / course / source"
                  style={{ ...inputStyle(), flex: "1 1 340px", height: 40 }}
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ height: 40, borderRadius: 12, border: "1px solid var(--border)", padding: "0 10px", background: "rgba(255,255,255,0.04)", color: "var(--text)" }}
                >
                  <option value="all">All Stages</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="demo">Demo</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  style={{ height: 40, borderRadius: 12, border: "1px solid var(--border)", padding: "0 10px", minWidth: 160, background: "rgba(255,255,255,0.04)", color: "var(--text)" }}
                >
                  <option value="all">All Sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                  <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />
                  Today Follow-ups
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                  <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
                  Pending
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }} title="Only show AI Hot leads">
                  <input type="checkbox" checked={aiHotOnly} onChange={(e) => setAiHotOnly(e.target.checked)} />
                  AI Hot
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }} title="Minimum AI score">
                  <span style={{ fontSize: 12 }}>Score ≥</span>
                  <input
                    type="number"
                    value={scoreMin}
                    min={0}
                    max={100}
                    onChange={(e) => setScoreMin(e.target.value)}
                    style={{ height: 40, width: 90, borderRadius: 12, border: "1px solid var(--border)", padding: "0 10px", background: "rgba(255,255,255,0.04)", color: "var(--text)" }}
                  />
                </label>

                <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                  Role: <b style={{ color: "var(--text)" }}>{user?.role || "-"}</b>
                  {isAdminOrManager ? " • Team controls enabled" : ""}
                  {" • "}Showing <b style={{ color: "var(--text)" }}>{paged.length}</b> /{" "}
                  <b style={{ color: "var(--text)" }}>{filtered.length}</b> (loaded: {limit})
                </div>
              </div>

              {/* Quick chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setPendingOnly(true);
                    setTodayOnly(false);
                  }}
                  style={ghostBtn()}
                  title="Overdue first (already sorted)"
                >
                  ⚠️ Focus Overdue
                </button>
                <button
                  onClick={() => {
                    setAiHotOnly(true);
                    setScoreMin(70);
                  }}
                  style={ghostBtn()}
                >
                  🔥 Focus Hot (70+)
                </button>
                <button
                  onClick={() => {
                    setQ("");
                    setStatusFilter("all");
                    setTodayOnly(false);
                    setPendingOnly(false);
                    setAiHotOnly(false);
                    setScoreMin(0);
                    setSourceFilter("all");
                    setLimit(40);
                    setMsg("✅ Filters reset");
                    setTimeout(() => setMsg(""), 900);
                  }}
                  style={ghostBtn()}
                >
                  ♻️ Reset
                </button>
              </div>
            </div>
          </div>

          {/* ✅ Bulk action bar */}
          {bulkMode ? (
            <div style={cardStyle({ glass: glassOn })}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 950 }}>
                  Bulk Mode • Selected: <b>{selectedIds.length}</b>
                </div>

                <button
                  onClick={async () => {
                    if (selectedIds.length === 0) return setMsg("Select leads first");
                    setMsg("");
                    try {
                      for (const id of selectedIds) {
                        try {
                          await patchLead(id, { status: "contacted" });
                        } catch {}
                      }
                      setMsg("✅ Bulk: Marked Contacted (best-effort)");
                      clearSelection();
                      await load();
                    } catch {
                      setMsg("Bulk update failed");
                    }
                  }}
                  style={ghostBtn()}
                >
                  Mark Contacted
                </button>

                <button
                  onClick={async () => {
                    if (selectedIds.length === 0) return setMsg("Select leads first");
                    setMsg("");
                    try {
                      for (const id of selectedIds) {
                        try {
                          await patchLead(id, { status: "demo" });
                        } catch {}
                      }
                      setMsg("✅ Bulk: Marked Demo (best-effort)");
                      clearSelection();
                      await load();
                    } catch {
                      setMsg("Bulk update failed");
                    }
                  }}
                  style={ghostBtn()}
                >
                  Mark Demo
                </button>

                <button onClick={() => bulkWhatsApp("followup")} style={ghostBtn()} title="Opens max 5 tabs">
                  💬 WA Follow-up (max 5)
                </button>

                <button onClick={() => bulkWhatsApp("no_pick")} style={ghostBtn()} title="Opens max 5 tabs">
                  📩 WA No-Pick (max 5)
                </button>

                <button onClick={clearSelection} style={ghostBtn()}>
                  Clear
                </button>

                <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                  Tip: Bulk is best-effort unless backend supports batch routes.
                </div>
              </div>
            </div>
          ) : null}

          {/* ✅ Target Folder UI */}
          {targetOpen ? (
            <div style={cardStyle({ glass: glassOn })}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>
                    🎯 {user?.role === "employee" ? "My Created Leads (Target)" : "Employees Target Folder"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Week-wise view</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={loadTargetFolder} style={ghostBtn()}>
                    {targetLoading ? "Loading..." : "Refresh Folder"}
                  </button>
                  <button onClick={() => setTargetOpen(false)} style={ghostBtn()}>
                    Close
                  </button>
                </div>
              </div>

              {targetErr ? (
                <div style={{ marginTop: 12, ...subtleCard({ glass: glassOn }), borderColor: "rgba(244,63,94,0.25)" }}>
                  <div style={{ color: "var(--danger)", fontWeight: 950 }}>{targetErr}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    Backend route required: <b>{LEADS_URL}/target-folder</b>
                  </div>
                </div>
              ) : null}

              {targetLoading ? (
                <div style={{ marginTop: 12, color: "var(--muted)" }}>Loading target folder...</div>
              ) : (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {targetGroups.length === 0 && !targetErr ? <div style={{ color: "var(--muted)" }}>No target leads found.</div> : null}

                  {targetGroups.map((g) => (
                    <div key={g.weekKey} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 950 }}>Week: {g.weekLabel || g.weekKey}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Total: <b style={{ color: "var(--text)" }}>{g.items?.length || 0}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {(g.items || []).slice(0, 15).map((l) => (
                          <div key={l._id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontWeight: 950 }}>{l.name}</div>
                            <span style={badgeStyle(l.status)}>{l.status}</span>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              {l.createdAt ? new Date(l.createdAt).toLocaleString() : "-"}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              By: <b style={{ color: "var(--text)" }}>{l.createdBy?.name || "-"}</b>
                            </span>
                          </div>
                        ))}
                        {(g.items || []).length > 15 ? (
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Showing 15 of {g.items.length}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* ✅ Target Dashboard UI */}
          {dashOpen ? (
            <div style={cardStyle({ glass: glassOn })}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>📊 Target Dashboard</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Week / Month / Date-to-Date • Admin can filter by employee
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={loadTargetDashboard} style={ghostBtn()}>
                    {dashLoading ? "Loading..." : "Refresh"}
                  </button>
                  <button onClick={() => setDashOpen(false)} style={ghostBtn()}>
                    Close
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                  From
                  <input type="datetime-local" value={tgFrom} onChange={(e) => setTgFrom(e.target.value)} style={inputStyle()} />
                </label>

                <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                  To
                  <input type="datetime-local" value={tgTo} onChange={(e) => setTgTo(e.target.value)} style={inputStyle()} />
                </label>

                <label style={{ ...labelStyle(), flex: "1 1 180px" }}>
                  Group By
                  <select value={tgGroupBy} onChange={(e) => setTgGroupBy(e.target.value)} style={selectStyle()}>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </label>

                {isAdminOrManager ? (
                  <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                    Employee (Created By)
                    <select value={tgCreatedBy} onChange={(e) => setTgCreatedBy(e.target.value)} style={selectStyle()}>
                      <option value="all">All Employees</option>
                      {(dashData?.employees || []).map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={presetThisWeek} style={ghostBtn()}>
                    This Week
                  </button>
                  <button type="button" onClick={presetThisMonth} style={ghostBtn()}>
                    This Month
                  </button>
                  <button type="button" onClick={loadTargetDashboard} style={btnStyle(true)}>
                    Apply
                  </button>
                </div>
              </div>

              {dashErr ? (
                <div style={{ marginTop: 12, ...subtleCard({ glass: glassOn }), borderColor: "rgba(244,63,94,0.25)" }}>
                  <div style={{ color: "var(--danger)", fontWeight: 950 }}>{dashErr}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    Backend route required: <b>{LEADS_URL}/targets</b>
                  </div>
                </div>
              ) : null}

              {dashData?.totals ? (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  {[
                    ["Total", dashData.totals.total],
                    ["New", dashData.totals.new],
                    ["Contacted", dashData.totals.contacted],
                    ["Demo", dashData.totals.demo],
                    ["Won", dashData.totals.won],
                    ["Lost", dashData.totals.lost],
                  ].map(([k, v]) => (
                    <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{k}</div>
                      <div style={{ fontWeight: 950, fontSize: 20, marginTop: 2 }}>{v ?? 0}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Breakdown ({tgGroupBy})</div>

                {!dashLoading && (dashData?.groups || []).length === 0 ? (
                  <div style={{ color: "var(--muted)" }}>No data for selected range.</div>
                ) : null}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        {["Period", "Total", "New", "Contacted", "Demo", "Won", "Lost"].map((h) => (
                          <th key={h} style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(dashData?.groups || []).map((g, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", fontWeight: 900 }}>{g.label}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.total}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.new}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.contacted}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.demo}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.won}</td>
                          <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{g.lost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {isAdminOrManager && (dashData?.leaderboard || []).length ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Employee Leaderboard (Created Leads)</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {dashData.leaderboard.map((r) => (
                      <div
                        key={r.userId}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div style={{ fontWeight: 950 }}>{r.name || "Employee"}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.email || ""}</div>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                          <span>
                            Total: <b style={{ color: "var(--text)" }}>{r.total}</b>
                          </span>
                          <span>
                            Demo: <b style={{ color: "var(--text)" }}>{r.demo}</b>
                          </span>
                          <span>
                            Won: <b style={{ color: "var(--text)" }}>{r.won}</b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

{/* After Call Panel */}
{afterCallOpenId ? (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 120,
      background: theme === "dark" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.35)",
      display: "grid",
      placeItems: "center",
      padding: 12,
    }}
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) closeAfterCall();
    }}
  >
    <div
      style={{
        width: 1200,
        maxWidth: "98vw",
        height: "92vh",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid var(--borderStrong)",
        background: glassOn ? "var(--panel)" : "var(--panelSolid)",
        backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
        boxShadow: "var(--shadow)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
      }}
    >
      {/* TOP BAR */}
      <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ fontSize: 16 }}>Call Workspace</b>

          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Timer: <b style={{ color: "var(--text)" }}>{formatTimer(elapsedMs)}</b>
          </span>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => snoozeFollowup(1)} style={ghostBtn()}>
              Snooze 1h
            </button>
            <button type="button" onClick={() => snoozeFollowup(2)} style={ghostBtn()}>
              Snooze 2h
            </button>
            <button type="button" onClick={() => snoozeFollowup(24)} style={ghostBtn()}>
              Tomorrow
            </button>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeLead ? (
              <button type="button" onClick={() => openAI(activeLead)} style={btnStyle(false)}>
                🤖 AI Assist
              </button>
            ) : null}
            <button onClick={closeAfterCall} style={ghostBtn()}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: 14, overflow: "auto" }}>
        {activeLead ? (
          <div style={{ padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            {(() => {
              const score = aiScoreLead(activeLead);
              const tag = aiTempTag(score);
              const next = aiNextAction(activeLead);
              return (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{activeLead.name}</div>
                    <span style={badgeStyle(activeLead.status)}>{activeLead.status}</span>
                    <span style={badgeStyle(tag)}>{tag.toUpperCase()} • {score}</span>
                    {next?.tag ? <span style={badgeStyle(next.tag)}>{next.tag}</span> : null}

                    {activeLead.phone ? (
                      <button type="button" onClick={() => copyToClipboard(activeLead.phone)} style={ghostBtn()} title="Copy phone">
                        📋 Copy Phone
                      </button>
                    ) : null}

                    {activeLead.phone ? (
                      <button type="button" onClick={() => openWhatsApp(activeLead, "followup")} style={ghostBtn()}>
                        💬 WhatsApp
                      </button>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                    {activeLead.phone || "-"} {activeLead.city ? `• ${activeLead.city}` : ""}{" "}
                    {activeLead.email ? `• ${activeLead.email}` : ""}{" "}
                    {activeLead.course ? `• ${activeLead.course}` : ""}{" "}
                    {activeLead.source ? `• Source: ${activeLead.source}` : ""}{" "}
                    {activeLead.assignedTo?.name ? `• Assigned: ${activeLead.assignedTo.name}` : ""}
                  </div>

                  <div style={{ marginTop: 10, ...subtleCard({ glass: glassOn }) }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>AI Suggested Next Action</div>
                    <div style={{ fontWeight: 900, marginTop: 2 }}>{next.text}</div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={{ ...labelStyle(), flex: "1 1 240px" }}>
                      Disposition (Quick)
                      <select value={disp} onChange={(e) => onDispositionPick(e.target.value)} style={selectStyle()}>
                        <option value="">-- select --</option>
                        {DISPOSITIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>

                    {disp === "Not interested" || disp === "Wrong number" || disp === "Already enrolled" ? (
                      <button type="button" onClick={() => quickStatus(activeLead._id, "lost")} style={btnStyle(false, true)} title="Mark Lost quickly">
                        ⚠️ Mark Lost
                      </button>
                    ) : null}

                    {disp === "Interested" ? (
                      <button type="button" onClick={() => quickStatus(activeLead._id, "demo")} style={btnStyle(false)} title="Move to Demo">
                        ⭐ Mark Demo
                      </button>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ ...labelStyle(), flex: "1 1 200px" }}>
                      Call Outcome
                      <select value={afterCallOutcome} onChange={(e) => onOutcomeChange(e.target.value)} style={selectStyle()}>
                        <option value="">-- select --</option>
                        <option value="Connected">Connected</option>
                        <option value="Busy">Busy</option>
                        <option value="Not picked">Not picked</option>
                      </select>
                    </label>

                    <label style={{ ...labelStyle(), flex: "1 1 240px" }}>
                      Next Follow-up
                      <input
                        type="datetime-local"
                        value={afterCallFollowUp}
                        onChange={(e) => {
                          setAfterCallFollowUp(e.target.value);
                          setSaveHot(true);
                        }}
                        style={inputStyle()}
                      />
                    </label>

                    <label style={{ ...labelStyle(), flex: "2 1 320px" }}>
                      Note (optional)
                      <input
                        value={afterCallNote}
                        onChange={(e) => setAfterCallNote(e.target.value)}
                        placeholder="e.g., student wants weekend batch"
                        style={inputStyle()}
                      />
                    </label>
                  </div>

                  {demoOpen ? (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(148,163,184,0.45)" }}>
                      <div style={{ fontWeight: 950, marginBottom: 8 }}>Schedule Demo</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                          Demo Date/Time
                          <input type="datetime-local" value={demoDT} onChange={(e) => setDemoDT(e.target.value)} style={inputStyle()} />
                        </label>
                        <button onClick={confirmDemoSchedule} style={btnStyle(true)}>
                          Confirm
                        </button>
                        <button onClick={() => setDemoOpen(false)} style={ghostBtn()}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={saveAfterCall}
                      style={{
                        ...btnStyle(saveHot),
                        background: saveHot ? "rgba(17,24,39,0.92)" : "transparent",
                        color: saveHot ? "#fff" : "var(--text)",
                      }}
                    >
                      ✅ Save After Call
                    </button>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => quickStatus(activeLead._id, "demo")} style={ghostBtn()}>
                        Mark Demo
                      </button>
                      <button onClick={() => quickStatus(activeLead._id, "won")} style={ghostBtn()}>
                        Mark Won
                      </button>
                      <button onClick={() => quickStatus(activeLead._id, "lost")} style={ghostBtn()}>
                        Mark Lost
                      </button>
                    </div>

                    <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                      Outcome auto-updates stage (Connected → Demo)
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div style={{ color: "var(--muted)" }}>Lead not found.</div>
        )}
      </div>
    </div>
  </div>
) : null}
          {/* ===== Main Content: List / Kanban ===== */}
          <div style={cardStyle({ glass: glassOn })}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>{viewMode === "list" ? "Leads List" : "Kanban Board"}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Showing <b style={{ color: "var(--text)" }}>{paged.length}</b> of{" "}
                <b style={{ color: "var(--text)" }}>{filtered.length}</b> (Total: {leads.length})
              </div>
            </div>

            {viewMode === "kanban" ? (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {KANBAN.map((col) => (
                  <div key={col.key} style={{ border: "1px solid var(--border)", borderRadius: 16, background: "rgba(255,255,255,0.03)", overflow: "hidden" }}>
                    <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 950 }}>{col.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{(kanbanGroups[col.key] || []).length}</div>
                    </div>

                    <div style={{ padding: 10, display: "grid", gap: 10, maxHeight: "70vh", overflowY: "auto" }}>
                      {(kanbanGroups[col.key] || []).slice(0, 80).map((l) => {
                        const score = aiScoreLead(l);
                        const tag = aiTempTag(score);
                        const fu = l.nextFollowUp ? new Date(l.nextFollowUp) : null;
                        const overdue = fu && fu.getTime() < Date.now() && !["won", "lost"].includes(l.status);
                        return (
                          <div key={l._id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 950 }}>{l.name}</div>
                              <span style={badgeStyle(tag)}>{tag.toUpperCase()} {score}</span>
                              {overdue ? <span style={badgeStyle("overdue")}>overdue</span> : isToday(fu) ? <span style={badgeStyle("due")}>due</span> : null}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                              {l.phone || "-"} {l.course ? `• ${l.course}` : ""} {l.source ? `• ${l.source}` : ""}
                            </div>
                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => openAfterCall(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                                After Call
                              </button>
                              <button onClick={() => openAI(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                                🤖 AI
                              </button>
                              {isAdminOrManager ? (
                                <button onClick={() => openAssign(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                                  👥 Assign
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {(kanbanGroups[col.key] || []).length > 80 ? (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>Showing first 80</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {paged.length === 0 ? (
                  <div style={{ color: "var(--muted)", padding: 10 }}>No leads found.</div>
                ) : (
                  paged.map((l) => {
                    const tel = l.phone ? `tel:${String(l.phone).replace(/\s+/g, "")}` : null;
                    const fu = l.nextFollowUp ? new Date(l.nextFollowUp) : null;
                    const isOverdue = fu && fu.getTime() < Date.now() && !["won", "lost"].includes(l.status);
                    const followBadge = isOverdue ? "overdue" : isToday(fu) ? "due" : null;

                    const isSelected = selectedIds.includes(l._id);

                    const score = aiScoreLead(l);
                    const tag = aiTempTag(score);
                    const next = aiNextAction(l);

                    return (
                      <div
                        key={l._id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 16,
                          padding: dense ? 10 : 12,
                          background: isSelected ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                          display: "grid",
                          gap: dense ? 8 : 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              {bulkMode ? (
                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(l._id)} />
                              ) : null}

                              <div style={{ fontWeight: 950, fontSize: 16 }}>{l.name}</div>
                              <span style={badgeStyle(l.status)}>{l.status}</span>
                              <span style={badgeStyle(tag)}>{tag.toUpperCase()} • {score}</span>
                              {followBadge ? <span style={badgeStyle(followBadge)}>{followBadge}</span> : null}
                            </div>

                            <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                              {l.city || "-"} {l.email ? `• ${l.email}` : ""} {l.course ? `• ${l.course}` : ""}{" "}
                              {l.source ? `• Source: ${l.source}` : ""}{" "}
                              {l.assignedTo?.name ? `• Assigned: ${l.assignedTo.name}` : ""}{" "}
                              {l.createdBy?.name ? `• CreatedBy: ${l.createdBy.name}` : ""}
                            </div>

                            <div style={{ marginTop: dense ? 6 : 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              {tel ? (
                                <a
  href="#"
  onClick={(e) => {
    e.preventDefault();
    openAfterCall(l); // ✅ popup open
  }}
  style={{ fontWeight: 950, textDecoration: "none", color: "var(--text)" }}
>
  📞 {l.phone}
</a>
                              ) : (
                                <span style={{ color: "var(--muted)" }}>📞 -</span>
                              )}

                              {l.phone ? (
                                <button type="button" onClick={() => copyToClipboard(l.phone)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()} title="Copy phone">
                                  📋 Copy
                                </button>
                              ) : null}

                              {l.phone ? (
                                <button
                                  type="button"
                                  onClick={() => openWhatsApp(l, "followup")}
                                  title="WhatsApp"
                                  style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}
                                >
                                  💬 WhatsApp
                                </button>
                              ) : null}

                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                Follow-up: <b style={{ color: "var(--text)" }}>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "-"}</b>
                              </span>

                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                AI Next: <b style={{ color: "var(--text)" }}>{next.text}</b>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button onClick={() => openAfterCall(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              After Call
                            </button>
                            <button onClick={() => openHistory(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              History
                            </button>
                            <button onClick={() => openAI(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              🤖 AI Assist
                            </button>

                            {isAdminOrManager ? (
                              <button onClick={() => openAssign(l)} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                                👥 Assign
                              </button>
                            ) : null}

                            <button onClick={() => quickStatus(l._id, "demo")} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              Demo
                            </button>
                            <button onClick={() => quickStatus(l._id, "won")} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              Won
                            </button>
                            <button onClick={() => quickStatus(l._id, "lost")} style={dense ? { ...ghostBtn(), height: 36, padding: "8px 10px" } : ghostBtn()}>
                              Lost
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {filtered.length > limit ? (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
                    <button onClick={() => setLimit((n) => n + 40)} style={btnStyle(false)}>
                      Load more (+40)
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  Tip: Phone click → After Call opens + timer. AI Assist generates WhatsApp text + call script. Export downloads CSV.
                </div>
              </div>
            )}
          </div>

          {/* ✅ Create Lead Modal */}
          {createOpen ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: theme === "dark" ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.35)",
                zIndex: 60,
                display: "grid",
                placeItems: "center",
                padding: 12,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setCreateOpen(false);
              }}
            >
              <div
                style={{
                  width: 980,
                  maxWidth: "98vw",
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: glassOn ? "var(--panel)" : "var(--panelSolid)",
                  backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
                  boxShadow: "var(--shadow)",
                }}
              >
                <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>Create Lead</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Fast entry for any business</div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <button onClick={() => setCreateOpen(false)} style={ghostBtn()}>
                      Close
                    </button>
                  </div>
                </div>

                <form onSubmit={saveLeadFromModal} style={{ padding: 14, display: "grid", gap: 14 }}>
                  <div>
                    <div style={sectionTitle()}>Contact</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                        Name*
                        <input style={inputStyle()} value={create.name} onChange={(e) => setCreate((s) => ({ ...s, name: e.target.value }))} placeholder="e.g., Aditi Sharma" />
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        Phone*
                        <input style={inputStyle()} value={create.phone} onChange={(e) => setCreate((s) => ({ ...s, phone: e.target.value }))} placeholder="e.g., 9876543210" />
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        Email
                        <input style={inputStyle()} value={create.email} onChange={(e) => setCreate((s) => ({ ...s, email: e.target.value }))} placeholder="e.g., aditi@gmail.com" />
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 180px" }}>
                        City
                        <input style={inputStyle()} value={create.city} onChange={(e) => setCreate((s) => ({ ...s, city: e.target.value }))} placeholder="e.g., Delhi" />
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                      <label style={{ ...labelStyle(), flex: "1 1 240px" }}>
                        WhatsApp
                        <input
                          style={inputStyle()}
                          disabled={create.whatsappSame}
                          value={create.whatsappSame ? create.phone : create.whatsapp}
                          onChange={(e) => setCreate((s) => ({ ...s, whatsapp: e.target.value }))}
                          placeholder="WhatsApp number"
                        />
                      </label>

                      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 26, color: "var(--muted)" }}>
                        <input type="checkbox" checked={create.whatsappSame} onChange={(e) => setCreate((s) => ({ ...s, whatsappSame: e.target.checked }))} />
                        Same as phone
                      </label>
                    </div>
                  </div>

                  <div>
                    <div style={sectionTitle()}>Lead Details</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                        Course / Product
                        <select style={selectStyle()} value={create.course} onChange={(e) => setCreate((s) => ({ ...s, course: e.target.value }))}>
                          <option value="">-- select --</option>
                          <option value="Digital Marketing">Digital Marketing</option>
                          <option value="Graphic Designing">Graphic Designing</option>
                          <option value="UI/UX">UI/UX</option>
                          <option value="Full Stack">Full Stack</option>
                          <option value="Data Analytics">Data Analytics</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>

                      {create.course === "Other" ? (
                        <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                          Other
                          <input style={inputStyle()} value={create.courseOther} onChange={(e) => setCreate((s) => ({ ...s, courseOther: e.target.value }))} placeholder="Name" />
                        </label>
                      ) : null}

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        Source
                        <select style={selectStyle()} value={create.source} onChange={(e) => setCreate((s) => ({ ...s, source: e.target.value }))}>
                          <option>Instagram</option>
                          <option>Facebook</option>
                          <option>Google</option>
                          <option>Website</option>
                          <option>Walk-in</option>
                          <option>Referral</option>
                          <option>JustDial</option>
                          <option>Sulekha</option>
                          <option>Other</option>
                        </select>
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        
                        Budget
                        <select style={selectStyle()} value={create.budget} onChange={(e) => setCreate((s) => ({ ...s, budget: e.target.value }))}>
                          <option>Under 10k</option>
                          <option>10k - 20k</option>
                          <option>20k - 40k</option>
                          <option>40k+</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div style={sectionTitle()}>Preferences</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
  Industry
  <select
    style={selectStyle()}
    value={create.industry}
    onChange={(e) => setCreate((s) => ({ ...s, industry: e.target.value }))}
  >
    <option>Education</option>
    <option>Real Estate</option>
    <option>Insurance</option>
    <option>Salon</option>
    <option>Agency</option>
    <option>E-commerce</option>
    <option>Other</option>
  </select>
</label>
                        Mode
                        <select style={selectStyle()} value={create.mode} onChange={(e) => setCreate((s) => ({ ...s, mode: e.target.value }))}>
                          <option>Online</option>
                          <option>Offline</option>
                          <option>Hybrid</option>
                        </select>
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        Batch
                        <select style={selectStyle()} value={create.batch} onChange={(e) => setCreate((s) => ({ ...s, batch: e.target.value }))}>
                          <option>Morning</option>
                          <option>Evening</option>
                          <option>Weekend</option>
                        </select>
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                        Stage
                        <select style={selectStyle()} value={create.status} onChange={(e) => setCreate((s) => ({ ...s, status: e.target.value }))}>
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="demo">Demo</option>
                          <option value="won">Won</option>
                          <option value="lost">Lost</option>
                        </select>
                      </label>

                      <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                        Next Follow-up
                        <input type="datetime-local" style={inputStyle()} value={create.nextFollowUp} onChange={(e) => setCreate((s) => ({ ...s, nextFollowUp: e.target.value }))} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <div style={sectionTitle()}>Note</div>
                    <label style={labelStyle()}>
                      First Note (optional)
                      <input style={inputStyle()} value={create.note} onChange={(e) => setCreate((s) => ({ ...s, note: e.target.value }))} placeholder="e.g., wants demo tomorrow 6pm" />
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <button type="button" onClick={() => setCreateOpen(false)} style={ghostBtn()}>
                      Cancel
                    </button>
                    <button type="submit" style={btnStyle(true)}>
                      ✅ Save Lead
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {/* ✅ History Drawer */}
          {historyOpen ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                height: "100vh",
                width: 440,
                maxWidth: "92vw",
                background: glassOn ? "var(--panel)" : "var(--panelSolid)",
                backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
                borderLeft: "1px solid var(--border)",
                boxShadow: theme === "dark" ? " -10px 0 30px rgba(0,0,0,0.45)" : "-10px 0 30px rgba(0,0,0,0.10)",
                padding: 16,
                zIndex: 70,
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>History</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {historyLead?.name || "-"} {historyLead?.phone ? `• ${historyLead.phone}` : ""}
                  </div>
                  {historyLead?.phone ? (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      Showing history for: <b style={{ color: "var(--text)" }}>{historyLead.phone}</b>
                    </div>
                  ) : null}
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={closeHistory} style={ghostBtn()}>
                    Close
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                {historyErr ? (
                  <div style={{ ...subtleCard({ glass: glassOn }), borderColor: "rgba(244,63,94,0.25)" }}>
                    <div style={{ color: "var(--danger)", fontWeight: 950 }}>{historyErr}</div>
                  </div>
                ) : null}
                {historyLoading ? (
  <div style={{ color: "var(--muted)" }}>Loading...</div>
) : !historyErr && historyItems.length === 0 ? (
  <div style={{ color: "var(--muted)" }}>No history found.</div>
) : null}

                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  {historyItems.map((h) => (
                    <div key={h._id || `${h.createdAt}-${Math.random()}`} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{h.createdAt ? new Date(h.createdAt).toLocaleString() : "-"}</div>
                      <div style={{ marginTop: 4, fontWeight: 900 }}>
                        {(h.actor?.name || h.actorName || h.actorId?.name || "User")} — {h.action || h.title || "update"}
                      </div>

                      {h?.meta?.text ? <div style={{ marginTop: 6 }}>{h.meta.text}</div> : null}
                      {h?.meta?.note ? <div style={{ marginTop: 6 }}>{h.meta.note}</div> : null}

                      {h.meta ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>{typeof h.meta === "string" ? h.meta : JSON.stringify(h.meta)}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* ✅ AI Assist Drawer */}
          {aiOpen ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                height: "100vh",
                width: 520,
                maxWidth: "94vw",
                background: glassOn ? "var(--panel)" : "var(--panelSolid)",
                backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
                borderRight: "1px solid var(--border)",
                boxShadow: theme === "dark" ? "10px 0 30px rgba(0,0,0,0.45)" : "10px 0 30px rgba(0,0,0,0.10)",
                padding: 16,
                zIndex: 80,
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>🤖 AI Assist</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {aiLead?.name || "-"} {aiLead?.phone ? `• ${aiLead.phone}` : ""} {aiLead?.course ? `• ${aiLead.course}` : ""}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {aiLead?.phone ? (
                    <button onClick={() => openWhatsApp(aiLead, aiVariant)} style={btnStyle(true)} title="Open WhatsApp with current text">
                      💬 Send WA
                    </button>
                  ) : null}
                  <button onClick={() => setAiOpen(false)} style={ghostBtn()}>
                    Close
                  </button>
                </div>
              </div>

              {aiLead ? (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard({ glass: glassOn }) }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>AI Suggested Next Action</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{aiAction}</div>
                  </div>

                  <div style={cardStyle({ glass: glassOn })}>
                    <div style={{ fontWeight: 950 }}>WhatsApp Generator</div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        ["followup", "Follow-up"],
                        ["no_pick", "No Pickup"],
                        ["demo_confirm", "Demo Confirm"],
                        ["fee", "Fees / Budget"],
                      ].map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => {
                            setAiVariant(k);
                            setAiText(aiGenerateWhatsApp(aiLead, k));
                          }}
                          style={{
                            ...ghostBtn(),
                            borderColor: aiVariant === k ? "var(--borderStrong)" : "var(--border)",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={10}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        padding: 12,
                        outline: "none",
                        fontFamily: "inherit",
                        lineHeight: 1.4,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text)",
                      }}
                    />

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => copyToClipboard(aiText)} style={ghostBtn()}>
                        📋 Copy Text
                      </button>
                      {aiLead?.phone ? (
                        <button
                          onClick={() => {
                            const link = buildWALink(aiLead.phone, aiText);
                            if (link) window.open(link, "_blank");
                          }}
                          style={btnStyle(true)}
                        >
                          🚀 Open WA
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={cardStyle({ glass: glassOn })}>
                    <div style={{ fontWeight: 950 }}>Call Script</div>
                    <textarea
                      value={aiScript}
                      onChange={(e) => setAiScript(e.target.value)}
                      rows={12}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        padding: 12,
                        outline: "none",
                        fontFamily: "inherit",
                        lineHeight: 1.4,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text)",
                      }}
                    />
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => copyToClipboard(aiScript)} style={ghostBtn()}>
                        📋 Copy Script
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await api.post(leadUrl(aiLead._id, "notes"), { text: `Call Script:\n${aiScript}` });
                            setMsg("✅ Saved script to notes");
                          } catch {
                            setMsg("Notes save not available (backend add required)");
                          }
                        }}
                        style={ghostBtn()}
                      >
                        📝 Save as Note
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12, color: "var(--muted)" }}>No lead selected.</div>
              )}
            </div>
          ) : null}

          {/* ✅ Admin Assign Drawer */}
          {assignOpen ? (
            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: glassOn ? "var(--panel)" : "var(--panelSolid)",
                backdropFilter: glassOn ? "blur(16px) saturate(160%)" : "none",
                borderTop: "1px solid var(--border)",
                zIndex: 90,
                padding: 14,
                boxShadow: theme === "dark" ? "0 -10px 30px rgba(0,0,0,0.45)" : "0 -10px 30px rgba(0,0,0,0.10)",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950 }}>
                  👥 Assign Lead {assignLead?.name ? `• ${assignLead.name}` : ""}
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={() => setAssignOpen(false)} style={ghostBtn()}>
                    Close
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ ...labelStyle(), flex: "1 1 340px" }}>
                  Assign To (Team)
                  <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} style={selectStyle()}>
                    <option value="">-- select team member --</option>
                    {teamUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name || "User"} ({u.email || u.role || "member"})
                      </option>
                    ))}
                  </select>
                </label>

                <button onClick={saveAssign} style={btnStyle(true)}>
                  ✅ Save Assign
                </button>

                <button
                  onClick={() => {
                    if (!assignLead) return;
                    openAI(assignLead);
                  }}
                  style={ghostBtn()}
                >
                  🤖 AI Assist
                </button>

                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Note: assign works only if backend accepts <b>assignedTo</b> in PATCH.
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}