const mongoose = require("mongoose");

const BreakSchema = new mongoose.Schema(
  {
    type: { type: String, default: "break" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    durationMin: { type: Number, default: 0 },
    note: { type: String, default: "" }
  },
  { _id: false }
);

const PhotoSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true }, // checkin/checkout/breakstart/breakend
    url: { type: String, default: "" },
    base64: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null }
    }
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD

    status: { type: String, enum: ["in_progress", "checked_out"], default: "in_progress" },

    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },

    // legacy fields (optional, safe)
    checkInPhotoUrl: { type: String, default: "" },
    checkInPhotoBase64: { type: String, default: "" },
    checkInLat: { type: Number, default: null },
    checkInLng: { type: Number, default: null },
    checkInAccuracy: { type: Number, default: null },

    checkOutPhotoUrl: { type: String, default: "" },
    checkOutPhotoBase64: { type: String, default: "" },
    checkOutLat: { type: Number, default: null },
    checkOutLng: { type: Number, default: null },
    checkOutAccuracy: { type: Number, default: null },

    breaks: { type: [BreakSchema], default: [] },
    photos: { type: [PhotoSchema], default: [] },

    totalMin: { type: Number, default: 0 },
    breakMin: { type: Number, default: 0 },
    netWorkMin: { type: Number, default: 0 },
    isFullDay: { type: Boolean, default: false },

    remark: { type: String, default: "" }
  },
  { timestamps: true }
);

AttendanceSchema.index({ companyId: 1, userId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
