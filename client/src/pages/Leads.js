// client/src/pages/Leads.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/** ✅ Best practice: keep base endpoint in one place */
const LEADS_URL = "/api/leads";

/** ===== Helpers ===== */
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

function badgeStyle(type) {
  const base = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    display: "inline-block",
  };
  const map = {
    new: { background: "#eef2ff", color: "#1e40af" },
    contacted: { background: "#ecfeff", color: "#155e75" },
    demo: { background: "#fff7ed", color: "#9a3412" },
    won: { background: "#ecfdf5", color: "#065f46" },
    lost: { background: "#fef2f2", color: "#991b1b" },
    due: { background: "#111827", color: "#fff" },
    overdue: { background: "#991b1b", color: "#fff" },
  };
  return { ...base, ...(map[type] || { background: "#f3f4f6", color: "#111827" }) };
}

function cardStyle() {
  return { border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#fff" };
}

function btnStyle(primary = false) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: primary ? "#111827" : "#fff",
    color: primary ? "#fff" : "#111827",
    fontWeight: 900,
    cursor: "pointer",
    height: 40,
  };
}

function inputStyle() {
  return {
    height: 42,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "0 12px",
    outline: "none",
    width: "100%",
    background: "#fff",
  };
}

function selectStyle() {
  return {
    height: 42,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "0 10px",
    outline: "none",
    width: "100%",
    background: "#fff",
  };
}

function labelStyle() {
  return { display: "grid", gap: 6, fontSize: 13, color: "#111827" };
}

function sectionTitle() {
  return { fontWeight: 900, fontSize: 14, marginBottom: 10 };
}

/** ✅ WhatsApp helpers */
function normalizePhoneForWA(phone) {
  const p = String(phone || "").replace(/[^\d]/g, "");
  if (!p) return "";
  // India default: if 10 digits, prefix 91
  if (p.length === 10) return `91${p}`;
  return p; // if already has country code
}

function buildWALink(phone, text) {
  const p = normalizePhoneForWA(phone);
  if (!p) return "";
  const msg = encodeURIComponent(text || "");
  return `https://wa.me/${p}?text=${msg}`;
}

/** ✅ URL helpers (keeps endpoint usage consistent everywhere) */
function leadUrl(id, suffix = "") {
  const cleanSuffix = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";
  return `${LEADS_URL}/${id}${cleanSuffix}`;
}

/** ===== Main Component ===== */
export default function Leads() {
  const { api, user } = useAuth();

  const [msg, setMsg] = useState("");

  // list
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);

  /** ✅ Education Create Lead Modal */
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({
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

  /** ✅ Target Folder (Employee Created Leads) */
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetErr, setTargetErr] = useState("");
  const [targetGroups, setTargetGroups] = useState([]);

  /** ✅ Target Dashboard (Advanced filters) */
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

  const activeLead = useMemo(
    () => (afterCallOpenId ? leads.find((x) => x._id === afterCallOpenId) : null),
    [afterCallOpenId, leads]
  );

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  /** ===== Load leads ===== */
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

  /** ✅ Load Target Folder */
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

  /** ✅ Target Dashboard API loader */
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

      if (isAdminOrManager) {
        params.set("createdBy", tgCreatedBy || "all");
      }

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
    const day = now.getDay(); // 0 Sun
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

  /** ===== Create lead (Education Modal) ===== */
  const saveLeadFromModal = async (e) => {
    e.preventDefault();
    setMsg("");

    const name = create.name.trim();
    const phone = create.phone.trim();

    if (!name) return setMsg("Student name required");
    if (!phone) return setMsg("Phone required");

    const whatsapp = create.whatsappSame ? phone : create.whatsapp.trim();

    const courseFinal = create.course === "Other" ? (create.courseOther.trim() || "Other") : (create.course || "");

    try {
      const payload = {
        name,
        phone,
        email: create.email.trim(),
        city: create.city.trim(),
        status: create.status,
      };

      const fu = fromInputDT(create.nextFollowUp);
      if (fu) payload.nextFollowUp = fu.toISOString();

      const res = await api.post(LEADS_URL, payload);

      // Save first note (education info)
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

      setMsg("✅ Lead created (Education CRM)");
      await load();

      // optional: refresh target sections if open
      if (targetOpen) await loadTargetFolder();
      if (dashOpen) await loadTargetDashboard();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Create error");
    }
  };

  /** ===== Patch lead helper ===== */
  const patchLead = async (leadId, payload) => {
    await api.patch(leadUrl(leadId), payload);
  };

  /** ===== Quick status ===== */
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

  /** ===== After Call ===== */
  const openAfterCall = (lead) => {
    setMsg("");
    setAfterCallOpenId(lead._id);
    setAfterCallOutcome("");
    setAfterCallNote("");
    setAfterCallFollowUp("");
    setSaveHot(false);

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

  const confirmDemoSchedule = () => {
    const dt = fromInputDT(demoDT);
    if (!dt) return setMsg("Select demo date/time");
    setAfterCallFollowUp(toInputDT(dt));
    setDemoOpen(false);
    setSaveHot(true);
  };

  const saveAfterCall = async () => {
    if (!activeLead) return;
    setMsg("");
    try {
      const payload = {};
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

  /** ✅ WhatsApp click handler (simple + optional save log) */
  const openWhatsApp = async (lead) => {
    const phone = lead?.phone || "";
    if (!phone) return setMsg("Phone missing for WhatsApp");

    const templateText =
      `Hi ${lead?.name || ""}, SUDO24 Learning se baat kar rahe hain.\n` +
      `Aapke course enquiry par follow-up.\n` +
      `Kaunsa course interested ho?`;

    const link = buildWALink(phone, templateText);
    if (link) window.open(link, "_blank");

    // Optional: save log (backend route must exist; if not -> ignore)
    try {
      await api.post(leadUrl(lead._id, "whatsapp"), {
        templateName: "default_followup",
        messageText: templateText,
      });
    } catch {}
  };

  /** ===== History Drawer ===== */
  const openHistory = async (lead) => {
    setHistoryOpen(true);
    setHistoryLead(lead);
    setHistoryItems([]);
    setHistoryErr("");
    try {
      const res = await api.get(leadUrl(lead._id, "history"));
      setHistoryItems(res.data || []);
    } catch (err) {
      setHistoryErr(err?.response?.data?.message || "History not available (backend add required)");
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryLead(null);
    setHistoryItems([]);
    setHistoryErr("");
  };

  /** ===== Stats ===== */
  const todayNewLeads = useMemo(() => {
    const t = new Date();
    return leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === t.toDateString()).length;
  }, [leads]);

  const todayFollowups = useMemo(() => leads.filter((l) => isToday(l.nextFollowUp)).length, [leads]);

  const pendingFollowups = useMemo(() => {
    const now = Date.now();
    return leads.filter(
      (l) =>
        l.nextFollowUp &&
        new Date(l.nextFollowUp).getTime() < now &&
        !["won", "lost"].includes(l.status)
    ).length;
  }, [leads]);

  /** ===== Filtered list ===== */
  const filtered = useMemo(() => {
    const query = safeStr(q);

    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;

      if (todayOnly && !isToday(l.nextFollowUp)) return false;

      if (pendingOnly) {
        if (!l.nextFollowUp) return false;
        const isOver = new Date(l.nextFollowUp).getTime() < Date.now();
        if (!isOver) return false;
        if (["won", "lost"].includes(l.status)) return false;
      }

      if (!query) return true;

      const hay = [
        l.name,
        l.phone,
        l.city,
        l.email,
        l.assignedTo?.name,
        l.assignedTo?.email,
        l.createdBy?.name,
        l.createdBy?.email,
      ]
        .map(safeStr)
        .join(" ");

      return hay.includes(query);
    });
  }, [leads, q, statusFilter, todayOnly, pendingOnly]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Leads</h2>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Today New: <b>{todayNewLeads}</b> • Today Follow-ups: <b>{todayFollowups}</b> • Pending:{" "}
            <b>{pendingFollowups}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setCreateOpen(true)} style={btnStyle(true)}>
            ➕ Add Student Lead
          </button>

          {/* ✅ Target Folder button */}
          <button
            onClick={async () => {
              const next = !targetOpen;
              setTargetOpen(next);
              if (next) await loadTargetFolder();
            }}
            style={btnStyle(false)}
          >
            🎯 Target Folder
          </button>

          {/* ✅ Target Dashboard button */}
          <button
            onClick={async () => {
              const next = !dashOpen;
              setDashOpen(next);
              if (next) await loadTargetDashboard();
            }}
            style={btnStyle(false)}
          >
            📊 Target Dashboard
          </button>

          <button onClick={load} style={btnStyle(false)}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg ? <div style={{ ...cardStyle(), background: "#f9fafb" }}>{msg}</div> : null}

      {/* ✅ Target Folder UI */}
      {targetOpen ? (
        <div style={cardStyle()}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                🎯 {user?.role === "employee" ? "My Created Leads (Target)" : "Employees Target Folder"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Week-wise view</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={loadTargetFolder} style={btnStyle(false)}>
                {targetLoading ? "Loading..." : "Refresh Folder"}
              </button>
              <button onClick={() => setTargetOpen(false)} style={btnStyle(false)}>
                Close
              </button>
            </div>
          </div>

          {targetErr ? (
            <div
              style={{
                marginTop: 12,
                ...cardStyle(),
                background: "#fef2f2",
                borderColor: "#fecaca",
                color: "#991b1b",
              }}
            >
              {targetErr}
              <div style={{ marginTop: 6, fontSize: 12, color: "#7f1d1d" }}>
                Backend route required: <b>{LEADS_URL}/target-folder</b>
              </div>
            </div>
          ) : null}

          {targetLoading ? (
            <div style={{ marginTop: 12, color: "#6b7280" }}>Loading target folder...</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {targetGroups.length === 0 && !targetErr ? (
                <div style={{ color: "#6b7280" }}>No target leads found.</div>
              ) : null}

              {targetGroups.map((g) => (
                <div key={g.weekKey} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>Week: {g.weekLabel || g.weekKey}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Total: <b>{g.items?.length || 0}</b>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {(g.items || []).slice(0, 15).map((l) => (
                      <div key={l._id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{l.name}</div>
                        <span style={badgeStyle(l.status)}>{l.status}</span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {l.createdAt ? new Date(l.createdAt).toLocaleString() : "-"}
                        </span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          By: <b>{l.createdBy?.name || "-"}</b>
                        </span>
                      </div>
                    ))}
                    {(g.items || []).length > 15 ? (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Showing 15 of {g.items.length}</div>
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
        <div style={cardStyle()}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>📊 Target Dashboard</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Week / Month / Date-to-Date • Admin can filter by employee
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={loadTargetDashboard} style={btnStyle(false)}>
                {dashLoading ? "Loading..." : "Refresh"}
              </button>
              <button onClick={() => setDashOpen(false)} style={btnStyle(false)}>
                Close
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
              From
              <input
                type="datetime-local"
                value={tgFrom}
                onChange={(e) => setTgFrom(e.target.value)}
                style={inputStyle()}
              />
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
              <button type="button" onClick={presetThisWeek} style={btnStyle(false)}>
                This Week
              </button>
              <button type="button" onClick={presetThisMonth} style={btnStyle(false)}>
                This Month
              </button>
              <button type="button" onClick={loadTargetDashboard} style={btnStyle(true)}>
                Apply
              </button>
            </div>
          </div>

          {dashErr ? (
            <div
              style={{
                marginTop: 12,
                ...cardStyle(),
                background: "#fef2f2",
                borderColor: "#fecaca",
                color: "#991b1b",
              }}
            >
              {dashErr}
              <div style={{ marginTop: 6, fontSize: 12, color: "#7f1d1d" }}>
                Backend route required: <b>{LEADS_URL}/targets</b>
              </div>
            </div>
          ) : null}

          {/* Summary */}
          {dashData?.totals ? (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              {[
                ["Total", dashData.totals.total],
                ["New", dashData.totals.new],
                ["Contacted", dashData.totals.contacted],
                ["Demo", dashData.totals.demo],
                ["Won", dashData.totals.won],
                ["Lost", dashData.totals.lost],
              ].map(([k, v]) => (
                <div key={k} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{k}</div>
                  <div style={{ fontWeight: 900, fontSize: 20, marginTop: 2 }}>{v ?? 0}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Groups table */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Breakdown ({tgGroupBy})</div>

            {!dashLoading && (dashData?.groups || []).length === 0 ? (
              <div style={{ color: "#6b7280" }}>No data for selected range.</div>
            ) : null}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Period", "Total", "New", "Contacted", "Demo", "Won", "Lost"].map((h) => (
                      <th
                        key={h}
                        style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dashData?.groups || []).map((g, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>{g.label}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.total}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.new}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.contacted}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.demo}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.won}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6" }}>{g.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leaderboard */}
          {isAdminOrManager && (dashData?.leaderboard || []).length ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Employee Leaderboard (Created Leads)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {dashData.leaderboard.map((r) => (
                  <div
                    key={r.userId}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.name || "Employee"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{r.email || ""}</div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 12 }}>
                      <span>
                        Total: <b>{r.total}</b>
                      </span>
                      <span>
                        Demo: <b>{r.demo}</b>
                      </span>
                      <span>
                        Won: <b>{r.won}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filters */}
      <div style={{ ...cardStyle(), display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search student name / phone / city / email"
          style={{ flex: "1 1 260px", height: 40, borderRadius: 12, border: "1px solid #e5e7eb", padding: "0 12px" }}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 40, borderRadius: 12 }}>
          <option value="all">All Stages</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="demo">Demo</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />
          Today Follow-ups
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Pending
        </label>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          Role: <b>{user?.role || "-"}</b>
          {isAdminOrManager ? " • Team view enabled" : ""}
        </div>
      </div>

      {/* After Call Panel */}
      {afterCallOpenId ? (
        <div style={{ ...cardStyle(), border: "1px solid #111827" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 16 }}>After Call Update</b>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Timer: <b>{formatTimer(elapsedMs)}</b>
            </span>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={closeAfterCall} style={btnStyle(false)}>
                Close
              </button>
            </div>
          </div>

          {activeLead ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{activeLead.name}</div>
                <span style={badgeStyle(activeLead.status)}>{activeLead.status}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {activeLead.phone || "-"} {activeLead.city ? `• ${activeLead.city}` : ""}{" "}
                {activeLead.email ? `• ${activeLead.email}` : ""}
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
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#fff", border: "1px dashed #9ca3af" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Schedule Demo</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                      Demo Date/Time
                      <input type="datetime-local" value={demoDT} onChange={(e) => setDemoDT(e.target.value)} style={inputStyle()} />
                    </label>
                    <button onClick={confirmDemoSchedule} style={btnStyle(true)}>
                      Confirm
                    </button>
                    <button onClick={() => setDemoOpen(false)} style={btnStyle(false)}>
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
                    background: saveHot ? "#111827" : "#fff",
                    color: saveHot ? "#fff" : "#111827",
                  }}
                >
                  ✅ Save After Call
                </button>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => quickStatus(activeLead._id, "demo")} style={btnStyle(false)}>
                    Mark Demo
                  </button>
                  <button onClick={() => quickStatus(activeLead._id, "won")} style={btnStyle(false)}>
                    Mark Won
                  </button>
                  <button onClick={() => quickStatus(activeLead._id, "lost")} style={btnStyle(false)}>
                    Mark Lost
                  </button>
                </div>

                <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>Outcome auto-updates stage (Connected → Demo)</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: "#6b7280" }}>Lead not found.</div>
          )}
        </div>
      ) : null}

      {/* Lead List */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Student Leads</div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>
            Showing <b>{filtered.length}</b> of <b>{leads.length}</b>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ color: "#6b7280", padding: 10 }}>No leads found.</div>
          ) : (
            filtered.map((l) => {
              const tel = l.phone ? `tel:${String(l.phone).replace(/\s+/g, "")}` : null;
              const fu = l.nextFollowUp ? new Date(l.nextFollowUp) : null;

              const isOverdue = fu && fu.getTime() < Date.now() && !["won", "lost"].includes(l.status);
              const followBadge = isOverdue ? "overdue" : isToday(fu) ? "due" : null;

              return (
                <div key={l._id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{l.name}</div>
                        <span style={badgeStyle(l.status)}>{l.status}</span>
                        {followBadge ? <span style={badgeStyle(followBadge)}>{followBadge}</span> : null}
                      </div>

                      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                        {l.city || "-"} {l.email ? `• ${l.email}` : ""}{" "}
                        {l.assignedTo?.name ? `• Assigned: ${l.assignedTo.name}` : ""}
                        {l.createdBy?.name ? ` • CreatedBy: ${l.createdBy.name}` : ""}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {tel ? (
                          <a href={tel} onClick={() => openAfterCall(l)} style={{ fontWeight: 900, textDecoration: "none" }}>
                            📞 {l.phone}
                          </a>
                        ) : (
                          <span style={{ color: "#6b7280" }}>📞 -</span>
                        )}

                        {/* ✅ WhatsApp icon button */}
                        {l.phone ? (
                          <button
                            type="button"
                            onClick={() => openWhatsApp(l)}
                            title="WhatsApp"
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: "6px 10px",
                              cursor: "pointer",
                              background: "#fff",
                              fontWeight: 900,
                            }}
                          >
                            💬 WhatsApp
                          </button>
                        ) : null}

                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          Follow-up: <b>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "-"}</b>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => openAfterCall(l)} style={btnStyle(false)}>
                        After Call
                      </button>
                      <button onClick={() => openHistory(l)} style={btnStyle(false)}>
                        History
                      </button>

                      <button onClick={() => quickStatus(l._id, "demo")} style={btnStyle(false)}>
                        Demo
                      </button>
                      <button onClick={() => quickStatus(l._id, "won")} style={btnStyle(false)}>
                        Won
                      </button>
                      <button onClick={() => quickStatus(l._id, "lost")} style={btnStyle(false)}>
                        Lost
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>Tip: Phone click → After Call opens + timer. WhatsApp button opens wa.me.</div>
      </div>

      {/* ✅ Create Lead Modal (Education CRM) */}
      {createOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
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
              background: "#fff",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Create Student Lead</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Education CRM form — fast entry for counsellors</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button onClick={() => setCreateOpen(false)} style={btnStyle(false)}>
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={saveLeadFromModal} style={{ padding: 14, display: "grid", gap: 14 }}>
              <div>
                <div style={sectionTitle()}>Student Details</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                    Student Name*
                    <input
                      style={inputStyle()}
                      value={create.name}
                      onChange={(e) => setCreate((s) => ({ ...s, name: e.target.value }))}
                      placeholder="e.g., Aditi Sharma"
                    />
                  </label>

                  <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                    Phone*
                    <input
                      style={inputStyle()}
                      value={create.phone}
                      onChange={(e) => setCreate((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="e.g., 9876543210"
                    />
                  </label>

                  <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                    Email
                    <input
                      style={inputStyle()}
                      value={create.email}
                      onChange={(e) => setCreate((s) => ({ ...s, email: e.target.value }))}
                      placeholder="e.g., aditi@gmail.com"
                    />
                  </label>

                  <label style={{ ...labelStyle(), flex: "1 1 180px" }}>
                    City
                    <input
                      style={inputStyle()}
                      value={create.city}
                      onChange={(e) => setCreate((s) => ({ ...s, city: e.target.value }))}
                      placeholder="e.g., Delhi"
                    />
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

                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 26 }}>
                    <input
                      type="checkbox"
                      checked={create.whatsappSame}
                      onChange={(e) => setCreate((s) => ({ ...s, whatsappSame: e.target.checked }))}
                    />
                    Same as phone
                  </label>
                </div>
              </div>

              <div>
                <div style={sectionTitle()}>Course & Source</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ ...labelStyle(), flex: "1 1 260px" }}>
                    Course Interested
                    <select
                      style={selectStyle()}
                      value={create.course}
                      onChange={(e) => setCreate((s) => ({ ...s, course: e.target.value }))}
                    >
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
                      Other Course
                      <input
                        style={inputStyle()}
                        value={create.courseOther}
                        onChange={(e) => setCreate((s) => ({ ...s, courseOther: e.target.value }))}
                        placeholder="Course name"
                      />
                    </label>
                  ) : null}

                  <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                    Lead Source
                    <select
                      style={selectStyle()}
                      value={create.source}
                      onChange={(e) => setCreate((s) => ({ ...s, source: e.target.value }))}
                    >
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
                    <select
                      style={selectStyle()}
                      value={create.budget}
                      onChange={(e) => setCreate((s) => ({ ...s, budget: e.target.value }))}
                    >
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
                    Mode
                    <select style={selectStyle()} value={create.mode} onChange={(e) => setCreate((s) => ({ ...s, mode: e.target.value }))}>
                      <option>Online</option>
                      <option>Offline</option>
                      <option>Hybrid</option>
                    </select>
                  </label>

                  <label style={{ ...labelStyle(), flex: "1 1 220px" }}>
                    Preferred Batch
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
                    <input
                      type="datetime-local"
                      style={inputStyle()}
                      value={create.nextFollowUp}
                      onChange={(e) => setCreate((s) => ({ ...s, nextFollowUp: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div>
                <div style={sectionTitle()}>Counsellor Note</div>
                <label style={labelStyle()}>
                  First Note (optional)
                  <input
                    style={inputStyle()}
                    value={create.note}
                    onChange={(e) => setCreate((s) => ({ ...s, note: e.target.value }))}
                    placeholder="e.g., student wants demo tomorrow 6pm"
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                <button type="button" onClick={() => setCreateOpen(false)} style={btnStyle(false)}>
                  Cancel
                </button>
                <button type="submit" style={btnStyle(true)}>
                  ✅ Save Student Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* History Drawer */}
      {historyOpen ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: 420,
            maxWidth: "92vw",
            background: "#fff",
            borderLeft: "1px solid #e5e7eb",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.08)",
            padding: 16,
            zIndex: 70,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>History</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {historyLead?.name || "-"} {historyLead?.phone ? `• ${historyLead.phone}` : ""}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={closeHistory} style={btnStyle(false)}>
                Close
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {historyErr ? (
              <div style={{ ...cardStyle(), background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>{historyErr}</div>
            ) : null}

            {historyItems.length === 0 && !historyErr ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {historyItems.map((h) => (
                <div key={h._id || `${h.createdAt}-${Math.random()}`} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{h.createdAt ? new Date(h.createdAt).toLocaleString() : "-"}</div>
                  <div style={{ marginTop: 4, fontWeight: 800 }}>
                    {(h.actor?.name || h.actorName || h.actorId?.name || "User")} — {(h.action || h.title || "update")}
                  </div>

                  {h?.meta?.text ? <div style={{ marginTop: 6 }}>{h.meta.text}</div> : null}
                  {h?.meta?.note ? <div style={{ marginTop: 6 }}>{h.meta.note}</div> : null}

                  {h.meta ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{typeof h.meta === "string" ? h.meta : JSON.stringify(h.meta)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
