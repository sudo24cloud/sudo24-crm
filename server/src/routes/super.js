const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // ✅ NEW

const Company = require("../models/Company");
const User = require("../models/User");
const Lead = require("../models/Lead"); // ✅ for cascade delete

const router = express.Router();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ✅ NEW: generate permanent Company ID like C-AB12CD34EF
function genCompanyCode() {
  return "C-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

// --- Super auth middleware ---
function superAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing super token" });

    const decoded = jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET);
    if (!decoded?.super) return res.status(401).json({ message: "Invalid super token" });

    req.super = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired super token" });
  }
}

function normalizeFeatures(features) {
  const f = features || {};
  return {
    crm: f.crm !== false,
    attendance: !!f.attendance,
    reports: f.reports !== false,
    policies: !!f.policies
  };
}

function defaultUserLimitByPlan(plan) {
  if (plan === "free") return 5;
  if (plan === "basic") return 15;
  if (plan === "pro") return 50;
  return 5;
}

/**
 * POST /api/super/login
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Missing fields" });

  if (
    email.toLowerCase() !== String(process.env.SUPERADMIN_EMAIL || "").toLowerCase() ||
    password !== String(process.env.SUPERADMIN_PASSWORD || "")
  ) {
    return res.status(401).json({ message: "Invalid super admin credentials" });
  }

  const token = jwt.sign(
    { super: true, email: process.env.SUPERADMIN_EMAIL },
    process.env.SUPERADMIN_JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/**
 * ✅ GET /api/super/companies
 * ✅ ALWAYS returns: companyCode (Company ID), userLimit, usedUsers
 * ✅ Auto-fix companyCode for old companies
 */
router.get("/companies", superAuth, async (req, res) => {
  try {
    const companies = await Company.find()
      .select("name slug plan isActive userLimit features companyCode createdAt updatedAt")
      .sort({ createdAt: -1 });

    const out = [];

    for (const c of companies) {
      // ✅ Backfill missing companyCode (old records)
      if (!c.companyCode) {
        c.companyCode = genCompanyCode();
        await c.save();
      }

      const usedUsers = await User.countDocuments({ companyId: c._id });

      out.push({
        ...c.toObject(),
        companyId: String(c._id), // optional, helpful for UI
        companyCode: c.companyCode, // ✅ Company ID
        userLimit: Number(c.userLimit || defaultUserLimitByPlan(c.plan)),
        usedUsers
      });
    }

    res.json(out);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/super/companies
 * Create company + admin
 * ✅ body: { companyName, adminName, adminEmail, adminPassword, plan?, userLimit?, features? }
 */
router.post("/companies", superAuth, async (req, res) => {
  try {
    const { companyName, adminName, adminEmail, adminPassword, plan, userLimit, features } = req.body || {};
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // unique company slug
    const baseSlug = slugify(companyName);
    let slug = baseSlug;
    let i = 1;
    while (await Company.findOne({ slug })) {
      i++;
      slug = `${baseSlug}-${i}`;
    }

    const safePlan = ["free", "basic", "pro"].includes(plan) ? plan : "free";
    const planDefaultLimit = defaultUserLimitByPlan(safePlan);

    const safeLimit = Number(userLimit || planDefaultLimit);
    if (!Number.isFinite(safeLimit) || safeLimit < 1) {
      return res.status(400).json({ message: "userLimit must be >= 1" });
    }

    // ✅ Company schema should have companyCode, userLimit, features
    const company = await Company.create({
      name: companyName,
      slug,
      plan: safePlan,
      isActive: true,
      userLimit: safeLimit,
      features: normalizeFeatures(features),
      companyCode: genCompanyCode() // ✅ ensure ID at creation
    });

    // create admin user for this company
    const exists = await User.findOne({ email: adminEmail.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Admin email already exists" });

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({
      companyId: company._id,
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: "admin",
      managerId: null,
      isActive: true
    });

    res.json({
      company,
      admin: { id: admin._id, email: admin.email, name: admin.name }
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/super/companies/:id
 * ✅ body: { plan?, isActive?, userLimit?, features? }
 */
router.patch("/companies/:id", superAuth, async (req, res) => {
  try {
    const updates = {};

    if ("plan" in req.body && ["free", "basic", "pro"].includes(req.body.plan)) {
      updates.plan = req.body.plan;
    }

    if ("isActive" in req.body) updates.isActive = !!req.body.isActive;

    // ✅ userLimit increase/decrease
    if ("userLimit" in req.body) {
      const n = Number(req.body.userLimit);
      if (!Number.isFinite(n) || n < 1) return res.status(400).json({ message: "userLimit must be >= 1" });
      updates.userLimit = n;
    }

    // ✅ features enable/disable
    if ("features" in req.body && req.body.features) {
      updates.features = normalizeFeatures(req.body.features);
    }

    const company = await Company.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!company) return res.status(404).json({ message: "Company not found" });

    // ✅ ensure companyCode exists
    if (!company.companyCode) {
      company.companyCode = genCompanyCode();
      await company.save();
    }

    const usedUsers = await User.countDocuments({ companyId: company._id });

    res.json({
      ...company.toObject(),
      companyId: String(company._id),
      companyCode: company.companyCode,
      userLimit: Number(company.userLimit || defaultUserLimitByPlan(company.plan)),
      usedUsers
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/super/companies/:id
 * Permanent delete company + users + leads (cascade)
 */
router.delete("/companies/:id", superAuth, async (req, res) => {
  try {
    const companyId = req.params.id;

    const company = await Company.findById(companyId).select("_id name companyCode");
    if (!company) return res.status(404).json({ message: "Company not found" });

    const usersDeleted = await User.deleteMany({ companyId });
    const leadsDeleted = await Lead.deleteMany({ companyId });
    const companyDeleted = await Company.deleteOne({ _id: companyId });

    return res.json({
      message: "✅ Company permanently deleted",
      company: { id: companyId, name: company.name, companyCode: company.companyCode || "-" },
      deleted: {
        users: usersDeleted.deletedCount || 0,
        leads: leadsDeleted.deletedCount || 0,
        company: companyDeleted.deletedCount || 0
      }
    });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/super/companies/bulk-delete
 * body: { companyIds: ["id1","id2"] }
 * Permanent delete multiple companies (cascade)
 */
router.post("/companies/bulk-delete", superAuth, async (req, res) => {
  try {
    const { companyIds } = req.body || {};
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ message: "companyIds array required" });
    }

    const companies = await Company.find({ _id: { $in: companyIds } }).select("_id name companyCode");
    const foundIds = companies.map((c) => String(c._id));

    const usersDeleted = await User.deleteMany({ companyId: { $in: companyIds } });
    const leadsDeleted = await Lead.deleteMany({ companyId: { $in: companyIds } });
    const companiesDeleted = await Company.deleteMany({ _id: { $in: companyIds } });

    return res.json({
      message: "✅ Bulk delete complete",
      requested: companyIds.length,
      found: foundIds.length,
      deletedCompanies: companies.map(c => ({ id: c._id, name: c.name, companyCode: c.companyCode || "-" })),
      deleted: {
        users: usersDeleted.deletedCount || 0,
        leads: leadsDeleted.deletedCount || 0,
        companies: companiesDeleted.deletedCount || 0
      }
    });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
