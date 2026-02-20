const express = require("express");
const Lead = require("../models/Lead");
const { authRequired, attachUser } = require("../middlewares/auth");

const router = express.Router();

function dateKeyNowIST() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// GET /api/stats/today
router.get("/today", authRequired, attachUser, async (req, res) => {
  try {
    const companyId = req.dbUser.companyId;
    const myId = req.dbUser._id;

    const dk = dateKeyNowIST();
    const start = new Date(`${dk}T00:00:00.000`);
    const end = new Date(`${dk}T23:59:59.999`);

    // ✅ role-based filter (employee only assigned leads)
    const base = { companyId };
    const filter = req.dbUser.role === "employee"
      ? { ...base, assignedTo: myId }
      : base;

    // Today new leads (created today)
    const todayNewLeads = await Lead.countDocuments({
      ...filter,
      createdAt: { $gte: start, $lte: end }
    });

    // Today followups (nextFollowUp date today)
    const todayFollowups = await Lead.countDocuments({
      ...filter,
      nextFollowUp: { $gte: start, $lte: end }
    });

    // Pending followups (overdue)
    const pendingFollowups = await Lead.countDocuments({
      ...filter,
      nextFollowUp: { $lt: start }
    });

    res.json({
      dateKey: dk,
      todayNewLeads,
      todayFollowups,
      pendingFollowups
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
