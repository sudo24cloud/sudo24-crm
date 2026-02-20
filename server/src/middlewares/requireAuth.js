// server/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ message: "No token", code: "NO_TOKEN" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid token user", code: "INVALID_USER" });

    req.user = {
      _id: user._id,
      role: user.role,
      companyId: user.company
    };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token", code: "INVALID_TOKEN" });
  }
};
