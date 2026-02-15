const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

// ✅ NEW: Education CRM fields (embedded)
const EducationSchema = new mongoose.Schema(
  {
    whatsapp: { type: String, trim: true, default: "" },
    course: { type: String, trim: true, default: "" },          // e.g. Digital Marketing
    courseType: { type: String, trim: true, default: "" },      // e.g. Diploma / Short course
    source: { type: String, trim: true, default: "" },          // Insta/FB/Google/Referral
    qualification: { type: String, trim: true, default: "" },   // e.g. Graduation
    goal: { type: String, trim: true, default: "" },            // Job/Business/Freelance
    budget: { type: String, trim: true, default: "" },          // Under 10k / 10-20k
    mode: { type: String, trim: true, default: "" },            // Online/Offline/Hybrid
    preferredBatch: { type: String, trim: true, default: "" },  // Morning/Evening/Weekend
    counselorNote: { type: String, trim: true, default: "" }    // internal note
  },
  { _id: false }
);

const LeadSchema = new mongoose.Schema(
  {
    companyId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Company", 
      required: true,
      index: true
    },

    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["new", "contacted", "demo", "won", "lost"],
      default: "new",
      index: true
    },

    assignedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    },

    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    nextFollowUp: { type: Date, default: null },

    notes: { type: [NoteSchema], default: [] },

    // ✅ NEW: Education object
    education: { type: EducationSchema, default: () => ({}) },

    // ✅ Admission Link Fields
    admissionId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Admission", 
      default: null,
      index: true
    },

    admissionCode: { 
      type: String, 
      default: "" 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", LeadSchema);
