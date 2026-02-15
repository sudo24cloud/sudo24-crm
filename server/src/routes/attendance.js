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
  // Convert to IST by shifting from UTC (not local)
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

      // ✅ Attendance rule
      fullDayNetMin: 360, // 6 hours
      maxBreakMin: 60 // 1 hour total
    }
  );
}

/** =========================
 *  Compute totals + full day
 *  ========================= */
function recomputeTotals(doc, policy) {
  // total = checkout - checkin
  const totalMin = doc.checkInAt && doc.checkOutAt ? minsBetween(doc.checkInAt, doc.checkOutAt) : 0;

  // breaks sum
  let breakMin = 0;
  for (const b of doc.breaks || []) {
    // if durationMin saved use it, else compute if ended
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
  } catch (e) {
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

    // Do not allow checkin again
    const existing = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (existing?.checkInAt) return res.status(400).json({ message: "Already checked-in today" });
    if (existing?.checkOutAt) return res.status(400).json({ message: "Already checked-out today" });

    const now = new Date();

    const doc = await Attendance.findOneAndUpdate(
      { companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk },
      {
        $setOnInsert: { companyId: req.dbUser.companyId, userId: req.dbUser._id, dateKey: dk },
        $set: {
          checkInAt: now,

          // keep backward fields (your current model)
          checkInPhotoUrl: photoUrl ? photoUrl : "",
          checkInPhotoBase64: photoBase64 ? photoBase64 : "",

          checkInLat: lat == null ? null : Number(lat),
          checkInLng: lng == null ? null : Number(lng),
          checkInAccuracy: accuracy == null ? null : Number(accuracy),

          status: "in_progress"
        }
      },
      { upsert: true, new: true }
    );

    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: start break
 *  expects { type, note, photoUrl/photoBase64?, lat?, lng? }
 *  ========================= */
router.post("/me/break/start", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
    const policy = await getPolicy(req.dbUser.companyId, req.dbUser._id);
    if (!policy.breaksEnabled) return res.status(403).json({ message: "Breaks disabled for you" });

    const { type, note } = req.body || {};
    const doc = await Attendance.findOne({
      companyId: req.dbUser.companyId,
      userId: req.dbUser._id,
      dateKey: dk
    });

    if (!doc?.checkInAt) return res.status(400).json({ message: "Check-in first" });
    if (doc.checkOutAt) return res.status(400).json({ message: "Already checked out" });

    const open = (doc.breaks || []).find((b) => !b.endAt);
    if (open) return res.status(400).json({ message: "A break is already running" });

    doc.breaks.push({
      type: type || "break",
      startAt: new Date(),
      endAt: null,
      note: note || "",
      durationMin: 0
    });

    await doc.save();
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE: end break
 *  ========================= */
router.post("/me/break/end", authRequired, attachUser, async (req, res) => {
  try {
    const dk = dateKeyIST();
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

    await doc.save();
    res.json(doc);
  } catch (e) {
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

    doc.checkOutPhotoUrl = photoUrl ? photoUrl : "";
    doc.checkOutPhotoBase64 = photoBase64 ? photoBase64 : "";

    doc.checkOutLat = lat == null ? null : Number(lat);
    doc.checkOutLng = lng == null ? null : Number(lng);
    doc.checkOutAccuracy = accuracy == null ? null : Number(accuracy);

    doc.status = "checked_out";

    recomputeTotals(doc, policy);
    await doc.save();

    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  EMPLOYEE REPORT: date range
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
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  ADMIN: daily list by dateKey
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
 *  GET /admin/report?from&to&userId(optional)
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

    // manager restriction (if manager: only own team)
    if (req.dbUser.role === "manager") {
      const filtered = rows.filter((r) => String(r.userId?.managerId || "") === String(req.dbUser._id));
      return res.json(filtered);
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/** =========================
 *  ✅ Admin PDF report download (daily)
 *  GET /admin/report.pdf?dateKey=YYYY-MM-DD
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
    doc.text("Loc", 480, doc.y, { width: 80 });
    doc.moveDown(0.3);
    line();
    doc.moveDown(0.4);

    const msToHM = (ms) => {
      const m = Math.floor(Math.max(0, ms) / 60000);
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}h ${mm}m`;
    };

    const calcTimes = (row) => {
      if (!row?.checkInAt) return { workMs: 0, breakMs: 0, netMs: 0 };
      const start = new Date(row.checkInAt).getTime();
      const end = row.checkOutAt ? new Date(row.checkOutAt).getTime() : Date.now();

      let breakMs = 0;
      for (const b of row.breaks || []) {
        const bs = new Date(b.startAt).getTime();
        const be = b.endAt ? new Date(b.endAt).getTime() : Date.now();
        breakMs += Math.max(0, be - bs);
      }

      const workMs = Math.max(0, end - start);
      const netMs = Math.max(0, workMs - breakMs);
      return { workMs, breakMs, netMs };
    };

    for (const r of rows) {
      const t = calcTimes(r);
      const employee = `${r.userId?.name || "User"} (${r.userId?.role || ""})`;
      const inTime = r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-";
      const outTime = r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-";
      const net = msToHM(t.netMs);
      const brk = msToHM(t.breakMs);

      const loc =
        r.checkInLat != null && r.checkInLng != null
          ? `IN: ${Number(r.checkInLat).toFixed(3)},${Number(r.checkInLng).toFixed(3)}`
          : "IN: -";

      if (doc.y > 760) doc.addPage();

      doc.fontSize(9).fillColor("#000");
      doc.text(employee, 30, doc.y, { width: 170 });
      doc.text(inTime, 200, doc.y, { width: 90 });
      doc.text(outTime, 290, doc.y, { width: 90 });
      doc.text(net, 380, doc.y, { width: 50 });
      doc.text(brk, 430, doc.y, { width: 50 });
      doc.text(loc, 480, doc.y, { width: 80 });

      doc.moveDown(0.6);
    }

    doc.moveDown(0.2);
    line();
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor("#666").text("Generated by SUDO24 CRM");

    doc.end();
  } catch (e) {
    return res.status(500).json({ message: "PDF report error" });
  }
});

/** =========================
 *  ✅ Delete one attendance record (Admin OR Manager for team)
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
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
