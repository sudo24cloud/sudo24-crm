// server/src/models/AuditLog.js
const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String, default: "unknown" },
    action: { type: String, required: true }, // e.g. "TENANT_BLOCK"
    code: { type: String }, // e.g. "TENANT_SUSPENDED"
    message: { type: String },
    meta: { type: Object, default: {} }, // route, method, ip, limits, etc
    severity: { type: String, enum: ["info", "warn", "high"], default: "info" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
