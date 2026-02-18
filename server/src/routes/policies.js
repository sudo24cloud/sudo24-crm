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
        userId
      });

      // default policy if not set
      const defaultPolicy = {
        companyId: req.dbUser.companyId,
        userId,

        requireSelfieIn: true,
        requireSelfieOut: true,
        requireLocationIn: true,
        requireLocationOut: true,
        breaksEnabled: true,

        geoFenceEnabled: false,
        geoCenterLat: 0,
        geoCenterLng: 0,
        geoRadiusMeters: 150
      };

      res.json(policy || defaultPolicy);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * Helper: build updates from body (supports all fields used in frontend)
 */
function buildPolicyUpdates(body) {
  const updates = {};

  // booleans
  const boolKeys = [
    "requireSelfieIn",
    "requireSelfieOut",
    "requireLocationIn",
    "requireLocationOut",
    "breaksEnabled",
    "geoFenceEnabled"
  ];
  for (const k of boolKeys) {
    if (k in body) updates[k] = !!body[k];
  }

  // numbers
  const numKeys = ["geoCenterLat", "geoCenterLng", "geoRadiusMeters"];
  for (const k of numKeys) {
    if (k in body) updates[k] = Number(body[k] || 0);
  }

  // safety defaults
  if ("geoRadiusMeters" in updates && !Number.isFinite(updates.geoRadiusMeters)) {
    updates.geoRadiusMeters = 150;
  }

  return updates;
}

/**
 * POST /api/policies/:userId
 * Admin: create/update policy for user
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

      const updates = buildPolicyUpdates(req.body || {});

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

/**
 * PUT /api/policies/:userId
 * ✅ Added so frontend PUT also works (optional)
 */
router.put(
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

      const updates = buildPolicyUpdates(req.body || {});

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
