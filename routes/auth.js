const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const User = require("../models/user");
require("dotenv").config();

const router = express.Router();

// Nodemailer Transporter for Sending Emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your email from .env
    pass: process.env.EMAIL_PASS, // App password from .env
  },
});

// Signup Route with OTP Verification
router.post("/signup", async (req, res) => {
  const { name, mobile, email, password } = req.body;

  if (!name || !mobile || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

  //   const OTP = otpGenerator.generate(4, {
  //     digits: true, alphabets: false, upperCase: false, specialChars: false
  // });
  const OTP = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(OTP)

    // Save OTP in DB with expiration (5 minutes)
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      mobile,
      email,
      password: hashedPassword,
      otp: OTP,
      otpExpires: otpExpiry,
    });

    await user.save();

    // Send OTP via Email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - AI Chat",
      text: `Hello ${name},\n\nYour OTP code is: ${OTP}\n\nThis OTP is valid for 5 minutes.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return res.status(500).json({ message: "Error sending OTP" });
      }
      console.log("OTP sent: " + info.response);
      res.status(201).json({ message: "OTP sent to email. Verify to complete signup." });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});




// OTP Verification Route
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // If OTP is valid, clear it and mark user as verified
    user.otp = null;
    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "OTP Verified Successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});



// // 🔹 Login Route
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   console.log( email)
//   console.log( password)
//   if (!email || !password) {
//     return res.status(400).json({ message: "Email and Password are required" });
//   }

//   try {
//     const user = await User.findOne({ email });

//     if (!user || !user.isVerified) {
//       return res.status(400).json({ message: "User not found or not verified" });
//     }

//     // Compare password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     // Generate JWT Token
//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

//     res.json({ token, message: "Login successful" });
//   } catch (error) {
//     res.status(500).json({ message: "Server error" });
//   }
// });

// 🔹 Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Email:", email);
  console.log("Password:", password);

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    // If user does not exist
    if (!user) {
      return res.status(400).json({ message: "User not found. Please sign up first." });
    }

    // If user exists but is not verified
    // if (!user.isVerified) {
    //   return res.status(400).json({ message: "User is not verified. Please verify OTP." });
    // }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT Token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, message: "Login successful" });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
