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

// ✅ Middleware
app.use(express.json({ limit: "1mb" }));

// ✅ CORS (ONLY ONCE)
const allowedOrigins = [
  "http://localhost:3000",
  "https://sudo24-crm-1.onrender.com", // ✅ your frontend URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS blocked: " + origin));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Preflight handle (important for login)
app.options("*", cors());

// ✅ Health route
app.get("/", (req, res) => res.json({ ok: true, name: "SUDO24 CRM SaaS API" }));

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
