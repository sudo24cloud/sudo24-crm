const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", index: true }, // ✅ ADD
    action: { type: String, required: true },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", ActivitySchema);
