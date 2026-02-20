const mongoose = require("mongoose");

const LeadHistorySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },

    // kisne kiya (optional)
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, default: "" },

    // kya action hua
    action: { type: String, required: true }, // e.g. "note_added", "status_changed", "whatsapp_sent"

    // extra data
    meta: { type: Object, default: {} }, // { text, from, to, status, templateName, etc }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeadHistory", LeadHistorySchema);