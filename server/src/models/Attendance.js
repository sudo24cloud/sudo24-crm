const PDFDocument = require("pdfkit");
const express = require("express");
const Attendance = require("../models/Attendance");
const EmployeePolicy = require("../models/EmployeePolicy");
const User = require("../models/User");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/** =========================
 *  IST helpers (correct)
 *  ========================= */
function dateKeyIST(d = new Date()) {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 330 * 60000);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minsBetween(a, b) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

/** =========================
 *  Geo helpers
 *  ========================= */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** =========================
 *  Policy (fallback)
 *  ========================= */
async function getPolicy(companyId, userId) {
  const p = await EmployeePolicy.findOne({ companyId, userId });
  return (
    p || {
      requireSelfieIn: true,
      requireSelfieOut: true,
      requireLocationIn: true,
      requireLocationOut: true,

      breaksEnabled: true,

      geoFenceEnabled: false,
      geoCenterLat: null,
      geoCenterLng: null,
      geoRadiusMeters: 150,

      // attendance rules
      fullDayNetMin: 360, // 6 hours
      maxBreakMin: 60 // 1 hour total
    }
  );
}

/** =========================
 *  compute totals + full day
 *  ========================= */
function recomputeTotals(doc, policy) {
  const totalMin = doc.checkInAt && doc.checkOutAt ? minsBetween(doc.checkInAt, doc.checkOutAt) : 0;

  let breakMin = 0;
  for (const b of doc.breaks || []) {
    if (typeof b.durationMin === "number" && b.durationMin > 0) breakMin += b.durationMin;
    else if (b.startAt && b.endAt) breakMin += minsBetween(b.startAt, b.endAt);
  }

  const netWorkMin = Math.max(0, totalMin - breakMin);

  doc.totalMin = totalMin;
  doc.breakMin = breakMin;
  doc.netWorkMin = netWorkMin;

  const fullNet = Number(policy?.fullDayNetMin || 360);
  const maxBrk = Number(policy?.maxBreakMin || 60);

  doc.isFullDay = netWorkMin >= fullNet && breakMin <= maxBrk;

  return doc;
}

/** =========================
 *  photo logger (model photos[])
 *  ========================= */
function pushPhoto(doc, kind, { photoUrl, photoBase64, lat, lng, accuracy } = {}) {
  const url = photoUrl || "";
  const base64 = photoBase64 || "";
  const geo =
    lat == null || lng == null
      ? null
      : { lat: Number(lat), lng: Number(lng), accuracy: accuracy == null ? undefined : Number(accuracy) };

  doc.photos.push({
    kind,
    url,
    base64,
    at: new Date(),
    geo
  });
}

/** =========================
 *  EMPLOYEE: today
 *  ========================= */
router.get("/me/today", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });
    res.json(doc || null);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: check-in
 *  expects { photoUrl OR photoBase64, lat, lng, accuracy }
 *  ========================= */
router.post("/me/checkin", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);

    const { photoUrl, photoBase64, lat, lng, accuracy } = req.body || {};
    const photo = photoUrl || photoBase64 || "";

    if (policy.requireSelfieIn && !photo) return res.status(400).json({ message: "Selfie required for check-in" });
    if (policy.requireLocationIn && (lat == null || lng == null))
      return res.status(400).json({ message: "Location required for check-in" });

    if (policy.geoFenceEnabled && policy.requireLocationIn) {
      const dist = haversineMeters(
        Number(policy.geoCenterLat),
        Number(policy.geoCenterLng),
        Number(lat),
        Number(lng)
      );
      if (dist > Number(policy.geoRadiusMeters || 150)) {
        return res.status(403).json({ message: "Outside allowed location radius" });
      }
    }

    // prevent double check-in
    const existing = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (existing?.checkInAt) return res.status(400).json({ message: "Already checked-in today" });
    if (existing?.checkOutAt) return res.status(400).json({ message: "Already checked-out today" });

    const doc = await Attendance.findOneAndUpdate(
      { companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk },
      { $setOnInsert: { companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk } },
      { upsert: true, new: true }
    );

    doc.checkInAt = new Date();
    doc.status = "in_progress";
    pushPhoto(doc, "checkin", { photoUrl, photoBase64, lat, lng, accuracy });

    await doc.save();
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: start break
 *  expects { note, photoUrl/photoBase64, lat,lng,accuracy }
 *  ========================= */
router.post("/me/break/start", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);
    if (!policy.breaksEnabled) return res.status(403).json({ message: "Breaks disabled for you" });

    const { note, photoUrl, photoBase64, lat, lng, accuracy } = req.body || {};

    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (!doc?.checkInAt) return res.status(400).json({ message: "Check-in first" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (open) return res.status(400).json({ message: "A break is already running" });

    doc.breaks.push({ startAt: new Date(), endAt: null, durationMin: 0 });
    // log photo
    pushPhoto(doc, "breakstart", { photoUrl, photoBase64, lat, lng, accuracy });
    if (note) doc.remark = String(note).slice(0, 500);

    await doc.save();
    res.json(doc);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: end break
 *  expects { note, photoUrl/photoBase64, lat,lng,accuracy }
 *  ========================= */
router.post("/me/break/end", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const { note, photoUrl, photoBase64, lat, lng, accuracy } = req.body || {};

    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (!doc) return res.status(400).json({ message: "No attendance today" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (!open) return res.status(400).json({ message: "No running break" });

    open.endAt = new Date();
    open.durationMin = minsBetween(open.startAt, open.endAt);

    pushPhoto(doc, "breakend", { photoUrl, photoBase64, lat, lng, accuracy });
    if (note) doc.remark = String(note).slice(0, 500);

    await doc.save();
    res.json(doc);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: check-out
 *  expects { photoUrl OR photoBase64, lat, lng, accuracy }
 *  ========================= */
router.post("/me/checkout", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);

    const { photoUrl, photoBase64, lat, lng, accuracy } = req.body || {};
    const photo = photoUrl || photoBase64 || "";

    if (policy.requireSelfieOut && !photo) return res.status(400).json({ message: "Selfie required for check-out" });
    if (policy.requireLocationOut && (lat == null || lng == null))
      return res.status(400).json({ message: "Location required for check-out" });

    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (!doc?.checkInAt) return res.status(400).json({ message: "Check-in first" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (open) return res.status(400).json({ message: "End break before check-out" });

    doc.checkOutAt = new Date();
    doc.status = "checked_out";
    pushPhoto(doc, "checkout", { photoUrl, photoBase64, lat, lng, accuracy });

    recomputeTotals(doc, policy);
    await doc.save();

    res.json(doc);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE REPORT: range
 *  GET /me/report?from=YYYY-MM-DD&to=YYYY-MM-DD
 *  ========================= */
router.get("/me/report", authRequired, attachUser, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    if (!from || !to) return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });

    const rows = await Attendance.find({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: { $gte: String(from), $lte: String(to) }
    }).sort({ dateKey: -1 });

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  ADMIN: daily list
 *  ========================= */
router.get("/admin/list", authRequired, attachUser, authorizeRoles("admin"), async (req, res) => {
  try {
    const dk = req.query.dateKey || dateKeyIST();
    const rows = await Attendance.find({ companyId: req.dbUser.companyId, dateKey: dk })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  ADMIN: range report (+ optional userId)
 *  ========================= */
router.get("/admin/report", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { from, to, userId } = req.query || {};
    if (!from || !to) return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });

    const q = {
      companyId: req.dbUser.companyId,
      dateKey: { $gte: String(from), $lte: String(to) }
    };
    if (userId) q.userId = userId;

    const rows = await Attendance.find(q)
      .populate("userId", "name email role managerId")
      .sort({ dateKey: -1 });

    if (req.dbUser.role === "manager") {
      const filtered = rows.filter((r) => String(r.userId?.managerId || "") === String(req.dbUser._id));
      return res.json(filtered);
    }

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  ✅ Admin PDF (daily) — Net/Break from stored mins
 *  ========================= */
router.get("/admin/report.pdf", authRequired, attachUser, authorizeRoles("admin"), async (req, res) => {
  try {
    const dk = req.query.dateKey || dateKeyIST();

    const rows = await Attendance.find({ companyId: req.dbUser.companyId, dateKey: dk })
      .populate("userId", "name email role")
      .sort({ "userId.name": 1 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${dk}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 30 });
    doc.pipe(res);

    doc.fontSize(16).text("SUDO24 CRM — Attendance Report", { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Date: ${dk}`);
    doc.moveDown(0.8);

    const line = () => doc.moveTo(30, doc.y).lineTo(565, doc.y).strokeColor("#dddddd").stroke();

    doc.fontSize(10).fillColor("#000");
    doc.text("Employee", 30, doc.y, { width: 170 });
    doc.text("In", 200, doc.y, { width: 90 });
    doc.text("Out", 290, doc.y, { width: 90 });
    doc.text("Net", 380, doc.y, { width: 50 });
    doc.text("Break", 430, doc.y, { width: 50 });
    doc.text("FullDay", 480, doc.y, { width: 60 });
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.4);

    const minToHM = (min) => {
      const m = Math.max(0, Number(min || 0));
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}h ${mm}m`;
    };

    for (const r of rows) {
      if (doc.y > 760) doc.addPage();

      const employee = `${r.userId?.name || "User"} (${r.userId?.role || ""})`;
      const inTime = r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-";
      const outTime = r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-";

      doc.fontSize(9).fillColor("#000");
      doc.text(employee, 30, doc.y, { width: 170 });
      doc.text(inTime, 200, doc.y, { width: 90 });
      doc.text(outTime, 290, doc.y, { width: 90 });
      doc.text(minToHM(r.netWorkMin), 380, doc.y, { width: 50 });
      doc.text(minToHM(r.breakMin), 430, doc.y, { width: 50 });
      doc.text(r.isFullDay ? "YES" : "NO", 480, doc.y, { width: 60 });

      doc.moveDown(0.6);
    }

    doc.moveDown(0.2);
    line();
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor("#666").text("Generated by SUDO24 CRM");

    doc.end();
  } catch {
    return res.status(500).json({ message: "PDF report error" });
  }
});

/** =========================
 *  ✅ Delete attendance (Admin OR Manager team)
 *  ========================= */
router.delete("/:attendanceId", authRequired, attachUser, async (req, res) => {
  try {
    const row = await Attendance.findOne({ _id: req.params.attendanceId, companyId: req.dbUser.companyId });
    if (!row) return res.status(404).json({ message: "Attendance not found" });

    if (req.dbUser.role === "admin") {
      await Attendance.deleteOne({ _id: row._id });
      return res.json({ ok: true });
    }

    if (req.dbUser.role === "manager") {
      const emp = await User.findOne({
        _id: row.userId,
        companyId: req.dbUser.companyId,
        managerId: req.dbUser._id,
        role: "employee"
      }).select("_id");

      if (!emp) return res.status(403).json({ message: "Forbidden" });

      await Attendance.deleteOne({ _id: row._id });
      return res.json({ ok: true });
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
