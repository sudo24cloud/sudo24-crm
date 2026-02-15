const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0 },
    mode: { type: String, default: "cash" }, // cash/upi/card/bank
    status: { type: String, default: "paid" }, // paid/pending/failed
    txnRef: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const AdmissionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, unique: true, index: true },

    admissionCode: { type: String, required: true, index: true }, // e.g. S24-202602-00021

    studentName: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

    courseName: { type: String, required: true },
    batchName: { type: String, default: "" },

    feeTotal: { type: Number, default: 0 },
    feePaid: { type: Number, default: 0 },

    paymentStatus: { type: String, default: "pending" }, // pending/partial/paid
    payments: { type: [PaymentSchema], default: [] },

    admissionStatus: { type: String, default: "active" }, // active/on-hold/refund
    notes: { type: String, default: "" },

    admittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    admittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admission", AdmissionSchema);
