const jwt = require("jsonwebtoken");

module.exports = function superAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) return res.status(401).json({ message: "Missing super token" });

    const secret = process.env.SUPERADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Missing SUPERADMIN_JWT_SECRET/JWT_SECRET" });

    const payload = jwt.verify(token, secret);

    // ✅ Must be superadmin
    if (!payload || payload.role !== "superadmin") {
      return res.status(403).json({ message: "SuperAdmin only" });
    }

    req.super = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/expired super token" });
  }
};
