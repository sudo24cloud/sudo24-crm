const jwt = require("jsonwebtoken");
const User = require("../models/User");

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // id, role, companyId

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ message: "No auth user" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

async function attachUser(req, res, next) {
  try {
    const dbUser = await User.findById(req.user.id).select("-passwordHash");

    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Ensure token companyId matches DB companyId
    if (
      req.user.companyId &&
      String(req.user.companyId) !== String(dbUser.companyId)
    ) {
      return res.status(401).json({ message: "Tenant mismatch" });
    }

    req.dbUser = dbUser;

    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  authRequired,
  authorizeRoles,
  attachUser
};
