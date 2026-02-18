require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./config/db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const leadRoutes = require("./routes/leads");
const companyRoutes = require("./routes/company");
const superRoutes = require("./routes/super");
const activityRoutes = require("./routes/activity");
const attendanceRoutes = require("./routes/attendance");
const policyRoutes = require("./routes/policies");
const reportRoutes = require("./routes/reports");
const statsRoutes = require("./routes/stats");
const admissionsRoutes = require("./routes/admissions");

// ⚠️ If upload route exists
let uploadRoutes;
try {
  uploadRoutes = require("./routes/upload");
} catch (err) {
  uploadRoutes = null;
}

const app = express();

/* ================================
   CORS FIXED FOR NETLIFY + LOCAL
================================ */
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://cheery-basbousa-29c3cb.netlify.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ================================
   MIDDLEWARE
================================ */
app.use(express.json({ limit: "1mb" }));

/* ================================
   STATIC UPLOADS (if folder exists)
================================ */
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* ================================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "SUDO24 CRM SaaS API Running 🚀" });
});

/* ================================
   ROUTES
================================ */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/super", superRoutes);
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
