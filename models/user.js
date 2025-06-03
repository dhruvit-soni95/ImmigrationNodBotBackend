// const mongoose = require("mongoose");

// const UserSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   mobile: { type: String, required: true, unique: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   otp: { type: String },
//   otpExpires: { type: Date },
//   resetToken: { type: String },
//   resetTokenExpires: { type: Date }, // ✅ changed this line
//   createdAt: { type: Date, default: Date.now },
//   plan: { type: String, default: "Free" },
//   developerToken: {
//     token: { type: String },              // e.g., "paramsolutions369!"
//     createdAt: { type: Date },            // to track expiry (e.g., 1 month)
//   },
// });

// module.exports = mongoose.model("User", UserSchema);


const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, unique: true, sparse: true, default: null }, // ✅ now optional for Google users
  // mobile: { type: String, required: false, unique: false }, // ✅ now optional for Google users
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // ✅ now optional for Google users
  otp: { type: String },
  otpExpires: { type: Date },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  plan: { type: String, default: "Free" },
  provider: { type: String, default: "local" }, // ✅ added to distinguish 'google' vs 'local'
  developerToken: {
    token: { type: String },
    createdAt: { type: Date },
  },
});

module.exports = mongoose.model("User", UserSchema);
