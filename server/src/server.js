require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const leadRoutes = require("./routes/leads");
const companyRoutes = require("./routes/company");
const superRoutes = require("./routes/super");
const activityRoutes = require("./routes/activity");

// ✅ Attendance + Policies
const attendanceRoutes = require("./routes/attendance");
const policyRoutes = require("./routes/policies");

// ✅ Reports
const reportRoutes = require("./routes/reports");

// ✅ Dashboard Stats
const statsRoutes = require("./routes/stats");

// ✅ Admissions
const admissionsRoutes = require("./routes/admissions");

const app = express();

/**
 * ✅ IMPORTANT ORDER
 * 1) CORS
 * 2) express.json
 */

// ✅ CORS (temporary open for testing)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Preflight handle (OPTIONS)
app.options("*", cors());

// ✅ Body parser
app.use(express.json({ limit: "1mb" }));

// ✅ Health route
app.get("/", (req, res) => {
  res.json({ ok: true, name: "SUDO24 CRM SaaS API" });
});

// ✅ API Routes
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

// ✅ Start server
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));
  } catch (e) {
    console.error("❌ Failed to start server", e);
    process.exit(1);
  }
})();
