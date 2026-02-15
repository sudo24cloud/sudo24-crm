const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Company = require("../models/Company");

const router = express.Router();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Bootstrap → Create Company + Admin (only if no users exist)
 */
router.post("/bootstrap", async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ message: "Already bootstrapped" });

    const { companyName, name, email, password } = req.body || {};
    if (!companyName || !name || !email || !password) return res.status(400).json({ message: "Missing fields" });

    const baseSlug = slugify(companyName);
    let slug = baseSlug;
    let i = 1;
    while (await Company.findOne({ slug })) {
      i++;
      slug = `${baseSlug}-${i}`;
    }

    const company = await Company.create({ name: companyName, slug, plan: "free", isActive: true });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({
      companyId: company._id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin"
    });

    return res.json({ message: "Company + Admin created", adminEmail: admin.email });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * Login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ NEW: Company active check
    const company = await Company.findById(user.companyId).select("isActive name plan slug");
    if (!company) return res.status(401).json({ message: "Company not found" });
    if (!company.isActive) return res.status(403).json({ message: "Company is disabled. Contact support." });

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, companyId: user.companyId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        companyId: user.companyId,
        name: user.name,
        email: user.email,
        role: user.role,
        managerId: user.managerId
      }
    });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
