// server/src/middleware/tenantGuard.js
const Company = require("../models/Company");
const AuditLog = require("../models/AuditLog");
const { sameDay, sameMonth } = require("../utils/date");

function pctOf(used, limit) {
  const u = Number(used || 0);
  const l = Number(limit || 0);
  if (!l) return 0;
  return Math.round((u / l) * 100);
}

function hardBlock(pct, gracePercent) {
  const g = Number(gracePercent || 0);
  return pct >= 100 + g;
}

function routeModuleMap(pathname = "") {
  // simple route → module mapping (extend as you add features)
  const p = pathname.toLowerCase();

  if (p.startsWith("/api/leads") || p.startsWith("/api/pipeline") || p.startsWith("/api/activity")) return "crm";
  if (p.startsWith("/api/attendance") || p.startsWith("/api/leave") || p.startsWith("/api/shifts")) return "attendance";
  if (p.startsWith("/api/reports") || p.startsWith("/api/analytics") || p.startsWith("/api/exports")) return "reports";
  if (p.startsWith("/api/policies") || p.startsWith("/api/docs")) return "policies";
  if (p.startsWith("/api/automation") || p.startsWith("/api/workflows") || p.startsWith("/api/sequences")) return "automation";
  if (p.startsWith("/api/integrations") || p.startsWith("/api/webhooks") || p.startsWith("/api/email")) return "integrations";
  if (p.startsWith("/api/dialer") || p.startsWith("/api/calls") || p.startsWith("/api/recordings")) return "callcenter";
  if (p.startsWith("/api/tickets") || p.startsWith("/api/sla") || p.startsWith("/api/support")) return "supportdesk";

  return null; // unknown route = no module enforcement
}

async function writeAudit({ companyId, user, action, code, message, meta, severity }) {
  try {
    await AuditLog.create({
      company: companyId,
      actorUser: user?._id,
      actorRole: user?.role || "unknown",
      action,
      code,
      message,
      meta,
      severity
    });
  } catch (e) {
    // never break request flow due to audit insert
  }
}

/**
 * ✅ tenantGuard
 * - requires req.user from auth middleware
 * - skips superadmin routes (/api/super/*)
 */
function tenantGuard(options = {}) {
  const {
    skipPaths = ["/api/super", "/api/auth", "/health", "/api/public"],
    countApiCalls = true
  } = options;

  return async function (req, res, next) {
    try {
      const path = req.path || "";
      const lower = path.toLowerCase();

      // skip paths
      if (skipPaths.some((x) => lower.startsWith(String(x).toLowerCase()))) return next();

      // super role bypass (optional)
      if (req.user?.role === "superadmin") return next();

      const companyId = req.user?.companyId || req.user?.company || null;
      if (!companyId) {
        return res.status(401).json({ code: "NO_COMPANY", message: "Company not attached to user token" });
      }

      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(401).json({ code: "COMPANY_NOT_FOUND", message: "Company not found" });
      }

      // reset usage daily/monthly in-request (simple + safe)
      const now = new Date();
      company.usage = company.usage || {};
      const lastDaily = company.usage.lastDailyResetAt ? new Date(company.usage.lastDailyResetAt) : null;
      if (!lastDaily || !sameDay(lastDaily, now)) {
        company.usage.emailsToday = 0;
        company.usage.apiCallsToday = 0;
        company.usage.lastDailyResetAt = now;
      }
      const lastMonthly = company.usage.lastMonthlyResetAt ? new Date(company.usage.lastMonthlyResetAt) : null;
      if (!lastMonthly || !sameMonth(lastMonthly, now)) {
        company.usage.leadsThisMonth = 0;
        company.usage.aiCreditsThisMonth = 0;
        company.usage.whatsappMsgsThisMonth = 0;
        company.usage.lastMonthlyResetAt = now;
      }

      // Policy defaults
      const policy = company.policyRules || {};
      const grace = Number(policy.gracePercent || 0);

      // 1) Suspended check
      const active = company.isActive !== false;
      if (policy.blockIfSuspended && !active) {
        await writeAudit({
          companyId,
          user: req.user,
          action: "TENANT_BLOCK",
          code: "TENANT_SUSPENDED",
          message: "Company is suspended",
          meta: { path, method: req.method, ip: req.ip },
          severity: "high"
        });
        return res.status(403).json({ code: "TENANT_SUSPENDED", message: "Company is suspended. Contact admin." });
      }

      // 2) Module check (route → module)
      const mod = routeModuleMap(lower);
      if (mod) {
        const modules = company.modules || company.features || {}; // backward compat (features older)
        const enabled = !!modules[mod];

        if (!enabled) {
          await writeAudit({
            companyId,
            user: req.user,
            action: "TENANT_BLOCK",
            code: "MODULE_DISABLED",
            message: `Module disabled: ${mod}`,
            meta: { path, method: req.method, ip: req.ip, module: mod },
            severity: "warn"
          });
          return res.status(403).json({ code: "MODULE_DISABLED", message: `This module is disabled: ${mod}` });
        }
      }

      // 3) Limits check
      const limits = company.limits || {};
      const usedUsers = Number(company.usedUsers || company.usage?.usersUsed || 0);
      const usersMax = Number(limits.usersMax || company.userLimit || 0);

      if (policy.enforceUserLimit && usersMax > 0) {
        const usersPct = pctOf(usedUsers, usersMax);
        if (hardBlock(usersPct, grace)) {
          await writeAudit({
            companyId,
            user: req.user,
            action: "TENANT_BLOCK",
            code: "LIMIT_EXCEEDED",
            message: "User limit exceeded",
            meta: { path, method: req.method, ip: req.ip, limit: "usersMax", usedUsers, usersMax, usersPct, grace },
            severity: "high"
          });
          return res.status(403).json({
            code: "LIMIT_EXCEEDED",
            message: "User limit exceeded",
            limit: { key: "usersMax", used: usedUsers, max: usersMax, pct: usersPct, grace }
          });
        }
      }

      if (policy.enforceDailyEmail && Number(limits.emailsPerDay || 0) > 0) {
        const emailUsed = Number(company.usage?.emailsToday || 0);
        const emailMax = Number(limits.emailsPerDay || 0);
        const emailPct = pctOf(emailUsed, emailMax);
        if (hardBlock(emailPct, grace)) {
          await writeAudit({
            companyId,
            user: req.user,
            action: "TENANT_BLOCK",
            code: "LIMIT_EXCEEDED",
            message: "Daily email limit exceeded",
            meta: { path, method: req.method, ip: req.ip, limit: "emailsPerDay", emailUsed, emailMax, emailPct, grace },
            severity: "high"
          });
          return res.status(403).json({
            code: "LIMIT_EXCEEDED",
            message: "Daily email limit exceeded",
            limit: { key: "emailsPerDay", used: emailUsed, max: emailMax, pct: emailPct, grace }
          });
        }
      }

      if (policy.enforceApiCallsDaily && countApiCalls && Number(limits.apiCallsPerDay || 0) > 0) {
        const apiUsed = Number(company.usage?.apiCallsToday || 0);
        const apiMax = Number(limits.apiCallsPerDay || 0);
        const apiPct = pctOf(apiUsed, apiMax);
        if (hardBlock(apiPct, grace)) {
          await writeAudit({
            companyId,
            user: req.user,
            action: "TENANT_BLOCK",
            code: "RATE_LIMIT",
            message: "API calls/day exceeded",
            meta: { path, method: req.method, ip: req.ip, limit: "apiCallsPerDay", apiUsed, apiMax, apiPct, grace },
            severity: "high"
          });
          return res.status(429).json({
            code: "RATE_LIMIT",
            message: "API calls/day exceeded",
            limit: { key: "apiCallsPerDay", used: apiUsed, max: apiMax, pct: apiPct, grace }
          });
        }
      }

      // count API call after passing checks (for non-GET also)
      if (countApiCalls) {
        company.usage.apiCallsToday = Number(company.usage.apiCallsToday || 0) + 1;
      }

      // persist reset + api call counter (light write)
      await company.save().catch(() => {});

      // attach company for later handlers
      req.company = company;

      return next();
    } catch (e) {
      return res.status(500).json({ code: "TENANT_GUARD_ERROR", message: "Tenant guard error" });
    }
  };
}

module.exports = tenantGuard;
