
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

// ✅ NEW: Dashboard Stats
const statsRoutes = require("./routes/stats");   // 👈 ADD THIS

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Health route
app.get("/", (req, res) =>
  res.json({ ok: true, name: "SUDO24 CRM SaaS API" })
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/super", superRoutes);
app.use("/api/activity", activityRoutes);
const admissionsRoutes = require("./routes/admissions");

// ✅ Attendance + Policies routes
app.use("/api/attendance", attendanceRoutes);
app.use("/api/policies", policyRoutes);

// ✅ Reports routes
app.use("/api/reports", reportRoutes);

// ✅ NEW Stats route
app.use("/api/stats", statsRoutes);   // 👈 ADD THIS

// Start server
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () =>
      console.log(`✅ API running on http://localhost:${PORT}`)
    );
  } catch (e) {
    console.error("❌ Failed to start server", e);
    process.exit(1);
  }
})();
