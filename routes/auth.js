const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const User = require("../models/user");
require("dotenv").config();
const crypto = require("crypto");

const passport = require('passport');

const router = express.Router();

// Nodemailer Transporter for Sending Emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your email from .env
    pass: process.env.EMAIL_PASS, // App password from .env
  },
});

const bodyParser = require("body-parser");

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);







// backend/routes/youtube.js


const YOUTUBE_API_KEY = 'AIzaSyANtFlnweaSbUbDzNqn_5Het4Q7ZaK803w';

const CX = "15c8815bd276e49c9"; // From Programmable Search Engine





// GOOGLE
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
  const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  // Redirect to frontend with token and plan
  res.redirect(`http://localhost:3000/oauth-success?token=${token}&plan=${req.user.plan}`);
});

// LINKEDIN
router.get("/linkedin", passport.authenticate("linkedin"));

router.get("/linkedin/callback", passport.authenticate("linkedin", { failureRedirect: "/login" }), (req, res) => {
  const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.redirect(`http://localhost:3000/oauth-success?token=${token}&plan=${req.user.plan}`);
});



router.get('/validate/videos', async (req, res) => {
    const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&cx=${CX}&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const videos = (data.items || [])
      .filter((item) => item.link.includes("youtube.com/watch"))
      .map((item) => {
        const videoId = extractYouTubeVideoId(item.link);
        return {
          title: item.title,
          link: item.link,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      });

    res.json({ videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
  // const videoId = req.query.videoId;

  // if (!videoId) return res.status(400).json({ valid: false });

  // try {
  //   const response = await axios.get(
  //     `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,status&key=${YOUTUBE_API_KEY}`
  //   );

  //   const video = response.data.items[0];

  //   if (
  //     video &&
  //     video.status.privacyStatus === 'public' &&
  //     !video.snippet.title.toLowerCase().includes("music") &&
  //     !video.snippet.title.toLowerCase().includes("shorts")
  //   ) {
  //     res.json({ valid: true, title: video.snippet.title });
  //   } else {
  //     res.json({ valid: false });
  //   }
  // } catch (error) {
  //   res.status(500).json({ valid: false });
  // }
});

function extractYouTubeVideoId(url) {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
// module.exports = router;




// Create Checkout Session Route
router.post("/api/billing/create-checkout-session", async (req, res) => {
  // console.log("heyy")
  try {
    // console.log("heyy111")
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: req.body.priceId, // get price ID from frontend
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      customer_email: req.body.userId, // assuming userId is actually email
      metadata: {
        plan: req.body.plan, // Send the selected plan to metadata
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    // console.log("heyy222")
    console.error("❌ Stripe Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Complete Checkout Route (for success page)
router.post("/api/billing/complete-checkout", async (req, res) => {
  // console.log("hewellelelelooo")
  const { sessionId } = req.body;

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Get the plan from metadata (this is what we set during checkout)
    const plan = session.metadata.plan;
    const userEmail = session.customer_email;
    // console.log(userEmail)
    // console.log(plan)
    // console.log(userEmail)
    // Find the user by email and update their plan
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      { plan: plan }, // Set the plan to the selected plan
      { new: true }
    );


    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User plan updated:", user);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error completing checkout:", err);
    res.status(500).json({ error: "Failed to complete checkout" });
  }
});


// GET user plan by email
router.post("/get-user-by-email", async (req, res) => {
  const { email } = req.body;
  // console.log("fdgdgjdjsdfgnbsdgb")
  // console.log(email)
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// const jwt = require("jsonwebtoken");
// const User = require("../models/User"); // Adjust path as needed

router.get("/user", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      email: user.email,
      name: user.name,
      plan: user.plan, // Important
    });
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});


// Webhook for Stripe to confirm payment and update the user's plan
router.post("/api/billing/stripe-webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const plan = session.metadata.plan;
    const userEmail = session.customer_email;

    try {
      // Update the user's plan in the database
      await User.findOneAndUpdate(
        { email: userEmail },
        { plan: plan },
        { new: true }
      );
    } catch (err) {
      console.error("❌ Error updating user plan:", err);
      return res.status(500).send("Failed to update user plan");
    }
  }

  res.status(200).send("Webhook received");
});


router.post("/signup", async (req, res) => {
  const { name, mobile, email, password } = req.body;

  if (!name || !mobile || !email || !password) {
    return res.status(400).json({ message: "Please fill out all required fields." });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const OTP = Math.floor(1000 + Math.random() * 9000).toString();
    console.log("Generated OTP:", OTP);

    const otpExpiry = new Date(Date.now() + 5 * 60000); // 5 minutes

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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - AI Chat",
      html: `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333;">Hello ${name},</h2>
            <p style="color: #555;">Your OTP code is: <strong style="font-size: 24px; color: #4CAF50;">${OTP}</strong></p>
            <p style="color: #555;">This OTP is valid for 5 minutes. Please use it promptly to complete your process.</p>
            <p style="color: #555;">If you did not request this OTP, please ignore this email.</p>
            <p style="color: #555;">Thank you,<br/>The AI Chat Team</p>
          </div>
        </body>
      </html>`
    };
    // text: `Hello ${name},\n\nYour OTP code is: ${OTP}\n\nThis OTP is valid for 5 minutes.`,

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending OTP email:", err);
        return res.status(500).json({ message: "Failed to send OTP email. Please try again later." });
      }

      console.log("OTP Email sent:", info.response);
      return res.status(201).json({
        message: "Signup successful. An OTP has been sent to your email.",
        token: "dummy-token", // If needed. Otherwise, remove.
      });
    });

  } catch (err) {
    console.error("Signup server error:", err);
    return res.status(500).json({ message: "An unexpected error occurred. Please try again later." });
  }
});

// OTP Verification Route

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found. Please sign up again." });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: "No OTP found or OTP expired. Please request a new one." });
    }

    const currentTime = new Date();
    if (currentTime > user.otpExpires) {
      return res.status(410).json({ message: "OTP has expired. Please request a new one." });
    }

    if (user.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP. Please try again." });
    }

    // OTP is correct and not expired
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});


router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Generate new OTP and save to DB
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    user.otp = newOtp;
    await user.save();

    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - AI Chat",
      html: `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333;">Hello ${email},</h2>
            <p style="color: #555;">Your OTP code is: <strong style="font-size: 24px; color: #4CAF50;"> your requested new OTP ${newOtp}</strong></p>
            <p style="color: #555;">This OTP is valid for 5 minutes. Please use it promptly to complete your process.</p>
            <p style="color: #555;">If you did not request this OTP, please ignore this email.</p>
            <p style="color: #555;">Thank you,<br/>The AI Chat Team</p>
          </div>
        </body>
      </html>`
    };
    // text: `Hello ${name},\n\nYour OTP code is: ${OTP}\n\nThis OTP is valid for 5 minutes.`,

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending OTP email:", err);
        return res.status(500).json({ message: "Failed to send OTP email. Please try again later." });
      }

      console.log("OTP Email sent:", info.response);
      return res.status(201).json({
        message: "Signup successful. An OTP has been sent to your email.",
        token: "dummy-token", // If needed. Otherwise, remove.
      });
    });


    // Send OTP (e.g., via email service)
    console.log(`Resent OTP to ${email}: ${newOtp}`);

    return res.json({ message: "OTP has been resent to your email." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
});


// // 🔹 Login Route


router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Login Attempt:", { email });

  if (!email || !password) {
    return res.status(400).json({
      message: "Both email and password are required to login.",
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this email. Please sign up first.",
      });
    }


    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Incorrect password. Please try again.",
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      token,
      message: "Login successful. Welcome back!",
      user: {
        email: user.email,
        plan: user.plan || "Free", // Send plan back
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
});



// router.post("/forgot-password", async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ message: "Email is required." });
//   }

//   try {
//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({ message: "No account found with this email." });
//     }

//     // 🔐 Generate token
//     const token = crypto.randomBytes(32).toString("hex");

//     user.resetToken = token;
//     user.resetTokenExpires = Date.now() + 3600000; // Token valid for 1 hour

//     await user.save();

//     // 📩 Create reset link
    
//     // const resetLink = `http://localhost:3000/reset-password/${token}`;
//     const resetLink = `http://146.148.96.159/reset-password/${token}`;

//     // ✉️ Send Email
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: "Reset Your Password",
//       html: `
//       <html>
//         <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
//           <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 8px;">
//             <h2 style="color: #333;">Hello ${user.name},</h2>
//             <p style="color: #555;">We received a request to reset the password for your account. Please click the button below to reset your password:</p>
//             <a href="http://146.148.96.159/reset-password/${token}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-align: center; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Your Password</a>
//             <p style="color: #555;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
//             <p style="color: #555;">Thank you,<br/>The AI Chat Team</p>
//           </div>
//         </body>
//       </html>`
//     };
//     // text: `Hello ${user.name},\n\nClick the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.`,

//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         console.error("Error sending reset email:", err);
//         return res.status(500).json({ message: "Failed to send reset email." });
//       }

//       console.log("Reset email sent:", info.response);
//       return res.status(200).json({ message: "Reset link sent to your email. just wait for few minutes." });
//     });

//   } catch (err) {
//     console.error("Forgot password error:", err);
//     return res.status(500).json({ message: "Server error. Please try again later." });
//   }
// });


// const crypto = require("crypto");

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 3600000;

    await user.save();

    const resetLink = `https://www.immigrategpt.ca/reset-password/${token}`;
    // const resetLink = `http://146.148.96.159/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Reset Your Password - AI Chat",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333;">Hello ${user.name},</h2>
              <p style="color: #555;">We received a request to reset the password for your account. Please click the button below to reset your password:</p>
              <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-align: center; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Your Password</a>
              <p style="color: #555;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
              <p style="color: #555;">Thank you,<br/>The AI Chat Team</p>
            </div>
          </body>
        </html>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Reset email sent:", info.response);
    return res.status(200).json({ message: "Reset link sent to your email." });

  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
});





router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() }, // token must not be expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    return res.status(200).json({ message: "Password has been updated successfully." });

  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error. Please try again later." });
  }
});


router.get("/userinfo", async (req, res) => {
  const { email } = req.query; // Retrieve the email from the query string

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email }); // Find the user by email in the database
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Respond with user info (name and email in this case)
    res.json({ name: user.name, email: user.email, plan: user.plan, developerToken: user.developerToken.token });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
