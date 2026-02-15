const mongoose = require("mongoose");

const MessageLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },

    channel: { type: String, enum: ["whatsapp"], default: "whatsapp", index: true },
    direction: { type: String, enum: ["outgoing", "incoming"], default: "outgoing", index: true },

    toPhone: { type: String, required: true, trim: true },
    fromPhone: { type: String, default: "", trim: true }, // optional (incoming)

    templateName: { type: String, default: "", trim: true },
    messageText: { type: String, default: "", trim: true },

    // Cloud API message id (for delivery/read updates)
    providerMessageId: { type: String, default: "", index: true },

    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "failed"],
      default: "queued",
      index: true
    },

    error: { type: String, default: "" },

    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null } // employee/admin
  },
  { timestamps: true }
);

module.exports = mongoose.model("MessageLog", MessageLogSchema);
