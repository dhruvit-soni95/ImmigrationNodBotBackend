const express = require("express");
// const axios = require("axios");
const cors = require("cors");
// const mongoose = require("mongoose");
const app = express();
require("dotenv").config();
const connectDB = require("./db");
// const crypto = require("crypto");
// const cheerio = require("cheerio");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
// const Chat = require("./models/Chat"); // ⬅️ MongoDB model
const User = require("./models/user");

const Stripe = require("stripe");
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// const TOGETHER_AI_API_KEY = process.env.TOGETHER_AI_API_KEY;

// const GOOGLE_API_KEY = "AIzaSyC5pzHja6UZWDJjP6bZqB-WLWw4CYKeUQE";
// const GOOGLE_CX = "9355b1c87eeb24b0b";
// const TOGETHER_AI_API_KEY ="4987ed2d3a1313e9e83a5978987bbdb0fcd8a53d8692d082b33e88b986a2d091";

// Store conversation history per chatId
// const chatHistory = {};


const cron = require("node-cron");
const downloadLatestPdf = require("./downloadLatestPdf");

(async () => {
  try {
    await downloadLatestPdf();
    console.log("✅ PDF downloaded successfully.");
  } catch (err) {
    console.error("❌ PDF download failed:", err.message);
  }
})();
// (async () => {
//   console.log("📥 Downloading PDF once at startup...");
//   await downloadLatestPdf();
// })();

// cron.schedule("* * * * *", () => {
// // cron.schedule("0 3 * * *", () => {
//   console.log("📥 Downloading daily PDF update...");
//   downloadLatestPdf(PDF_URL, LOCAL_PATH);
// });


require("./routes/passport"); // Load strategies
const session = require("express-session");
const passport = require("passport");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);

// app.get("/download-pdf", async (req, res) => {
//   try {
//     await downloadLatestPdf();
//     res.send("✅ PDF downloaded successfully.");
//   } catch (err) {
//     res.status(500).send("❌ PDF download failed: " + err.message);
//   }
// });




app.post("/api/user/saveDeveloperToken", async (req, res) => {
  const { userEmail, token } = req.body;

  if (token !== "paramsolutions369!") {
    return res.json({ success: false, message: "Invalid token." });
  }

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.json({ success: false, message: "User not found." });

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

    if (user.developerToken.token === "paramsolutions369!" && tokenAge <= 30) {
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
  console.log(`🚀 Server running on port ${PORT}`);
});

// app.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     console.log(message)
//     console.log(chatId)
//     console.log(userEmail)
//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Load history from DB if chatId not seen before
//     if (!chatHistory[chatId]) {
//       const existingUser = await Chat.findOne({ userEmail });
//       const existingChat = existingUser?.chats?.find((c) => c.id === chatId);

//       if (existingChat) {
//         chatHistory[chatId] = existingChat.messages.map((m) => ({
//           role: m.sender === "user" ? "user" : "assistant",
//           content: m.text,
//         }));
//       } else {
//         chatHistory[chatId] = [
//           {
//             role: "system",
//             content:
//               "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
//           },
//         ];

//         // Run immigration topic check only for new chats
//         const related = await isRelatedToImmigration(message);
//         if (!related) {
//           return res.json({
//             response:
//               "⚠️ Sorry, I can only answer questions about Canadian immigration.",
//           });
//         }
//       }
//     }

//     // Add user message
//     chatHistory[chatId].push({ role: "user", content: message });

//     // Construct prompt from chat history (OpenChat-style)
//     const prompt = chatHistory[chatId]
//       .map((m) => {
//         if (m.role === "user") {
//           return `<|start_header_id|>user<|end_header_id|>\n${m.content}<|eot_id|>\n`;
//         } else if (m.role === "assistant") {
//           return `<|start_header_id|>assistant<|end_header_id|>\n${m.content}<|eot_id|>\n`;
//         } else {
//           return ""; // skip system
//         }
//       })
//       .join("");

//     const fullPrompt = `<|begin_of_text|>\n${prompt}`;
//       console.log(fullPrompt)
//     // Send prompt to Flask API (local Mistral)
//     const response = await axios.post("https://nested-halo-miracle-knew.trycloudflare.com/generate", {
//     // const response = await axios.post("https://d81b-34-126-76-215.ngrok-free.app/generate", {
//       prompt: fullPrompt,
//     });

//     const botMessage = response.data?.response?.trim();

//     console.log(botMessage)
//     if (!botMessage) {
//       throw new Error("Invalid API response from Mistral Flask server");
//     }

//     // Add bot reply to history
//     chatHistory[chatId].push({ role: "assistant", content: botMessage });

//     // Prepare messages for saving (skip system)
//     const cleanedMessages = chatHistory[chatId].filter(
//       (m) => m.role !== "system"
//     );

//     const hasUserMessage = cleanedMessages.some((m) => m.role === "user");
//     const justDefaultResponse =
//       cleanedMessages.length === 1 && cleanedMessages[0].role === "assistant";

//     if (!hasUserMessage || justDefaultResponse) {
//       return res.json({ response: botMessage });
//     }

//     // 💡 Generate title from first user message
//     const firstUserMessage = cleanedMessages.find((m) => m.role === "user");
//     let title = "New Chat";
//     if (firstUserMessage?.content) {
//       title =
//         firstUserMessage.content.length > 25
//           ? firstUserMessage.content.slice(0, 25) + "..."
//           : firstUserMessage.content;
//     }

//     // Prepare chat object
//     const formattedChat = {
//       id: chatId,
//       name: title,
//       messages: cleanedMessages.map((m) => ({
//         sender: m.role === "user" ? "user" : "bot",
//         text: m.content,
//       })),
//     };

//     // Save to DB
//     const existingUser = await Chat.findOne({ userEmail });

//     if (existingUser) {
//       existingUser.chats = existingUser.chats.filter((c) => c.id !== chatId);
//       existingUser.chats.push(formattedChat);
//       await existingUser.save();
//     } else {
//       const newChat = new Chat({
//         userEmail,
//         chats: [formattedChat],
//       });
//       await newChat.save();
//     }

//     res.json({ response: botMessage });
//   } catch (error) {
//     console.error("❌ Chat Error:", error.response?.data || error.message);
//     res.status(500).json({
//       error: "Internal Server Error",
//       details: error.response?.data || error.message,
//     });
//   }
// });
