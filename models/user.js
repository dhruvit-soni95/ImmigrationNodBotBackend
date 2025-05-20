const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String },
  otpExpires: { type: Date },
  resetToken: { type: String },
  resetTokenExpires: { type: Date }, // ✅ changed this line
  createdAt: { type: Date, default: Date.now },
  plan: { type: String, default: "Free" },
  developerToken: {
    token: { type: String },              // e.g., "paramsolutions369!"
    createdAt: { type: Date },            // to track expiry (e.g., 1 month)
  },
});

module.exports = mongoose.model("User", UserSchema);
