const express = require("express");
const Activity = require("../models/Activity");
const { authRequired, attachUser } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/activity
 * Company activity feed (admin/manager), employee sees own actions too (simple)
 */
router.get("/", authRequired, attachUser, async (req, res) => {
  const filter = { companyId: req.dbUser.companyId };

  // employee: show only own activities (simple)
  if (req.dbUser.role === "employee") filter.actorId = req.dbUser._id;

  const items = await Activity.find(filter)
    .populate("actorId", "name role")
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(items);
});

module.exports = router;
