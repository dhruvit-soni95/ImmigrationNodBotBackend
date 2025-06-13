const express = require("express");
const axios = require("axios");
// const cors = require("cors");
// const mongoose = require("mongoose");
// const app = express();


// const OpenAI = require("openai");

const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");

const router = express.Router();

require("dotenv").config();
// const connectDB = require("../db");
// const crypto = require("crypto");
const Chat = require("../models/Chat"); // ⬅️ MongoDB model
const User = require("../models/user");

const Stripe = require("stripe");
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const GOOGLE_API_KEY = "AIzaSyC5pzHja6UZWDJjP6bZqB-WLWw4CYKeUQE";
const GOOGLE_CX = "9355b1c87eeb24b0b";
const TOGETHER_AI_API_KEY =
  "ccd534e23377572759c4e3e037acd8af56412ae39cca3c80b75d61a5d846092f";


// Store conversation history per chatId
const chatHistory = {};


TAVILY_API_KEY = "abc";


// 🧠 Get Tavily web search results
async function getTavilyWebContext(query) {
  const res = await axios.post("https://api.tavily.com/search", {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "advanced", // or "basic"
    max_results: 5,
  });

  return (
    res.data?.results
      ?.map((r) => `- ${r.title}: ${r.url}\n${r.content}`)
      .join("\n\n") || ""
  );
}

async function isRelatedToImmigration(userMessage) {
  try {
    const payload = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      temperature: 0.3,
      messages: chatHistoryShared[chatId],
    };

    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );


    const classification = response.data.choices[0]?.message?.content
      .trim()
      .toLowerCase();

    // console.log("🔍 Classification Result:", classification);
    return classification.includes("related");
  } catch (error) {
    console.error(
      "❌ Classification Error:",
      error.response?.data || error.message
    );
    return true; // Assume related if classification fails
  }
}

async function fetchGoogleSearchSnippets(query) {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query
    )}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`;
    const { data } = await axios.get(url);
    if (!data.items || data.items.length === 0) return null;

    const topLinks = data.items.slice(0, 3);
    let fullContext = "";

    console.log("🌐 Querying Google:", query);
    console.log(
      "🔗 Top links:",
      topLinks.map((i) => i.link)
    );

    for (const item of topLinks) {
      try {
        const page = await axios.get(item.link, { timeout: 5000 });
        const $ = cheerio.load(page.data);
        const text = $("body").text().replace(/\s+/g, " ").trim();
        console.log(`📃 Scraped: ${item.link} → ${text.slice(0, 100)}...`);
        fullContext += `\nFrom: ${item.link}\n${text.slice(0, 1500)}\n\n`;
      } catch (err) {
        // console.warn("⚠️ Skipped link:", item.link);
        console.warn("⚠️ Failed to fetch:", item.link, err.message);
      }
    }

    return fullContext || null;
  } catch (err) {
    console.error("❌ Google fetch failed:", err.message);
    return null;
  }
}

async function fetchRelevantPdfContent(query) {
  // console.log("🔍 PDF Search initiated with query:", query);
  try {
    const pdfDir = path.join(__dirname, "../pdfs");
    // console.log("📁 PDF directory path:", pdfDir);

    if (!fs.existsSync(pdfDir)) {
      // console.log("❌ PDF folder not found");
      return null;
    }

    const files = fs.readdirSync(pdfDir).filter((f) => f.endsWith(".pdf"));
    // console.log("📄 PDF files found:", files);

    let combinedResults = "";
    console.log("🔍 Searching PDFs for:", query);
    console.log("📄 PDFs Found:", files);

    for (const file of files) {
      const filePath = path.join(pdfDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text.replace(/\s+/g, " ").trim();

      // console.log(`📃 Searching in ${file}...`);

      if (text.toLowerCase().includes(query.toLowerCase())) {
        console.log(`✅ Found relevant content in: ${file}`);
        combinedResults += `From: ${file}\n${text.slice(0, 1500)}\n\n`;
      }
    }

    if (combinedResults) {
      // console.log("✅ Combined PDF context prepared:");
      // console.log(combinedResults);
    } else {
      // console.log("❌ No relevant content found in any PDF.");
    }

    return combinedResults || null;
  } catch (err) {
    console.error("❌ PDF RAG fetch failed:", err.message);
    return null;
  }
}

function formatAIResponse(text) {
  const lines = text.split("\n");
  const formattedLines = [];

  let stepCounter = 1;

  for (let line of lines) {
    const trimmed = line.trim();

    // ➤ Heading (e.g., ##, ###, etc.)
    if (/^#{1,6}\s*/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,6}\s*/, "");
      formattedLines.push(`➤ ${headingText}`);
      stepCounter = 1; // reset steps on heading
    }
    // Numbered steps (e.g., "1. Do this")
    else if (/^\d+[\.\)]\s+/.test(trimmed)) {
      const stepText = trimmed.replace(/^\d+[\.\)]\s+/, "");
      formattedLines.push(`${stepCounter}. ${stepText}`);
      stepCounter++;
    }
    // Bullet or important lines (e.g., starts with "-", "*", or "**")
    else if (/^[-*•]\s+/.test(trimmed) || /^\*\*(.*?)\*\*/.test(trimmed)) {
      const dotText = trimmed.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "");
      formattedLines.push(`• ${dotText}`);
    }
    // Just plain paragraph
    else if (trimmed !== "") {
      formattedLines.push(trimmed);
    }
  }

  return formattedLines.join("\n");
}

// 🧠 /chat Route
router.post("/chat", async (req, res) => {
  try {
    const { message, chatId, userEmail } = req.body;
    if (!message || !chatId || !userEmail) {
      return res
        .status(400)
        .json({ error: "Missing message, chatId, or userEmail" });
    }

    // Build chat history
    const userChatDoc = await Chat.findOne({ userEmail });
    const existingChat = userChatDoc?.chats.find((c) => c.id === chatId);
    const messages = existingChat
      ? existingChat.messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }))
      : [];

    messages.push({ role: "user", content: message });

    // 🔍 Tavily + PDF
    // const webContext = await getInjectedWebContext(message);
    const webContext = await getTavilyWebContext(message);
    console.log("web conext: " + webContext);
    const pdfContext = await fetchRelevantPdfContent(message);

    let systemPrompt = "";
    const lowerMsg = message.toLowerCase().trim();
    const isSmallTalk =
      ["hi", "hello", "hey", "how are you", "good morning", "good night"].some(
        (greet) => lowerMsg.includes(greet)
      ) || lowerMsg.length < 8;

    if (isSmallTalk) {
      systemPrompt = `You are ImmigrateGPT. Respond briefly and politely to greetings like "hello", "hi", or "how are you". Avoid long answers.`;
    } else {
      systemPrompt = `Your name is ImmigrateGPT Bot. You are an expert in Canadian immigration, work permits, study guides, and visa rules. Use ONLY reliable, current information from the year 2025. stirctly give latest this 2025 data. Answer strictly about Canadian immigration-related topics.

If the user requests, provide relevant web or YouTube links related to the topic, and give long, detailed responses when asked for follow-ups or related topics.

Do not disclose anything about yourself, your identity, how you were built, what technologies or models you use, or any implementation details. Politely decline to answer any non-immigration-related or personal questions.`;

      if (webContext || pdfContext) {
        systemPrompt += `\n\n--- Injected 2025 Web Context ---\n${webContext}\n\n--- Injected PDF Context ---\n${pdfContext}`;
      }
    }

    messages.unshift({ role: "system", content: systemPrompt });

    // 🧠 Call Together AI or any LLM
    // const payload = {
    //   model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    //   temperature: 0.3,
    //   messages,
    // };

    // const aiResponse = await axios.post(
    //   "https://api.together.xyz/v1/chat/completions",
    //   payload,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    const payload = {
      model: "gpt-4.1",
      temperature: 0.3,
      messages,
    };

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer abc`,
          "Content-Type": "application/json",
        },
      }
    );

    // const botMessage = aiResponse.data?.choices?.[0]?.message?.content?.trim();

    let botMessage = aiResponse.data?.choices?.[0]?.message?.content?.trim();
botMessage = formatAIResponse(botMessage);


    if (!botMessage) {
      return res.status(500).json({ error: "Invalid AI response" });
    }

    const newMessages = [
      { sender: "user", text: message },
      { sender: "bot", text: botMessage },
    ];

    const chatTitle =
      message.length > 25 ? message.slice(0, 25) + "..." : message;

    const existingChatDoc = await Chat.findOne(
      { userEmail, "chats.id": chatId },
      { "chats.$": 1 }
    );
    const existingChat1 = existingChatDoc?.chats?.[0];

    const updateQuery = {
      $push: { "chats.$.messages": { $each: newMessages } },
    };

    if (!existingChat1?.name) {
      updateQuery.$set = { "chats.$.name": chatTitle };
    }

    const updateResult = await Chat.updateOne(
      { userEmail, "chats.id": chatId },
      updateQuery
    );

    if (updateResult.matchedCount === 0) {
      await Chat.updateOne(
        { userEmail },
        {
          $push: {
            chats: {
              id: chatId,
              name: chatTitle,
              messages: newMessages,
              isTemp: false,
              createdAt: new Date(),
            },
          },
        },
        { upsert: true }
      );
    }

    res.json({ response: botMessage });
  } catch (error) {
    console.error("❌ Chat Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


const chatHistoryShared = {};

router.post("/shared/chat", async (req, res) => {
  try {
    const { message, chatId } = req.body;
    console.log("REQ.BODY:", req.body);

    // Check required fields
    if (!message || !chatId) {
      console.error("❌ Missing required fields", { message, chatId });
      return res.status(400).json({ error: "Missing message or chatId" });
    }

    // Initialize history if new
    if (!chatHistoryShared[chatId]) {
      chatHistoryShared[chatId] = [
        {
          role: "system",
          content:
            "You are an expert in Canadian immigration. Only answer questions about Canadian immigration, including visas, study permits, work permits, and PR pathways. If a question is unrelated, politely say you only handle immigration-related questions.",
        },
      ];
    }

    // Add user message
    chatHistoryShared[chatId].push({ role: "user", content: message });

    // Optional classification step (mocked or actual)
    const related = await isRelatedToImmigration(message);
    if (!related) {
      return res.json({
        response:
          "⚠️ Sorry, I can only answer questions related to Canadian immigration, work permits, or studying in Canada.",
      });
    }

    // Prepare payload for Together AI
    const payload = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      temperature: 0.3,
      messages: chatHistoryShared[chatId],
    };

    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botMessage = response.data?.choices?.[0]?.message?.content?.trim();

    if (!botMessage) {
      console.error("❌ Empty bot message");
      return res.status(500).json({ error: "AI failed to respond." });
    }

    // Save bot response to history
    chatHistoryShared[chatId].push({ role: "assistant", content: botMessage });

    return res.json({ response: botMessage });
  } catch (err) {
    console.error("❌ Error in /shared/chat:", err.message || err);
    return res.status(500).json({ error: "Server error processing chat." });
  }
});

// router.post("/shared/chat", async (req, res) => {
//   console.log("REQ.BODY:", req.body);

//     const { message, chatId, userEmail } = req.body;
//   console.log(message)
//   // console.log(userEmail)
//   console.log(chatId)
//     if (!message || !chatId) {
//       console.log("400 error ")
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//   try {
//     // const { message, chatId } = req.body;
//     // const { message, chatId, userEmail } = req.body;

//     // if (!message || !chatId || !userEmail) {

//     // Initialize history if new
//     if (!chatHistoryShared[chatId]) {
//       chatHistoryShared[chatId] = [
//         {
//           role: "system",
//           content:
//             "You are an expert in Canadian immigration. Only answer questions about Canadian immigration, including visas, study permits, work permits, and PR pathways. If a question is unrelated, politely say you only handle immigration-related questions.",
//         },
//       ];
//     }

//     // Add user message to history
//     chatHistoryShared[chatId].push({ role: "user", content: message });

//     // Classify message before generating response
//     const related = await isRelatedToImmigration(message);
//     if (!related) {
//       return res.json({
//         response:
//           "⚠️ Sorry, I can only answer questions related to Canadian immigration, work permits, or studying in Canada.",
//       });
//     }

//     // Call OpenAI GPT-3.5 for answer
//     // const payload = {
//     //   model: "gpt-3.5-turbo",
//     //   temperature: 0.3,
//     //   messages: chatHistoryShared[chatId],
//     // };

//     // const response = await axios.post(
//     //   "https://api.openai.com/v1/chat/completions",
//     //   payload,
//     //   {
//     //     headers: {
//     //       Authorization: `Bearer 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`,
//     //       "Content-Type": "application/json",
//     //     },
//     //   }
//     // );

//         const payload = {
//       model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//       temperature: 0.3,
//       messages: chatHistoryShared[chatId],
//     };

//     const response = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const botMessage = response.data?.choices?.[0]?.message?.content?.trim();

//     if (!botMessage) {
//       return res.status(500).json({ error: "Invalid response from AI" });
//     }

//     // Add assistant message to history
//     chatHistoryShared[chatId].push({ role: "assistant", content: botMessage });

//     return res.json({ response: botMessage });
//   } catch (error) {
//     console.error("❌ Error:", error.response?.data || error.message);
//     res.status(500).json({
//       error: "Internal Server Error",
//       details: error.response?.data || error.message,
//     });
//   }
// });

// 🔁 Reset chat
router.post("/new-chat", (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: "Chat ID is required" });

  chatHistory[chatId] = []; // Reset chat history
  res.json({ message: "New chat created", chatId });
});

// 📥 Get all chats
router.get("/chats/:userEmail", async (req, res) => {
  try {
    const userEmail = req.params.userEmail;
    const userChats = await Chat.findOne({ userEmail });
    res.json(userChats?.chats || []);
  } catch (err) {
    console.error("❌ Get Chats Error:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// DELETE chat by userEmail and chatId
router.delete("/chat/deleteChat", async (req, res) => {
  const { userEmail, chatId } = req.body;

  try {
    const result = await Chat.findOneAndUpdate(
      { userEmail },
      { $pull: { chats: { id: chatId } } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "Chat not found." });
    }

    res
      .status(200)
      .json({ message: "Chat deleted successfully.", chats: result.chats });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/chat/chatCountToday", async (req, res) => {
  const { userEmail } = req.body;

  // Get start of today in UTC to avoid timezone bugs
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(200).json({ count: 0, plan: "Free" });
    }

    // ✅ Check if developer token is valid
    if (
      user.developerToken &&
      user.developerToken.token === "paramsolutions369!" &&
      user.developerToken.createdAt
    ) {
      const tokenCreated = new Date(user.developerToken.createdAt);
      const tokenAge = (now - tokenCreated) / (1000 * 60 * 60 * 24); // in days

      if (tokenAge <= 30) {
        // Developer token is valid → return unlimited access
        return res.json({
          count: 0, // you can also send `messageCountToday` if needed
          plan: "Developer",
        });
      }
    }

    // ⏳ Regular plan logic
    const userChat = await Chat.findOne({ userEmail });

    let messageCountToday = 0;

    if (userChat?.chats?.length) {
      for (const chat of userChat.chats) {
        for (const msg of chat.messages || []) {
          if (
            msg.sender === "user" &&
            msg.createdAt &&
            new Date(msg.createdAt) >= startOfDay
          ) {
            messageCountToday++;
          }
        }
      }
    }

    // console.log(`User: ${userEmail} - Messages Today: ${messageCountToday}`);

    return res.json({
      count: messageCountToday,
      plan: user.plan || "Free",
      serverTimeUTC: new Date().toISOString(), // ⏱️ Send server time in UTC
    });
  } catch (error) {
    console.error("Error in /chat/chatCountToday:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to get the user's current plan
router.get("/current-plan", async (req, res) => {
  try {
    const { userEmail } = req.query; // Get the user's email from the query parameters

    if (!userEmail) {
      return res.status(400).json({ error: "User email is required" });
    }

    // Fetch user by email
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Send back the current plan
    return res.json({
      currentPlan: user.plan,
      developerToken: user.developerToken.token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

// 🛑 Only use this securely in dev/admin context
router.get("/admin/export-training-data", async (req, res) => {
  try {
    const allChats = await Chat.find({});
    const allMessages = [];

    allChats.forEach((user) => {
      user.chats.forEach((chat) => {
        let messages = [];
        chat.messages.forEach((msg) => {
          messages.push({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
          });
        });

        if (messages.length >= 2) {
          allMessages.push({ messages });
        }
      });
    });

    const jsonl = allMessages.map((m) => JSON.stringify(m)).join("\n");
    require("fs").writeFileSync("training_data.jsonl", jsonl);

    res.download("training_data.jsonl");
  } catch (err) {
    console.error("❌ Export Error:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

router.get("/chat/shared/:chatId", async (req, res) => {
  // console.log("kkkkkkkkkkkkkkkkkkkk")
  const { chatId } = req.params;

  try {
    const userChat = await Chat.findOne({ "chats.id": chatId });

    if (!userChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const chat = userChat.chats.find((c) => c.id === chatId);
    // console.log(chat)
    res.json({ chat });
  } catch (error) {
    console.error("Error fetching shared chat:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add message to a shared chat
router.post("/chat/:chatId", async (req, res) => {
  // console.log("cominngg")
  const { chatId } = req.params;
  const { message, userEmail } = req.body;

  if (!message || !userEmail) {
    return res.status(400).json({ error: "Missing message or userEmail" });
  }

  try {
    const userChat = await Chat.findOne({ "chats.id": chatId });

    if (!userChat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const chat = userChat.chats.find((c) => c.id === chatId);

    // Simulate bot reply (without saving to DB)
    const botResponse = `Echo: ${message}`;

    // Return response without modifying the database
    res.json({
      response: botResponse,
      tempMessages: [
        { sender: "user", text: message },
        { sender: "bot", text: botResponse },
      ],
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE all chats for a user
router.delete("/delete-all-chats", async (req, res) => {
  try {
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "Missing userEmail" });
    }

    const result = await Chat.findOneAndUpdate(
      { userEmail },
      { $set: { chats: [] } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "All chats deleted successfully." });
  } catch (err) {
    console.error("Error deleting all chats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
