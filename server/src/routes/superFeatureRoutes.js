// server/src/routes/superFeatureRoutes.js
const express = require("express");
const Company = require("../models/Company");
const AuditLog = require("../models/AuditLog");
const { sanitizeModules, sanitizeLimits, sanitizePolicy, isPlainObject } = require("../utils/validate");

const router = express.Router();

/** Allowed keys (same as frontend Step-6) */
const MODULE_KEYS = ["crm", "attendance", "reports", "policies", "automation", "integrations", "callcenter", "supportdesk"];
const LIMIT_KEYS = ["usersMax", "leadsPerMonth", "emailsPerDay", "storageGB", "aiCreditsPerMonth", "whatsappMsgsPerMonth", "apiCallsPerDay"];

async function audit(companyId, req, action, code, message, meta = {}, severity = "info") {
  try {
    await AuditLog.create({
      company: companyId,
      actorUser: req.user?._id,
      actorRole: req.user?.role || "unknown",
      action,
      code,
      message,
      meta: { ...meta, path: req.path, method: req.method, ip: req.ip },
      severity
    });
  } catch (_) {}
}

/**
 * GET /api/super/companies/:id/features
 * Returns company modules/limits/policy + usage snapshot
 */
router.get("/companies/:id/features", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ code: "NOT_FOUND", message: "Company not found" });

    return res.json({
      companyId: company._id,
      modules: company.modules || company.features || {},
      limits: company.limits || {},
      policyRules: company.policyRules || {},
      usage: company.usage || {},
      plan: company.plan,
      isActive: company.isActive !== false,
      userLimit: company.userLimit,
      usedUsers: company.usedUsers
    });
  } catch (e) {
    return res.status(500).json({ code: "FEATURES_GET_ERROR", message: "Failed to load features" });
  }
});

/**
 * PATCH /api/super/companies/:id/features
 * Body can contain: { modules, limits, policyRules }
 * ✅ DB persist + audit
 */
router.patch("/companies/:id/features", async (req, res) => {
  try {
    const { modules, limits, policyRules } = req.body || {};

    const m = sanitizeModules(modules, MODULE_KEYS);
    const l = sanitizeLimits(limits, LIMIT_KEYS);
    const p = sanitizePolicy(policyRules);

    if (!m && !l && !p) {
      return res.status(400).json({
        code: "INVALID_BODY",
        message: "Provide at least one of: modules, limits, policyRules"
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ code: "NOT_FOUND", message: "Company not found" });

    // merge into existing (partial patch)
    if (m) company.modules = { ...(company.modules || {}), ...m };
    if (l) company.limits = { ...(company.limits || {}), ...l };
    if (p) company.policyRules = { ...(company.policyRules || {}), ...p };

    // optional: keep backward compat with old "features" flags
    // If user sets modules.crm etc, reflect into features too (only for 4 base flags)
    company.features = company.features || {};
    if (m && Object.prototype.hasOwnProperty.call(m, "crm")) company.features.crm = !!m.crm;
    if (m && Object.prototype.hasOwnProperty.call(m, "attendance")) company.features.attendance = !!m.attendance;
    if (m && Object.prototype.hasOwnProperty.call(m, "reports")) company.features.reports = !!m.reports;
    if (m && Object.prototype.hasOwnProperty.call(m, "policies")) company.features.policies = !!m.policies;

    await company.save();

    await audit(company._id, req, "SUPER_FEATURES_UPDATE", "OK", "Updated company modules/limits/policyRules", {
      changed: {
        modules: !!m,
        limits: !!l,
        policyRules: !!p
      }
    });

    return res.json({
      message: "✅ Features updated",
      companyId: company._id,
      modules: company.modules || {},
      limits: company.limits || {},
      policyRules: company.policyRules || {}
    });
  } catch (e) {
    return res.status(500).json({ code: "FEATURES_PATCH_ERROR", message: "Failed to update features" });
  }
});

/**
 * POST /api/super/companies/:id/usage/reset
 * Body: { scope: "daily" | "monthly" | "all" }
 */
router.post("/companies/:id/usage/reset", async (req, res) => {
  try {
    const scope = String(req.body?.scope || "daily").toLowerCase();
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ code: "NOT_FOUND", message: "Company not found" });

    company.usage = company.usage || {};
    const now = new Date();

    if (scope === "daily" || scope === "all") {
      company.usage.emailsToday = 0;
      company.usage.apiCallsToday = 0;
      company.usage.lastDailyResetAt = now;
    }
    if (scope === "monthly" || scope === "all") {
      company.usage.leadsThisMonth = 0;
      company.usage.aiCreditsThisMonth = 0;
      company.usage.whatsappMsgsThisMonth = 0;
      company.usage.lastMonthlyResetAt = now;
    }

    await company.save();

    await audit(company._id, req, "SUPER_USAGE_RESET", "OK", `Reset usage: ${scope}`, { scope }, "warn");

    return res.json({ message: "✅ Usage reset", scope, usage: company.usage });
  } catch (e) {
    return res.status(500).json({ code: "USAGE_RESET_ERROR", message: "Failed to reset usage" });
  }
});

/**
 * PATCH /api/super/policies/default
 * Global default policy store (optional)
 * ✅ For now: store in process env / DB collection later
 * We keep placeholder so your frontend has endpoint.
 */
router.patch("/policies/default", async (req, res) => {
  // If you want: create DefaultPolicy model later.
  // For now we just validate and return.
  const p = sanitizePolicy(req.body || {});
  if (!p || !isPlainObject(p)) {
    return res.status(400).json({ code: "INVALID_POLICY", message: "Invalid policy payload" });
  }
  return res.json({ message: "✅ Default policy validated (TODO DB persist)", policyRules: p });
});

module.exports = router;
