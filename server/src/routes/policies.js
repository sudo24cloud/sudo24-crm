const express = require("express");
const mongoose = require("mongoose");

const EmployeePolicy = require("../models/EmployeePolicy");
const User = require("../models/User");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

/**
 * GET /api/policies
 * Admin: list all policies in company
 */
router.get(
  "/",
  authRequired,
  attachUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const rows = await EmployeePolicy.find({ companyId: req.dbUser.companyId })
        .populate("userId", "name email role")
        .sort({ updatedAt: -1 });
      res.json(rows);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * GET /api/policies/:userId
 * Admin: get one user's policy
 * ✅ FIX: validates userId
 */
router.get(
  "/:userId",
  authRequired,
  attachUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId || userId === "undefined" || !isValidObjectId(userId)) {
        return res.status(400).json({ message: "Valid userId required" });
      }

      const userRow = await User.findOne({
        _id: userId,
        companyId: req.dbUser.companyId
      }).select("_id");

      if (!userRow) return res.status(404).json({ message: "User not found" });

      const policy = await EmployeePolicy.findOne({
        companyId: req.dbUser.companyId,
        userId: userId
      });

      // if not set, return default empty policy
      res.json(policy || { companyId: req.dbUser.companyId, userId, trackingEnabled: false, maxDailyHours: 6 });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * POST /api/policies/:userId
 * Admin: create/update policy for user
 * body: { trackingEnabled, maxDailyHours }
 * ✅ FIX: validates userId
 */
router.post(
  "/:userId",
  authRequired,
  attachUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId || userId === "undefined" || !isValidObjectId(userId)) {
        return res.status(400).json({ message: "Valid userId required" });
      }

      const userRow = await User.findOne({
        _id: userId,
        companyId: req.dbUser.companyId
      }).select("_id");

      if (!userRow) return res.status(404).json({ message: "User not found" });

      const updates = {};
      if ("trackingEnabled" in req.body) updates.trackingEnabled = !!req.body.trackingEnabled;
      if ("maxDailyHours" in req.body) updates.maxDailyHours = Number(req.body.maxDailyHours || 6);

      const policy = await EmployeePolicy.findOneAndUpdate(
        { companyId: req.dbUser.companyId, userId },
        { $set: updates, $setOnInsert: { companyId: req.dbUser.companyId, userId } },
        { new: true, upsert: true }
      );

      res.json(policy);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
