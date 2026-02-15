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
const attendanceRoutes = require("./routes/attendance");
const policyRoutes = require("./routes/policies");
const reportRoutes = require("./routes/reports");
const statsRoutes = require("./routes/stats");
const admissionsRoutes = require("./routes/admissions");

const app = express();

/* ================================
   ✅ SIMPLE & SAFE PRODUCTION CORS
================================ */

app.use(cors({
  origin: true,          // automatically allow requesting origin
  credentials: true,
}));

// Handle preflight properly
app.options("*", cors());

/* ================================
   MIDDLEWARE
================================ */

app.use(express.json({ limit: "1mb" }));

/* ================================
   HEALTH CHECK
================================ */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "SUDO24 CRM SaaS API Running 🚀"
  });
});

/* ================================
   API ROUTES
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
