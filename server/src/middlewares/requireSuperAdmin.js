// server/src/middleware/requireSuperAdmin.js
module.exports = function requireSuperAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== "superadmin") {
    return res.status(403).json({ code: "FORBIDDEN", message: "Superadmin only" });
  }
  next();
};
