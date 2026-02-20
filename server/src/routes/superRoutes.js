// server/src/routes/superRoutes.js
// ✅ Super Admin main router
// - Protected by requireAuth + requireSuperAdmin
// - Includes: Impersonate endpoint (Step-7.4)
// - Includes: superFeatureRoutes + superAuditRoutes (mounted)

const express = require("express");
const jwt = require("jsonwebtoken");

// ✅ your app middlewares (as per your codebase)
const requireAuth = require("../middlewares/requireAuth");
const requireSuperAdmin = require("../middlewares/requireSuperAdmin");

// Models
const User = require("../models/User");
const Company = require("../models/Company");

// Subroutes
const superFeatureRoutes = require("./superFeatureRoutes");
const superAuditRoutes = require("./superAuditRoutes");

const router = express.Router();

/* =========================
   ✅ Protect ALL super routes
========================= */
router.use(requireAuth, requireSuperAdmin);

/* =========================================================
   ✅ Step-7.4: Impersonate company admin (SuperAdmin → Admin)
   POST /api/super/companies/:id/impersonate
   Returns: { token, user, company }
========================================================= */
router.post("/companies/:id/impersonate", async (req, res) => {
  try {
    const companyId = req.params.id;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (company.isActive === false) {
      return res.status(403).json({ message: "Company is suspended. Cannot impersonate." });
    }

    // ✅ find admin of that company
    // NOTE: adjust keys if your schema differs
    // Common: { company: ObjectId, role: "admin" }
    const admin = await User.findOne({ company: company._id, role: "admin" }).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin user not found for this company" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "JWT_SECRET missing" });

    // ✅ normal app token (admin + company context)
    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
        companyId: company._id
      },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: admin,
      company: {
        _id: company._id,
        name: company.name,
        slug: company.slug,
        companyCode: company.companyCode,
        plan: company.plan,
        userLimit: company.userLimit,
        isActive: company.isActive !== false
      }
    });
  } catch (e) {
    console.error("Impersonate error:", e);
    return res.status(500).json({ message: "Impersonate failed" });
  }
});

/* =========================
   ✅ Mount new subroutes
   (these files should export a router)
   They will run under:
   /api/super/* (because server.js mounts /api/super -> superRoutes)
========================= */
router.use(superFeatureRoutes);
router.use(superAuditRoutes);

module.exports = router;
