const express = require("express");
const Company = require("../models/Company");
const { authRequired, attachUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/**
 * Get my company settings
 * GET /api/company/me
 */
router.get("/me", authRequired, attachUser, async (req, res) => {
  const company = await Company.findById(req.dbUser.companyId);
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

/**
 * Update company settings (Admin only)
 * PATCH /api/company/me
 */
router.patch("/me", authRequired, attachUser, authorizeRoles("admin"), async (req, res) => {
  const allowed = ["name", "brandColor", "logoUrl"];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

  const company = await Company.findByIdAndUpdate(req.dbUser.companyId, updates, { new: true });
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

module.exports = router;
