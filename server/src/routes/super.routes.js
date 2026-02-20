// server/src/routes/super.routes.js
const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");
const superAuth = require("../middlewares/superAuth");

const User = require("../models/User");
const Company = require("../models/Company");

const router = express.Router();

/**
 * ✅ Super Admin Login → returns superToken
 * ENV required:
 * SUPERADMIN_EMAIL
 * SUPERADMIN_PASSWORD   (plain OR bcrypt hash)
 * SUPERADMIN_JWT_SECRET (or fallback JWT_SECRET)
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const SUPER_EMAIL = String(process.env.SUPERADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const SUPER_PASS = String(process.env.SUPERADMIN_PASSWORD || "");
    const SUPER_SECRET =
      process.env.SUPERADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!SUPER_EMAIL || !SUPER_PASS || !SUPER_SECRET) {
      return res.status(500).json({
        message: "Super env missing (SUPERADMIN_EMAIL/PASSWORD/JWT_SECRET)",
      });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email/password required" });
    }

    const inEmail = String(email).trim().toLowerCase();

    // ✅ compare (support plain OR hashed password in env)
    let passOk = false;
    if (SUPER_PASS.startsWith("$2a$") || SUPER_PASS.startsWith("$2b$")) {
      passOk = await bcrypt.compare(String(password), SUPER_PASS);
    } else {
      passOk = String(password) === SUPER_PASS;
    }

    if (inEmail !== SUPER_EMAIL || !passOk) {
      return res.status(401).json({ message: "Invalid super credentials" });
    }

    const superToken = jwt.sign(
      { role: "superadmin", email: SUPER_EMAIL },
      SUPER_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token: superToken,
      super: { role: "superadmin", email: SUPER_EMAIL },
    });
  } catch (e) {
    return res.status(500).json({ message: "Super login failed" });
  }
});

/* =========================
   BASIC: List companies
========================= */
router.get("/companies", superAuth, async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (e) {
    res.status(500).json({ message: "Failed to load companies" });
  }
});

/* =========================
   ✅ A1) Get company admin (edit form fill)
   GET /api/super/companies/:id/admin
========================= */
router.get("/companies/:id/admin", superAuth, async (req, res) => {
  try {
    const companyId = req.params.id;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // find admin user for this company
    const admin = await User.findOne({ company: companyId, role: "admin" }).select(
      "name email role company"
    );
    if (!admin) {
      return res.status(404).json({ message: "Admin not found for this company" });
    }

    return res.json({
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
      },
      company: {
        _id: company._id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load admin details" });
  }
});

/* =========================
   ✅ A2) Update company admin (email/password/name)
   + optional company name/slug
   PATCH /api/super/companies/:id/admin
   Body: { adminName, adminEmail, adminPassword, companyName, slug }
========================= */
router.patch("/companies/:id/admin", superAuth, async (req, res) => {
  try {
    const companyId = req.params.id;
    const { adminName, adminEmail, adminPassword, companyName, slug } = req.body || {};

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const admin = await User.findOne({ company: companyId, role: "admin" });
    if (!admin) return res.status(404).json({ message: "Admin not found for this company" });

    // update company fields (optional)
    if (typeof companyName === "string" && companyName.trim()) {
      company.name = companyName.trim();
    }
    if (typeof slug === "string" && slug.trim()) {
      company.slug = slug.trim().toLowerCase();
    }

    // update admin fields (optional)
    if (typeof adminName === "string" && adminName.trim()) {
      admin.name = adminName.trim();
    }

    if (typeof adminEmail === "string" && adminEmail.trim()) {
      const nextEmail = adminEmail.trim().toLowerCase();

      // email uniqueness check
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: admin._id } });
      if (exists) return res.status(400).json({ message: "Email already in use" });

      admin.email = nextEmail;
    }

    if (typeof adminPassword === "string" && adminPassword.trim()) {
      if (adminPassword.trim().length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const hash = await bcrypt.hash(adminPassword.trim(), 10);
      admin.password = hash; // ✅ assumes User schema uses "password"
    }

    await company.save();
    await admin.save();

    return res.json({
      message: "Admin + company updated",
      admin: { _id: admin._id, name: admin.name, email: admin.email },
      company: { _id: company._id, name: company.name, slug: company.slug },
    });
  } catch (e) {
    // handle unique error (slug/email)
    if (String(e?.code) === "11000") {
      return res.status(400).json({ message: "Duplicate value (slug/email). Try another." });
    }
    return res.status(500).json({ message: "Failed to update admin/company" });
  }
});

/* =========================
   ✅ Step-7.1A: Get one company config (features/limits/policy/usage)
   GET /api/super/companies/:id/config
========================= */
router.get("/companies/:id/config", superAuth, async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Company not found" });

    return res.json({
      features: c.features || {},
      limits: c.limits || {},
      policy: c.policy || {},
      usage: c.usage || {},
    });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load config" });
  }
});

/* =========================
   ✅ Step-7.1B: Save company config (features/limits/policy)
   PATCH /api/super/companies/:id/config
   Body: { features, limits, policy }
========================= */
router.patch("/companies/:id/config", superAuth, async (req, res) => {
  try {
    const { features, limits, policy } = req.body || {};

    const c = await Company.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Company not found" });

    if (features && typeof features === "object") c.features = features;
    if (limits && typeof limits === "object") c.limits = limits;
    if (policy && typeof policy === "object") c.policy = policy;

    await c.save();

    return res.json({ ok: true, message: "Saved", companyId: c._id });
  } catch (e) {
    return res.status(500).json({ message: "Failed to save config" });
  }
});

/* =========================
   ✅ Step-7.4: Impersonate
========================= */
router.post("/companies/:id/impersonate", superAuth, async (req, res) => {
  try {
    const companyId = req.params.id;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (company.isActive === false) {
      return res
        .status(403)
        .json({ message: "Company is suspended. Cannot impersonate." });
    }

    const admin = await User.findOne({ company: company._id, role: "admin" }).select(
      "-password"
    );
    if (!admin) {
      return res
        .status(404)
        .json({ message: "Admin user not found for this company" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "JWT_SECRET missing" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role, companyId: company._id },
      secret,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: admin,
      company: {
        _id: company._id,
        name: company.name,
        slug: company.slug,
        companyCode: company.companyCode,
        plan: company.plan,
        userLimit: company.userLimit,
        isActive: company.isActive !== false,
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Impersonate failed" });
  }
});

module.exports = router;