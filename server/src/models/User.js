const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    companyId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Company", 
      required: true 
    },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    role: { 
      type: String, 
      enum: ["admin", "manager", "employee"], 
      required: true 
    },

    managerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
