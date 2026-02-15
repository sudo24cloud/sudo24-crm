const express = require("express");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Company = require("../models/Company");
const Activity = require("../models/Activity"); // ✅ for /history
const MessageLog = require("../models/MessageLog"); // ✅ for WhatsApp history

const { getPlanLimits } = require("../config/plan");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");
const { logActivity } = require("../utils/logActivity");

const router = express.Router();

/* ===================== ✅ Step-1 Helper: Phone Normalize ===================== */
function normalizePhone(raw) {
  // keep only digits and optional leading +
  // examples:
  // "+91 98765-43210" -> "+919876543210"
  // "98765 43210" -> "9876543210"
  const s = String(raw || "").trim();
  if (!s) return "";
  // keep + only if it's the first char
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

async function getLeadFilter(dbUser) {
  const base = { companyId: dbUser.companyId };

  if (dbUser.role === "admin") return base;
  if (dbUser.role === "employee") return { ...base, assignedTo: dbUser._id };

  // manager: self + team
  const teamEmployees = await User.find({
    companyId: dbUser.companyId,
    managerId: dbUser._id,
    role: "employee"
  }).select("_id");

  const teamIds = teamEmployees.map((u) => u._id);
  return { ...base, $or: [{ assignedTo: dbUser._id }, { assignedTo: { $in: teamIds } }] };
}

/* ===================== GET Leads ===================== */
router.get("/", authRequired, attachUser, async (req, res) => {
  try {
    const filter = await getLeadFilter(req.dbUser);

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .sort({ updatedAt: -1 });

    res.json(leads);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== Followups list ===================== */
router.get("/followups", authRequired, attachUser, async (req, res) => {
  try {
    const filter = await getLeadFilter(req.dbUser);

    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 7 * 86400000);

    const leads = await Lead.find({
      ...filter,
      nextFollowUp: { $ne: null, $gte: from, $lte: to }
    })
      .populate("assignedTo", "name role")
      .sort({ nextFollowUp: 1 });

    res.json(leads);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== CREATE Lead (plan lead limit) ===================== */
router.post("/", authRequired, attachUser, async (req, res) => {
  try {
    const { name, phone, email, city, status, assignedTo, nextFollowUp } = req.body || {};
    if (!name) return res.status(400).json({ message: "Lead name required" });

    const company = await Company.findById(req.dbUser.companyId).select("plan");
    if (!company) return res.status(404).json({ message: "Company not found" });

    const limits = getPlanLimits(company.plan);
    const leadCount = await Lead.countDocuments({ companyId: company._id });
    if (leadCount >= limits.maxLeads) {
      return res.status(403).json({ message: `Lead limit reached for ${company.plan} plan` });
    }

    let safeAssignedTo = assignedTo || null;
    if (req.dbUser.role === "employee") safeAssignedTo = req.dbUser._id;

    if (safeAssignedTo) {
      const assignee = await User.findOne({ _id: safeAssignedTo, companyId: req.dbUser.companyId }).select("_id");
      if (!assignee) return res.status(400).json({ message: "Assignee must be in same company" });
    }

    const lead = await Lead.create({
      companyId: req.dbUser.companyId,
      name,
      phone: phone || "",
      email: email || "",
      city: city || "",
      status: status || "new",
      assignedTo: safeAssignedTo,
      createdBy: req.dbUser._id,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null
    });

    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "lead",
      entityId: lead._id,
      action: "lead_created",
      meta: { name: lead.name, status: lead.status }
    });

    res.json(lead);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== ADD NOTE ===================== */
router.post("/:id/notes", authRequired, attachUser, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ message: "Note text required" });

    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.dbUser.role === "employee" && String(lead.assignedTo) !== String(req.dbUser._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    lead.notes = lead.notes || [];
    lead.notes.push({ by: req.dbUser._id, text: String(text).trim() });
    await lead.save();

    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "lead",
      entityId: lead._id,
      action: "note_added",
      meta: { note: String(text).trim().slice(0, 120) }
    });

    res.json(lead);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== UPDATE Lead ===================== */
router.patch("/:id", authRequired, attachUser, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.dbUser.role === "employee" && String(lead.assignedTo) !== String(req.dbUser._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const beforeStatus = lead.status;
    const beforeFollowUp = lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString() : null;

    const allowedFields = ["name", "phone", "email", "city", "status", "nextFollowUp"];
    for (const key of allowedFields) {
      if (key in req.body) {
        lead[key] = key === "nextFollowUp"
          ? (req.body[key] ? new Date(req.body[key]) : null)
          : req.body[key];
      }
    }

    await lead.save();

    // ✅ status change log
    if ("status" in req.body && beforeStatus !== lead.status) {
      await logActivity({
        companyId: req.dbUser.companyId,
        actorId: req.dbUser._id,
        entityType: "lead",
        entityId: lead._id,
        action: "status_changed",
        meta: { from: beforeStatus, to: lead.status }
      });
    }

    // ✅ followup change log
    if ("nextFollowUp" in req.body) {
      const afterFollowUp = lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString() : null;
      if (beforeFollowUp !== afterFollowUp) {
        await logActivity({
          companyId: req.dbUser.companyId,
          actorId: req.dbUser._id,
          entityType: "lead",
          entityId: lead._id,
          action: "followup_changed",
          meta: { from: beforeFollowUp, to: afterFollowUp }
        });
      }
    }

    res.json(lead);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== CALL LOG (Outcome + Duration) ===================== */
/**
 * POST /api/leads/:id/call-log
 * body: { outcome, durationSec, note?, nextFollowUp? }
 */
router.post("/:id/call-log", authRequired, attachUser, async (req, res) => {
  try {
    const { outcome, durationSec, note, nextFollowUp } = req.body || {};
    if (!outcome) return res.status(400).json({ message: "outcome required" });

    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.dbUser.role === "employee" && String(lead.assignedTo) !== String(req.dbUser._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (nextFollowUp) lead.nextFollowUp = new Date(nextFollowUp);

    const noteText = String(note || "").trim();
    if (noteText) {
      lead.notes = lead.notes || [];
      lead.notes.push({ by: req.dbUser._id, text: noteText });
    }

    await lead.save();

    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "lead",
      entityId: lead._id,
      action: "call_logged",
      meta: {
        outcome,
        durationSec: Number(durationSec || 0),
        nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString() : null
      }
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== WhatsApp LOG (simple / log-only) ===================== */
/**
 * POST /api/leads/:id/whatsapp
 * body: { templateName?, messageText, toPhone? }
 * NOTE: Abhi only log save karega (real send later)
 */
router.post("/:id/whatsapp", authRequired, attachUser, async (req, res) => {
  try {
    const { templateName, messageText, toPhone } = req.body || {};
    if (!messageText || !String(messageText).trim()) {
      return res.status(400).json({ message: "messageText required" });
    }

    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // employee can only message own assigned lead
    if (req.dbUser.role === "employee" && String(lead.assignedTo) !== String(req.dbUser._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    /* ✅ Step-1 FIX: normalize phone */
    const phone = normalizePhone(toPhone || lead.phone || "");
    if (!phone) return res.status(400).json({ message: "Lead phone missing" });

    // ✅ Save log
    const log = await MessageLog.create({
      companyId: req.dbUser.companyId,
      leadId: lead._id,
      channel: "whatsapp",
      toPhone: phone,
      templateName: String(templateName || ""),
      messageText: String(messageText).trim(),
      sentBy: req.dbUser._id,
      status: "queued"
    });

    // ✅ Activity log
    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "lead",
      entityId: lead._id,
      action: "whatsapp_queued",
      meta: { toPhone: phone, templateName: String(templateName || "") }
    });

    res.json({ ok: true, logId: String(log._id) });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== HISTORY ENDPOINT (Activity + Notes + WhatsApp) ===================== */
/**
 * GET /api/leads/:id/history
 */
router.get("/:id/history", authRequired, attachUser, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId })
      .populate("notes.by", "name role email");

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.dbUser.role === "employee" && String(lead.assignedTo) !== String(req.dbUser._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 1) Activity
    const acts = await Activity.find({
      companyId: req.dbUser.companyId,
      entityType: "lead",
      entityId: lead._id
    })
      .populate("actorId", "name role email")
      .sort({ createdAt: -1 })
      .limit(200);

    const actItems = acts.map((a) => ({
      type: "activity",
      action: a.action,
      meta: a.meta || {},
      createdAt: a.createdAt,
      actor: a.actorId ? { name: a.actorId.name, role: a.actorId.role } : { name: "User", role: "" }
    }));

    // 2) Notes
    const noteItems = (lead.notes || []).map((n) => ({
      type: "note",
      createdAt: n.createdAt || new Date(),
      actor: n.by ? { name: n.by.name, role: n.by.role } : { name: "User", role: "" },
      meta: { text: n.text }
    }));

    // 3) WhatsApp logs
    const waRows = await MessageLog.find({
      companyId: req.dbUser.companyId,
      leadId: lead._id,
      channel: "whatsapp"
    })
      .populate("sentBy", "name role email")
      .sort({ createdAt: -1 })
      .limit(200);

    const waItems = waRows.map((m) => ({
      type: "whatsapp",
      createdAt: m.createdAt,
      actor: m.sentBy ? { name: m.sentBy.name, role: m.sentBy.role } : { name: "System", role: "" },
      meta: {
        toPhone: m.toPhone,
        templateName: m.templateName || "",
        text: m.messageText || "",
        status: m.status || "queued",
        providerMessageId: m.providerMessageId || "",
        error: m.error || ""
      }
    }));

    /* ✅ Step-1 FIX: stable sort (ensure valid dates) */
    const all = [...actItems, ...noteItems, ...waItems].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });

    res.json(all);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== ASSIGN Lead ===================== */
router.post("/:id/assign", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId required" });

    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const assignee = await User.findOne({ _id: userId, companyId: req.dbUser.companyId }).select("_id managerId");
    if (!assignee) return res.status(400).json({ message: "Assignee must be in same company" });

    if (req.dbUser.role === "manager") {
      if (String(userId) !== String(req.dbUser._id)) {
        const emp = await User.findOne({
          _id: userId,
          managerId: req.dbUser._id,
          companyId: req.dbUser.companyId
        }).select("_id");
        if (!emp) return res.status(403).json({ message: "Manager can assign only to own team" });
      }
    }

    const before = lead.assignedTo ? String(lead.assignedTo) : null;
    lead.assignedTo = userId;
    await lead.save();

    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "lead",
      entityId: lead._id,
      action: "assigned",
      meta: { from: before, to: String(userId) }
    });

    res.json(lead);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================== CSV IMPORT/EXPORT + BULK ASSIGN (unchanged) ===================== */

function toCSVValue(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function parseCSV(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return { headers: [], rows: [] };

  const splitLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  };

  const headers = splitLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cols = splitLine(line);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    return obj;
  });

  return { headers, rows };
}

function parseFollowUp(s) {
  const str = String(s || "").trim();
  if (!str) return null;
  const normalized = str.replace("T", " ");
  const m = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (!m) return null;
  const dt = new Date(`${m[1]}T${m[2]}:00`);
  return isNaN(dt.getTime()) ? null : dt;
}

// ✅ EXPORT CSV
router.get("/export", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const filter = await getLeadFilter(req.dbUser);

    const leads = await Lead.find(filter)
      .populate("assignedTo", "email name role")
      .sort({ createdAt: -1 })
      .limit(5000);

    const header = ["name","phone","email","city","status","nextFollowUp","assignedToEmail","createdAt"];
    const csv = [
      header.join(","),
      ...leads.map(l => ([
        toCSVValue(l.name),
        toCSVValue(l.phone),
        toCSVValue(l.email),
        toCSVValue(l.city),
        toCSVValue(l.status),
        toCSVValue(l.nextFollowUp ? new Date(l.nextFollowUp).toISOString() : ""),
        toCSVValue(l.assignedTo?.email || ""),
        toCSVValue(l.createdAt ? new Date(l.createdAt).toISOString() : "")
      ].join(",")))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads_export.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ IMPORT CSV
router.post("/import", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { csvText } = req.body || {};
    if (!csvText) return res.status(400).json({ message: "csvText required" });

    const { rows } = parseCSV(csvText);
    if (!rows.length) return res.status(400).json({ message: "No rows found in CSV" });

    const users = await User.find({ companyId: req.dbUser.companyId }).select("_id email role managerId");
    const byEmail = new Map(users.map(u => [String(u.email).toLowerCase(), u]));

    const allowedStatus = new Set(["new","contacted","demo","won","lost"]);
    const toInsert = [];
    const errors = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const name = String(r.name || "").trim();
      if (!name) { errors.push({ row: idx + 2, error: "name required" }); continue; }

      const phone = String(r.phone || "").trim();
      const email = String(r.email || "").trim();
      const city = String(r.city || "").trim();

      const statusRaw = String(r.status || "new").trim().toLowerCase();
      const status = allowedStatus.has(statusRaw) ? statusRaw : "new";

      const nextFollowUp = parseFollowUp(r.nextFollowUp);

      let assignedTo = null;
      const aEmail = String(r.assignedToEmail || "").trim().toLowerCase();
      if (aEmail) {
        const u = byEmail.get(aEmail);
        if (!u) {
          errors.push({ row: idx + 2, error: `assignedToEmail not found in company: ${aEmail}` });
          continue;
        }

        if (req.dbUser.role === "manager") {
          const ok = String(u._id) === String(req.dbUser._id) || String(u.managerId) === String(req.dbUser._id);
          if (!ok) { errors.push({ row: idx + 2, error: "Manager can assign only to own team" }); continue; }
        }

        assignedTo = u._id;
      } else {
        assignedTo = req.dbUser.role === "manager" ? req.dbUser._id : null;
      }

      toInsert.push({
        companyId: req.dbUser.companyId,
        name,
        phone,
        email,
        city,
        status,
        assignedTo,
        createdBy: req.dbUser._id,
        nextFollowUp: nextFollowUp || null
      });
    }

    const inserted = await Lead.insertMany(toInsert, { ordered: false });

    res.json({
      ok: true,
      inserted: inserted.length,
      failed: errors.length,
      errors: errors.slice(0, 50)
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ BULK ASSIGN
router.post("/bulk-assign", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { leadIds, userId } = req.body || {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) return res.status(400).json({ message: "leadIds array required" });
    if (!userId) return res.status(400).json({ message: "userId required" });

    const assignee = await User.findOne({ _id: userId, companyId: req.dbUser.companyId }).select("_id managerId");
    if (!assignee) return res.status(400).json({ message: "Assignee must be in same company" });

    if (req.dbUser.role === "manager") {
      const ok = String(userId) === String(req.dbUser._id) || String(assignee.managerId) === String(req.dbUser._id);
      if (!ok) return res.status(403).json({ message: "Manager can assign only to own team" });
    }

    const q = { _id: { $in: leadIds }, companyId: req.dbUser.companyId };

    if (req.dbUser.role === "manager") {
      const filter = await getLeadFilter(req.dbUser);
      Object.assign(q, filter);
    }

    const r = await Lead.updateMany(q, { $set: { assignedTo: userId } });
    res.json({ ok: true, modified: r.modifiedCount || 0 });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});
/* ===================== EMPLOYEE TARGET FOLDER ===================== */
/**
 * GET /api/leads/target-folder?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - Employee: only leads created by that employee
 * - Admin/Manager: can view all employees' created leads (company wise)
 * Returns:
 *  {
 *    range: { from, to },
 *    groups: [{ weekKey, weekLabel, items: [lead...] }]
 *  }
 */
router.get("/target-folder", authRequired, attachUser, async (req, res) => {
  try {
    const companyId = req.dbUser.companyId;

    // default range: last 30 days
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 1 * 86400000);

    const base = {
      companyId,
      createdAt: { $gte: from, $lte: to }
    };

    // ✅ Employee: only their own created leads
    if (req.dbUser.role === "employee") {
      base.createdBy = req.dbUser._id;
    }

    // ✅ Admin/Manager: company ke sab employee-created leads
    // (optional) If you want ONLY employee-created, keep as-is.
    // If you want also manager/admin created in target folder, remove role filter below.
    // Here: ONLY employee created
    const users = await User.find({ companyId, role: "employee" }).select("_id");
    const employeeIds = users.map(u => u._id);
    base.createdBy = base.createdBy || { $in: employeeIds };

    const leads = await Lead.find(base)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(5000);

    // ===== group by ISO week =====
    function getISOWeekKey(d) {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
      const year = date.getUTCFullYear();
      return `${year}-W${String(weekNo).padStart(2, "0")}`;
    }

    function weekLabelFromKey(key) {
      // Simple label, UI can show key; keep minimal
      return key;
    }

    const map = new Map();
    for (const l of leads) {
      const wk = getISOWeekKey(new Date(l.createdAt));
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk).push(l);
    }

    const groups = Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([weekKey, items]) => ({
        weekKey,
        weekLabel: weekLabelFromKey(weekKey),
        items
      }));

    res.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      groups
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});
/* ===================== TARGET DASHBOARD (Created Leads) ===================== */
/**
 * GET /api/leads/targets
 * Query:
 *  - from=ISO date (optional)
 *  - to=ISO date (optional)
 *  - groupBy=day|week|month (default week)
 *  - createdBy=userId (admin/manager only) OR "all"
 *
 * Employee: only self createdBy allowed automatically
 * Admin/Manager: can see all + filter by employee
 */
router.get("/targets", authRequired, attachUser, async (req, res) => {
  try {
    const dbUser = req.dbUser;

    const groupBy = String(req.query.groupBy || "week"); // day|week|month
    const createdByQ = String(req.query.createdBy || "all");

    // default range: this month
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : defaultTo;

    const match = {
      companyId: dbUser.companyId,
      createdAt: { $gte: from, $lt: to }
    };

    // permissions for createdBy filter
    if (dbUser.role === "employee") {
      match.createdBy = dbUser._id;
    } else {
      // admin/manager
      if (createdByQ && createdByQ !== "all") {
        // validate the employee exists in same company
        const u = await User.findOne({ _id: createdByQ, companyId: dbUser.companyId }).select("_id");
        if (!u) return res.status(400).json({ message: "Invalid createdBy filter" });
        match.createdBy = u._id;
      }
    }

    // group key
    let groupId = null;
    let labelExpr = null;

    if (groupBy === "day") {
      groupId = { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } };
      labelExpr = "$_id.day";
    } else if (groupBy === "month") {
      groupId = { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } };
      labelExpr = {
        $concat: [
          { $toString: "$_id.y" }, "-",
          { $cond: [{ $lt: ["$_id.m", 10] }, "0", ""] },
          { $toString: "$_id.m" }
        ]
      };
    } else {
      // week (ISO week)
      groupId = { y: { $isoWeekYear: "$createdAt" }, w: { $isoWeek: "$createdAt" } };
      labelExpr = {
        $concat: [
          "W", { $toString: "$_id.w" }, " - ", { $toString: "$_id.y" }
        ]
      };
    }

    const baseAgg = [
      { $match: match },
      {
        $group: {
          _id: groupId,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
          contacted: { $sum: { $cond: [{ $eq: ["$status", "contacted"] }, 1, 0] } },
          demo: { $sum: { $cond: [{ $eq: ["$status", "demo"] }, 1, 0] } },
          won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          key: "$_id",
          label: labelExpr,
          total: 1,
          new: 1,
          contacted: 1,
          demo: 1,
          won: 1,
          lost: 1
        }
      },
      { $sort: { label: 1 } }
    ];

    const groups = await Lead.aggregate(baseAgg);

    // totals
    const totals = groups.reduce(
      (acc, g) => {
        acc.total += g.total || 0;
        acc.new += g.new || 0;
        acc.contacted += g.contacted || 0;
        acc.demo += g.demo || 0;
        acc.won += g.won || 0;
        acc.lost += g.lost || 0;
        return acc;
      },
      { total: 0, new: 0, contacted: 0, demo: 0, won: 0, lost: 0 }
    );

    // Admin/Manager leaderboard by employee (createdBy)
    let leaderboard = [];
    let employees = [];

    if (dbUser.role !== "employee") {
      employees = await User.find({ companyId: dbUser.companyId, role: "employee" })
        .select("_id name email role")
        .sort({ name: 1 });

      const lbAgg = [
        { $match: { companyId: dbUser.companyId, createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: "$createdBy",
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
            demo: { $sum: { $cond: [{ $eq: ["$status", "demo"] }, 1, 0] } }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "u"
          }
        },
        { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: "$u.name",
            email: "$u.email",
            total: 1,
            won: 1,
            demo: 1
          }
        }
      ];

      leaderboard = await Lead.aggregate(lbAgg);

      // if admin filtered a specific createdBy, leaderboard not needed (still ok to return)
      if (createdByQ && createdByQ !== "all") {
        leaderboard = [];
      }
    }

    res.json({
      ok: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      groupBy,
      createdBy: dbUser.role === "employee" ? String(dbUser._id) : createdByQ,
      totals,
      groups,
      employees,
      leaderboard
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
