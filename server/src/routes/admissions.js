const express = require("express");
const mongoose = require("mongoose");
const Admission = require("../models/Admission");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");
const { logActivity } = require("../utils/logActivity");

const router = express.Router();

function ymKeyIST() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}${mm}`; // 202602
}

// simple counter using admissions count in same month (enough for MVP)
async function generateAdmissionCode(companyId) {
  const prefix = `S24-${ymKeyIST()}-`;
  const count = await Admission.countDocuments({
    companyId,
    admissionCode: { $regex: `^${prefix}` }
  });
  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}${seq}`;
}

// ✅ POST /api/admissions/from-lead/:leadId
router.post("/from-lead/:leadId", authRequired, attachUser, async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ message: "Invalid leadId" });
    }

    const lead = await Lead.findOne({ _id: leadId, companyId: req.dbUser.companyId })
      .populate("assignedTo", "name role");

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // employee restriction: only own lead
    if (req.dbUser.role === "employee") {
      if (String(lead.assignedTo) !== String(req.dbUser._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    // prevent duplicate admission
    const already = await Admission.findOne({ companyId: req.dbUser.companyId, leadId: lead._id }).select("_id admissionCode");
    if (already) {
      return res.status(400).json({ message: `Already admitted (${already.admissionCode})` });
    }

    const {
      courseName,
      batchName,
      feeTotal,
      feePaid,
      paymentMode,
      notes
    } = req.body || {};

    if (!courseName) return res.status(400).json({ message: "courseName required" });

    const admissionCode = await generateAdmissionCode(req.dbUser.companyId);

    const total = Number(feeTotal || 0);
    const paidNow = Number(feePaid || 0);
    const safeMode = String(paymentMode || "cash");

    let paymentStatus = "pending";
    if (paidNow > 0 && paidNow < total) paymentStatus = "partial";
    if (total > 0 && paidNow >= total) paymentStatus = "paid";

    const admission = await Admission.create({
      companyId: req.dbUser.companyId,
      leadId: lead._id,
      admissionCode,
      studentName: lead.name,
      phone: lead.phone || "",
      email: lead.email || "",
      courseName: String(courseName),
      batchName: String(batchName || ""),
      feeTotal: total,
      feePaid: paidNow,
      paymentStatus,
      payments: paidNow > 0 ? [{
        amount: paidNow,
        mode: safeMode,
        status: "paid",
        txnRef: "",
        paidAt: new Date()
      }] : [],
      notes: String(notes || ""),
      admittedBy: req.dbUser._id
    });

    // mark lead
    lead.status = "won"; // ensure
    lead.admissionId = admission._id;
    lead.admissionCode = admission.admissionCode;
    await lead.save();

    await logActivity({
      companyId: req.dbUser.companyId,
      actorId: req.dbUser._id,
      entityType: "admission",
      entityId: admission._id,
      action: "admission_created",
      meta: { admissionCode: admission.admissionCode, leadName: lead.name, courseName }
    });

    res.json({ ok: true, admission });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/admissions/my (employee)
router.get("/my", authRequired, attachUser, async (req, res) => {
  try {
    const q = { companyId: req.dbUser.companyId };

    if (req.dbUser.role === "employee") {
      // show admissions admittedBy = employee OR lead assigned to employee (simple: admittedBy)
      q.admittedBy = req.dbUser._id;
    }

    const rows = await Admission.find(q)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/admissions (admin/manager)
router.get("/", authRequired, attachUser, authorizeRoles("admin", "manager"), async (req, res) => {
  try {
    const { from, to, status, course } = req.query || {};
    const q = { companyId: req.dbUser.companyId };

    if (status) q.paymentStatus = String(status);
    if (course) q.courseName = String(course);

    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(String(from));
      if (to) q.createdAt.$lte = new Date(String(to));
    }

    const rows = await Admission.find(q)
      .sort({ createdAt: -1 })
      .limit(2000);

    res.json(rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
