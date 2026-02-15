const mongoose = require("mongoose");
const crypto = require("crypto");

function makeCompanyCode() {
  // Permanent unique company ID (example: C-9F2A1B3C4D)
  return "C-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // ✅ NEW: Permanent Company ID
    companyCode: { type: String, unique: true, index: true, default: makeCompanyCode },

    plan: { type: String, enum: ["free", "basic", "pro"], default: "free" },
    brandColor: { type: String, default: "#4f7cff" },
    logoUrl: { type: String, default: "" },

    // ✅ NEW: User limit (Super Admin control)
    userLimit: { type: Number, default: 5 }, // free default 5 users

    // ✅ NEW: Feature access (SaaS toggles)
    features: {
      crm: { type: Boolean, default: true },
      attendance: { type: Boolean, default: false },
      reports: { type: Boolean, default: true },
      policies: { type: Boolean, default: false }
    },

    // ✅ Existing
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", CompanySchema);
