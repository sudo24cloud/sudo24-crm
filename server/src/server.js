// server/src/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./config/db");

// ✅ auth + tenant guard
const requireAuth = require("./middlewares/requireAuth");
const tenantGuard = require("./middlewares/tenantGuard");

// Routes
const authRoutes = require("./routes/auth");

// Tenant routes
const userRoutes = require("./routes/users");
const leadRoutes = require("./routes/leads");
const companyRoutes = require("./routes/company");
const activityRoutes = require("./routes/activity");
const attendanceRoutes = require("./routes/attendance");
const policyRoutes = require("./routes/policies");
const reportRoutes = require("./routes/reports");
const statsRoutes = require("./routes/stats");
const admissionsRoutes = require("./routes/admissions");

// Optional upload route
let uploadRoutes;
try {
  uploadRoutes = require("./routes/upload");
} catch (err) {
  uploadRoutes = null;
}

const app = express();

/* ================================
   CORS
================================ */
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://cheery-basbousa-29c3cb.netlify.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ================================
   MIDDLEWARE
================================ */
app.use(express.json({ limit: "1mb" }));

/* ================================
   STATIC FILES
================================ */
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* ================================
   HEALTH ROUTES
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "SUDO24 CRM SaaS API Running 🚀" });
});

app.get("/health", (req, res) => res.json({ ok: true }));

/* ===================================================
   ✅ ROUTE ORDER (VERY IMPORTANT)

   1) /api/auth  → Public
   2) /api/super → NO tenantGuard
   3) /api/*     → requireAuth + tenantGuard
=================================================== */

// 1️⃣ AUTH (PUBLIC)
app.use("/api/auth", authRoutes);

// 2️⃣ SUPER (NO TENANT GUARD HERE) ✅ EXACT MOUNT YOU ASKED
// File must exist: server/src/routes/super.routes.js
// And inside super.routes.js you should enforce:
// requireAuth + requireSuperAdmin (internally)
app.use("/api/super", require("./routes/super.routes"));

// 3️⃣ EVERYTHING ELSE PROTECTED (global guard for /api/*)
app.use(
  "/api",
  requireAuth,
  tenantGuard({
    skipPaths: ["/api/auth", "/api/super", "/", "/health", "/uploads"],
  })
);

/* ================================
   TENANT ROUTES (AFTER GUARD)
================================ */
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/admissions", admissionsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/stats", statsRoutes);

if (uploadRoutes) {
  app.use("/api/upload", uploadRoutes);
}

/* ================================
   404 + ERROR HANDLER
================================ */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ message: err.message || "Server error" });
});

/* ================================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);

    app.listen(PORT, () => {
      console.log(`✅ API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server", err);
    process.exit(1);
  }
})();
