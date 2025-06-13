const setupGlobals = require("./setup-fetch-globals");

setupGlobals().then(() => {
  const express = require("express");
  const cors = require("cors");
  const app = express();
  require("dotenv").config();
  const connectDB = require("./db");
  const authRoutes = require("./routes/auth");
  const chatRoutes = require("./routes/chat");
  // const testRoutes = require("./routes/Test");
  const User = require("./models/user");

  const Stripe = require("stripe");

  // Connect to MongoDB
  connectDB();

  app.use(cors());
  app.use(express.json());

  const cron = require("node-cron");
  const downloadLatestPdf = require("./downloadLatestPdf");

  (async () => {
    try {
      await downloadLatestPdf();
      // console.log("✅ PDF downloaded successfully.");
    } catch (err) {
      console.error("❌ PDF download failed:", err.message);
    }
  })();

  require("./routes/passport"); // Load strategies
  const session = require("express-session");
  const passport = require("passport");

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api", chatRoutes);
  // app.use("/test", testRoutes);

  app.post("/api/user/saveDeveloperToken", async (req, res) => {
    const { userEmail, token } = req.body;

    if (token !== "paramsolutions369!") {
      return res.json({ success: false, message: "Invalid token." });
    }

    try {
      const user = await User.findOne({ email: userEmail });
      if (!user)
        return res.json({ success: false, message: "User not found." });

      user.developerToken = {
        token,
        createdAt: new Date(),
      };

      await user.save();

      res.json({ success: true });
    } catch (err) {
      console.error("Error saving developer token:", err);
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

  // Example: Express route in Node.js
  app.post("/api/user/validateToken", async (req, res) => {
    const { userEmail } = req.body;

    try {
      const user = await User.findOne({ email: userEmail });
      if (
        !user ||
        !user.developerToken ||
        !user.developerToken.token ||
        !user.developerToken.createdAt
      ) {
        return res.json({ valid: false });
      }

      const now = new Date();
      const tokenCreated = new Date(user.developerToken.createdAt);
      const tokenAge = (now - tokenCreated) / (1000 * 60 * 60 * 24); // in days

      if (
        user.developerToken.token === "paramsolutions369!" &&
        tokenAge <= 30
      ) {
        return res.json({ valid: true, token: user.developerToken.token });
      }

      return res.json({ valid: false });
    } catch (err) {
      console.error("Token validation error:", err);
      res.status(500).json({ valid: false });
    }
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    // console.log(`🚀 Server running on port ${PORT}`);
  });
});
