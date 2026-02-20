const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const Company = require("../models/Company"); // ✅ NEW (limit enforcement)
const Attendance = require("../models/Attendance");

const { authRequired, attachUser, authorizeRoles } = require("../middlewares/auth");

const router = express.Router();

/**
 * Helper: Check company status + enforce user limit
 */
async function enforceCompanyUserLimit(companyId) {
  const company = await Company.findById(companyId).select("userLimit isActive");
  if (!company) return { ok: false, status: 403, message: "Company not found" };
  if (company.isActive === false) return { ok: false, status: 403, message: "Company inactive" };

  const used = await User.countDocuments({ companyId });
  if (used >= Number(company.userLimit || 0)) {
    return {
      ok: false,
      status: 403,
      message: `User limit reached (${company.userLimit}). Ask super admin to upgrade.`
    };
  }

  return { ok: true, company, used };
}

/**
 * GET /api/users
 * Admin: company all users
 * Manager: own + team employees
 * Employee: only self
 */
router.get("/", authRequired, attachUser, async (req, res) => {
  const base = { companyId: req.dbUser.companyId };

  if (req.dbUser.role === "admin") {
    const users = await User.find(base).select("-passwordHash").sort({ createdAt: -1 });
    return res.json(users);
  }

  if (req.dbUser.role === "manager") {
    const users = await User.find({
      ...base,
      $or: [{ _id: req.dbUser._id }, { managerId: req.dbUser._id }]
    }).select("-passwordHash");
    return res.json(users);
  }

  // employee: only self
  const me = await User.findOne({ ...base, _id: req.dbUser._id }).select("-passwordHash");
  return res.json(me ? [me] : []);
});

/**
 * ✅ POST /api/users
 * Admin creates manager/employee/admin (same company)
 * Enforces company userLimit
 */
router.post(
  "/",
  authRequired,
  attachUser,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, email, password, role, managerId, isActive } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "name, email, password required" });
      }

      // ✅ Enforce user limit BEFORE creating
      const check = await enforceCompanyUserLimit(req.dbUser.companyId);
      if (!check.ok) return res.status(check.status).json({ message: check.message });

      const cleanEmail = String(email).toLowerCase().trim();

      // prevent duplicate email globally
      const exists = await User.findOne({ email: cleanEmail });
      if (exists) return res.status(400).json({ message: "Email already exists" });

      // role validation
      const safeRole = ["employee", "manager", "admin"].includes(role) ? role : "employee";

      // managerId validation (only for employee)
      let safeManagerId = null;
      if (safeRole === "employee" && managerId) {
        const mgr = await User.findOne({
          _id: managerId,
          companyId: req.dbUser.companyId,
          role: "manager"
        }).select("_id");
        if (!mgr) return res.status(400).json({ message: "Invalid managerId" });
        safeManagerId = mgr._id;
      }

      const passwordHash = await bcrypt.hash(String(password), 10);

      const created = await User.create({
        companyId: req.dbUser.companyId,
        name: String(name),
        email: cleanEmail,
        passwordHash,
        role: safeRole,
        managerId: safeManagerId,
        isActive: isActive === false ? false : true
      });

      const safe = created.toObject();
      delete safe.passwordHash;

      return res.json(safe);
    } catch (e) {
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * PATCH /api/users/:id
 * Admin: can update anyone in company
 * Manager: can update only own team employees (limited fields)
 */
router.patch("/:id", authRequired, attachUser, async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
  if (!target) return res.status(404).json({ message: "User not found" });

  const isAdmin = req.dbUser.role === "admin";
  const isManager = req.dbUser.role === "manager";

  // manager rule: only team employees
  if (isManager) {
    const ok = String(target.managerId) === String(req.dbUser._id) && target.role === "employee";
    if (!ok) return res.status(403).json({ message: "Forbidden" });
  }

  // employee cannot update others
  if (!isAdmin && !isManager) return res.status(403).json({ message: "Forbidden" });

  // Allowed fields
  const adminFields = ["name", "email", "role", "managerId", "isActive"];
  const managerFields = ["name", "isActive"]; // keep safe

  const allow = isAdmin ? adminFields : managerFields;

  for (const k of allow) {
    if (k in req.body) {
      if (k === "email") target.email = String(req.body.email).toLowerCase();
      else target[k] = req.body[k];
    }
  }

  // optional: reset password (admin only)
  if (isAdmin && req.body.newPassword) {
    target.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
  }

  await target.save();
  const safe = target.toObject();
  delete safe.passwordHash;
  res.json(safe);
});

/**
 * DELETE /api/users/:id
 * Admin only. Also deletes this user's attendance (optional cleanup).
 */
router.delete("/:id", authRequired, attachUser, authorizeRoles("admin"), async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, companyId: req.dbUser.companyId });
  if (!target) return res.status(404).json({ message: "User not found" });

  // Prevent deleting last admin (recommended)
  if (target.role === "admin") {
    const adminCount = await User.countDocuments({ companyId: req.dbUser.companyId, role: "admin" });
    if (adminCount <= 1) return res.status(400).json({ message: "Cannot delete last admin" });
  }

  const att = await Attendance.deleteMany({ companyId: req.dbUser.companyId, userId: target._id });
  await User.deleteOne({ _id: target._id });

  res.json({ ok: true, deletedUserId: String(target._id), deletedAttendance: att.deletedCount || 0 });
});

module.exports = router;
