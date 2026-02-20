// server/src/models/Company.js
const mongoose = require("mongoose");
const crypto = require("crypto");

function makeCompanyCode() {
  return "C-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

const CompanySchema = new mongoose.Schema(
  {
    /* =========================
       BASIC INFO
    ========================== */

    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    companyCode: {
      type: String,
      unique: true,
      index: true,
      default: makeCompanyCode
    },

    plan: {
      type: String,
      enum: ["free", "basic", "pro"],
      default: "free"
    },

    brandColor: { type: String, default: "#4f7cff" },
    logoUrl: { type: String, default: "" },

    isActive: { type: Boolean, default: true },

    /* =========================
       SIMPLE FEATURE TOGGLES
    ========================== */

    features: {
      type: Object,
      default: {
        crm: true,
        attendance: false,
        reports: true,
        policies: false
      }
    },

    /* =========================
       ADVANCED MODULES (STEP-7)
    ========================== */

    modules: {
      type: Object,
      default: {
        crm: true,
        attendance: false,
        reports: true,
        policies: false,
        automation: false,
        integrations: true,
        callcenter: false,
        supportdesk: false
      }
    },

    /* =========================
       LIMITS (Plan Based Control)
    ========================== */

    limits: {
      type: Object,
      default: {
        usersMax: 5,
        leadsPerMonth: 5000,
        emailsPerDay: 500,
        storageGB: 10,
        aiCreditsPerMonth: 0,
        whatsappMsgsPerMonth: 0,
        apiCallsPerDay: 12000
      }
    },

    /* =========================
       POLICY RULES (ENFORCEMENT)
    ========================== */

    policy: {
      type: Object,
      default: {
        blockIfSuspended: true,
        enforceUserLimit: true,
        enforceDailyEmail: true,
        enforceLeadsMonthly: false,
        enforceApiCallsDaily: true,
        gracePercent: 10
      }
    },

    /* =========================
       USAGE TRACKING
    ========================== */

    usage: {
      type: Object,
      default: {
        usersUsed: 0,
        emailsToday: 0,
        apiCallsToday: 0,
        leadsThisMonth: 0,
        aiCreditsThisMonth: 0,
        storageUsedGB: 0,
        whatsappMsgsThisMonth: 0,

        lastDailyResetAt: null,
        lastMonthlyResetAt: null
      }
    }
  },
  { timestamps: true }
);

/* =========================================================
   🔁 AUTO RESET HELPERS (OPTIONAL – PRODUCTION READY)
   ========================================================= */

CompanySchema.methods.resetDailyUsageIfNeeded = function () {
  const today = new Date().toDateString();
  const last = this.usage?.lastDailyResetAt
    ? new Date(this.usage.lastDailyResetAt).toDateString()
    : null;

  if (today !== last) {
    this.usage.emailsToday = 0;
    this.usage.apiCallsToday = 0;
    this.usage.lastDailyResetAt = new Date();
  }
};

CompanySchema.methods.resetMonthlyUsageIfNeeded = function () {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const last = this.usage?.lastMonthlyResetAt
    ? `${new Date(this.usage.lastMonthlyResetAt).getFullYear()}-${new Date(
        this.usage.lastMonthlyResetAt
      ).getMonth()}`
    : null;

  if (monthKey !== last) {
    this.usage.leadsThisMonth = 0;
    this.usage.aiCreditsThisMonth = 0;
    this.usage.whatsappMsgsThisMonth = 0;
    this.usage.lastMonthlyResetAt = new Date();
  }
};

module.exports = mongoose.model("Company", CompanySchema);
