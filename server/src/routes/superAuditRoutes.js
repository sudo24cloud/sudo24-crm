// server/src/routes/superAuditRoutes.js
const express = require("express");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

/**
 * GET /api/super/audit
 * Query:
 * - companyId
 * - code (TENANT_SUSPENDED | MODULE_DISABLED | LIMIT_EXCEEDED | RATE_LIMIT ...)
 * - action
 * - severity (info|warn|high)
 * - q (search in message)
 * - from, to (ISO date)
 * - page, limit
 */
router.get("/audit", async (req, res) => {
  try {
    const {
      companyId,
      code,
      action,
      severity,
      q,
      from,
      to,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};
    if (companyId) where.company = companyId;
    if (code) where.code = code;
    if (action) where.action = action;
    if (severity) where.severity = severity;

    if (q) where.message = { $regex: String(q), $options: "i" };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.$gte = new Date(from);
      if (to) where.createdAt.$lte = new Date(to);
    }

    const pg = Math.max(1, Number(page) || 1);
    const lim = Math.max(1, Math.min(200, Number(limit) || 50));
    const skip = (pg - 1) * lim;

    const [items, total] = await Promise.all([
      AuditLog.find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("company", "name slug companyCode plan")
        .lean(),
      AuditLog.countDocuments(where)
    ]);

    return res.json({
      page: pg,
      limit: lim,
      total,
      items
    });
  } catch (e) {
    return res.status(500).json({ code: "AUDIT_LIST_ERROR", message: "Failed to load audit logs" });
  }
});

/**
 * GET /api/super/audit/export
 * Same filters as /audit — returns all (max 5000)
 */
router.get("/audit/export", async (req, res) => {
  try {
    const { companyId, code, action, severity, q, from, to } = req.query;

    const where = {};
    if (companyId) where.company = companyId;
    if (code) where.code = code;
    if (action) where.action = action;
    if (severity) where.severity = severity;
    if (q) where.message = { $regex: String(q), $options: "i" };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.$gte = new Date(from);
      if (to) where.createdAt.$lte = new Date(to);
    }

    const items = await AuditLog.find(where)
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate("company", "name slug companyCode plan")
      .lean();

    return res.json({ total: items.length, items });
  } catch (e) {
    return res.status(500).json({ code: "AUDIT_EXPORT_ERROR", message: "Failed to export audit logs" });
  }
});

module.exports = router;
