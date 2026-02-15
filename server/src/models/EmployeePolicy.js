const mongoose = require("mongoose");

const EmployeePolicySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    requireSelfieIn: { type: Boolean, default: true },
    requireSelfieOut: { type: Boolean, default: true },
    requireLocationIn: { type: Boolean, default: true },
    requireLocationOut: { type: Boolean, default: true },

    breaksEnabled: { type: Boolean, default: true },

    // optional geo-fence
    geoFenceEnabled: { type: Boolean, default: false },
    geoCenterLat: { type: Number, default: null },
    geoCenterLng: { type: Number, default: null },
    geoRadiusMeters: { type: Number, default: 150 },

    // ✅ rules (aapke attendance route me use ho rahe hain)
    fullDayNetMin: { type: Number, default: 360 }, // 6 hours
    maxBreakMin: { type: Number, default: 60 }     // 1 hour total
  },
  { timestamps: true }
);

// ✅ One policy per employee per company
EmployeePolicySchema.index({ companyId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("EmployeePolicy", EmployeePolicySchema);
