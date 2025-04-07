const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String },  // Store OTP
  otpExpires: { type: Date }, // OTP Expiration Time
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
