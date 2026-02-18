const PDFDocument = require("pdfkit");
const express = require("express");
const Attendance = require("../models/Attendance");
const EmployeePolicy = require("../models/EmployeePolicy");
const User = require("../models/User");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/** IST dateKey */
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

/** payload helper: supports BOTH formats
 *  A) { photoBase64, lat, lng, accuracy }
 *  B) { photoBase64, geo: {lat,lng,accuracy} }
 */
function readGeo(body = {}) {
  const g = body.geo || {};
  const lat = body.lat ?? g.lat ?? null;
  const lng = body.lng ?? g.lng ?? null;
  const accuracy = body.accuracy ?? g.accuracy ?? null;
  return { lat, lng, accuracy };
}

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

      fullDayNetMin: 360,
      maxBreakMin: 60
    }
  );
}

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

function ensureArrays(doc) {
  if (!Array.isArray(doc.breaks)) doc.breaks = [];
  if (!Array.isArray(doc.photos)) doc.photos = [];
}

function pushPhoto(doc, kind, { photoUrl, photoBase64, lat, lng, accuracy } = {}) {
  ensureArrays(doc);

  const url = photoUrl || "";
  const base64 = photoBase64 || "";
  const geo =
    lat == null || lng == null
      ? null
      : { lat: Number(lat), lng: Number(lng), accuracy: accuracy == null ? null : Number(accuracy) };

  doc.photos.push({ kind, url, base64, at: new Date(), geo });
}

/** EMPLOYEE: today */
router.get("/me/today", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });
    res.json(doc || null);
  } catch (e) {
    console.error("❌ /me/today error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** EMPLOYEE: checkin */
router.post("/me/checkin", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);

    const { photoUrl, photoBase64 } = req.body || {};
    const { lat, lng, accuracy } = readGeo(req.body);
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

    ensureArrays(doc);

    doc.checkInAt = new Date();
    doc.status = "in_progress";

    // legacy (optional)
    doc.checkInPhotoUrl = photoUrl ? photoUrl : "";
    doc.checkInPhotoBase64 = photoBase64 ? photoBase64 : "";
    doc.checkInLat = lat == null ? null : Number(lat);
    doc.checkInLng = lng == null ? null : Number(lng);
    doc.checkInAccuracy = accuracy == null ? null : Number(accuracy);

    pushPhoto(doc, "checkin", { photoUrl, photoBase64, lat, lng, accuracy });

    await doc.save();
    res.json(doc);
  } catch (e) {
    console.error("❌ /me/checkin error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** BREAK START */
router.post("/me/break/start", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);
    if (!policy.breaksEnabled) return res.status(403).json({ message: "Breaks disabled for you" });

    const { note, photoUrl, photoBase64 } = req.body || {};
    const { lat, lng, accuracy } = readGeo(req.body);

    const doc = await Attendance.findOne({ companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk });
    if (!doc?.checkInAt) return res.status(400).json({ message: "Check-in first" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    ensureArrays(doc);

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (open) return res.status(400).json({ message: "A break is already running" });

    doc.breaks.push({ type: "break", startAt: new Date(), endAt: null, durationMin: 0, note: note || "" });
    pushPhoto(doc, "breakstart", { photoUrl, photoBase64, lat, lng, accuracy });

    await doc.save();
    res.json(doc);
  } catch (e) {
    console.error("❌ /me/break/start error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** BREAK END */
router.post("/me/break/end", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const { note, photoUrl, photoBase64 } = req.body || {};
    const { lat, lng, accuracy } = readGeo(req.body);

    const doc = await Attendance.findOne({ companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk });
    if (!doc) return res.status(400).json({ message: "No attendance today" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    ensureArrays(doc);

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (!open) return res.status(400).json({ message: "No running break" });

    open.endAt = new Date();
    open.durationMin = minsBetween(open.startAt, open.endAt);
    if (note) open.note = String(note).slice(0, 500);

    pushPhoto(doc, "breakend", { photoUrl, photoBase64, lat, lng, accuracy });

    await doc.save();
    res.json(doc);
  } catch (e) {
    console.error("❌ /me/break/end error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** CHECKOUT */
router.post("/me/checkout", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);

    const { photoUrl, photoBase64 } = req.body || {};
    const { lat, lng, accuracy } = readGeo(req.body);
    const photo = photoUrl || photoBase64 || "";

    if (policy.requireSelfieOut && !photo) return res.status(400).json({ message: "Selfie required for check-out" });
    if (policy.requireLocationOut && (lat == null || lng == null))
      return res.status(400).json({ message: "Location required for check-out" });

    const doc = await Attendance.findOne({ companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk });
    if (!doc?.checkInAt) return res.status(400).json({ message: "Check-in first" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    ensureArrays(doc);

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (open) return res.status(400).json({ message: "End break before check-out" });

    doc.checkOutAt = new Date();
    doc.status = "checked_out";

    // legacy
    doc.checkOutPhotoUrl = photoUrl ? photoUrl : "";
    doc.checkOutPhotoBase64 = photoBase64 ? photoBase64 : "";
    doc.checkOutLat = lat == null ? null : Number(lat);
    doc.checkOutLng = lng == null ? null : Number(lng);
    doc.checkOutAccuracy = accuracy == null ? null : Number(accuracy);

    pushPhoto(doc, "checkout", { photoUrl, photoBase64, lat, lng, accuracy });

    recomputeTotals(doc, policy);
    await doc.save();

    res.json(doc);
  } catch (e) {
    console.error("❌ /me/checkout error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** REPORTS (same as your file) */
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
  } catch (e) {
    console.error("❌ /me/report error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.get("/admin/list", authRequired, attachUser, authorizeRoles("admin"), async (req, res) => {
  try {
    const dk = req.query.dateKey || dateKeyIST();
    const rows = await Attendance.find({ companyId: req.dbUser.companyId, dateKey: dk })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (e) {
    console.error("❌ /admin/list error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

router.get("/admin/report", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { from, to, userId } = req.query || {};
    if (!from || !to) return res.status(400).json({ message: "from & to required (YYYY-MM-DD)" });

    const q = { companyId: req.dbUser.companyId, dateKey: { $gte: String(from), $lte: String(to) } };
    if (userId) q.userId = userId;

    const rows = await Attendance.find(q)
      .populate("userId", "name email role managerId")
      .sort({ dateKey: -1 });

    if (req.dbUser.role === "manager") {
      const filtered = rows.filter((r) => String(r.userId?.managerId || "") === String(req.dbUser._id));
      return res.json(filtered);
    }

    res.json(rows);
  } catch (e) {
    console.error("❌ /admin/report error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** PDF + delete keep same as your existing if needed */
module.exports = router;
