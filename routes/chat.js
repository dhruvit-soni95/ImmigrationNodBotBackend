const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();

const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");
// const pdfParse = require("pdf-parse");

const router = express.Router();

require("dotenv").config();
const connectDB = require("../db");
const crypto = require("crypto");
// const cheerio = require("cheerio");
// const authRoutes = require("./routes/auth");
// const chatRoutes = require("./routes/chat");
const Chat = require("../models/Chat"); // ⬅️ MongoDB model
const User = require("../models/user");

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Connect to MongoDB
// connectDB();

// app.use(cors());
// app.use(express.json());

// const TOGETHER_AI_API_KEY = process.env.TOGETHER_AI_API_KEY;

const GOOGLE_API_KEY = "AIzaSyC5pzHja6UZWDJjP6bZqB-WLWw4CYKeUQE";
const GOOGLE_CX = "9355b1c87eeb24b0b";
const TOGETHER_AI_API_KEY =
  "4987ed2d3a1313e9e83a5978987bbdb0fcd8a53d8692d082b33e88b986a2d091";

// Store conversation history per chatId
const chatHistory = {};

async function isRelatedToImmigration(userMessage) {
  try {
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a classifier. Reply with 'related' if the question is about Canadian immigration, work permits, visas, or studying in Canada. Otherwise, reply with 'unrelated'. Do not explain anything. Only say 'related' or 'unrelated'.",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 5,
      temperature: 0,
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer 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`,
          "Content-Type": "application/json",
        },
      }
    );

    const classification = response.data.choices[0]?.message?.content
      .trim()
      .toLowerCase();

    console.log("🔍 Classification Result:", classification);
    return classification.includes("related");
  } catch (error) {
    console.error(
      "❌ Classification Error:",
      error.response?.data || error.message
    );
    return true; // Assume related if classification fails
  }
}

// async function isRelatedToImmigration(userMessage) {
//   try {
//     const payload = {
//       model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a classifier. Reply with 'related' if the question is about Canadian immigration. Otherwise, reply with 'unrelated'.",
//         },
//         { role: "user", content: userMessage },
//       ],
//       max_tokens: 5,
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

//     const classification = response.data.choices[0]?.message?.content
//       .trim()
//       .toLowerCase();
//     console.log("🔍 Classification Result:", classification);

//     return classification.includes("related");
//   } catch (error) {
//     console.error(
//       "❌ Classification Error:",
//       error.response?.data || error.message
//     );
//     return true; // Default to true if classification fails
//   }
// }

async function fetchGoogleSearchSnippets(query) {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query
    )}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`;
    const { data } = await axios.get(url);
    if (!data.items || data.items.length === 0) return null;

    const topLinks = data.items.slice(0, 3);
    let fullContext = "";

    for (const item of topLinks) {
      try {
        const page = await axios.get(item.link, { timeout: 5000 });
        const $ = cheerio.load(page.data);
        const text = $("body").text().replace(/\s+/g, " ").trim();
        fullContext += `\nFrom: ${item.link}\n${text.slice(0, 1500)}\n\n`;
      } catch (err) {
        // console.warn("⚠️ Skipped link:", item.link);
      }
    }

    return fullContext || null;
  } catch (err) {
    console.error("❌ Google fetch failed:", err.message);
    return null;
  }
}

// async function fetchRelevantPdfContent(query) {
//   const testPath = path.join(
//     __dirname,
//     "../pdfs/Canadian-Rea-Estate-The-Worlds-Best-Kept-Secret_FINAL.pdf"
//   );
//   console.log("Testing path:", testPath);
//   console.log("Exists?", fs.existsSync(testPath));

//   try {
//     console.log(path.join(__dirname, "../pdfs"));
//     const pdfFolder = path.join(__dirname, "../pdfs"); // adjust if needed
//     const files = fs
//       .readdirSync(pdfFolder)
//       .filter((file) => file.endsWith(".pdf"));

//     let fullContext = "";

//     for (const file of files) {
//       const filePath = path.join(pdfFolder, file);
//       console.log("filePath");
//       console.log(filePath);
//       const dataBuffer = fs.readFileSync(filePath);
//       const pdfData = await pdfParse(dataBuffer);
//       const text = pdfData.text.replace(/\s+/g, " ").trim();

//       // Simple relevance check: contains query keyword(s)
//       if (text.toLowerCase().includes(query.toLowerCase())) {
//         fullContext += `\nFrom PDF: ${file}\n${text.slice(0, 1500)}\n\n`;
//         console.log(fullContext);
//       }
//     }

//     return fullContext || null;
//   } catch (err) {
//     console.error("❌ PDF fetch failed:", err.message);
//     return null;
//   }
// }

// async function fetchRelevantPdfContent(query) {
//   try {
//     const filePath = path.join(__dirname, "../pdfs/latest.pdf");

//     if (!fs.existsSync(filePath)) return null;

//     const dataBuffer = fs.readFileSync(filePath);
//     const pdfData = await pdfParse(dataBuffer);
//     const text = pdfData.text.replace(/\s+/g, " ").trim();

//     if (text.toLowerCase().includes(query.toLowerCase())) {
//       return `From: latest.pdf\n${text.slice(0, 1500)}\n\n`;
//     }

//     return null;
//   } catch (err) {
//     console.error("❌ PDF RAG fetch failed:", err.message);
//     return null;
//   }
// }

// async function fetchRelevantPdfContent(query) {
//     console.log("🔍 PDF Search initiated with query:", query); // ✅ Add this line
//   try {
//         console.log("📄 PDF function called with query:", query); // ✅ Always logs

//     const pdfDir = path.join(__dirname, "../pdfs");
//     // if (!fs.existsSync(pdfDir)) return null;
//     //   console.warn("⚠️ PDF directory does not exist:", pdfDir);
//     if (!fs.existsSync(pdfDir)) {
//       console.warn("⚠️ PDF directory does not exist:", pdfDir);
//       return null;
//     }

//     const files = fs.readdirSync(pdfDir).filter((f) => f.endsWith(".pdf"));

//     let combinedResults = "";

//     for (const file of files) {
//       const filePath = path.join(pdfDir, file);
//       const dataBuffer = fs.readFileSync(filePath);
//       const pdfData = await pdfParse(dataBuffer);
//       const text = pdfData.text.replace(/\s+/g, " ").trim();

//             console.log(`🔍 Scanning PDF: ${file}`);

//       if (text.toLowerCase().includes(query.toLowerCase())) {
//         console.log(`✅ Found relevant content in: ${file}`);
//         combinedResults += `From: ${file}\n${text.slice(0, 1500)}\n\n`;
//       }
//     }

//     return combinedResults || null;
//   } catch (err) {
//     console.error("❌ PDF RAG fetch failed:", err.message);
//     return null;
//   }
// }
async function fetchRelevantPdfContent(query) {
  console.log("🔍 PDF Search initiated with query:", query);
  try {
    const pdfDir = path.join(__dirname, "../pdfs");
    console.log("📁 PDF directory path:", pdfDir);

    if (!fs.existsSync(pdfDir)) {
      console.log("❌ PDF folder not found");
      return null;
    }

    const files = fs.readdirSync(pdfDir).filter((f) => f.endsWith(".pdf"));
    console.log("📄 PDF files found:", files);

    let combinedResults = "";

    for (const file of files) {
      const filePath = path.join(pdfDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text.replace(/\s+/g, " ").trim();

      console.log(`📃 Searching in ${file}...`);

      if (text.toLowerCase().includes(query.toLowerCase())) {
        console.log(`✅ Found relevant content in: ${file}`);
        combinedResults += `From: ${file}\n${text.slice(0, 1500)}\n\n`;
      }
    }

    if (combinedResults) {
      console.log("✅ Combined PDF context prepared:");
      console.log(combinedResults);
    } else {
      console.log("❌ No relevant content found in any PDF.");
    }

    return combinedResults || null;
  } catch (err) {
    console.error("❌ PDF RAG fetch failed:", err.message);
    return null;
  }
}

// if (webContext) {
// if (combinedContext.trim() !== "") {

// if (webContext || pdfContext) {
//   chatHistory[chatId].push({
//     role: "system",
//     content: `Use the following 2025 web context to answer strictly with latest 2025 information. Prioritize this content over your own knowledge:\n\n${
//       webContext || ""
//     }\n${pdfContext || ""}`,
//     // content: `Use the following 2025 web context to answer strictly with latest 2025 information. Prioritize this content over your own knowledge:\n\n${webContext || "" }`,
//   });
// }

router.post("/chat", async (req, res) => {
  try {
    const { message, chatId, userEmail } = req.body;

    if (!message || !chatId || !userEmail) {
      return res
        .status(400)
        .json({ error: "Missing message, chatId, or userEmail" });
    }

    // Initialize chatHistory if needed from DB
    if (!chatHistory[chatId]) {
      const existingUserChat = await Chat.findOne({ userEmail });
      const existingChat = existingUserChat?.chats.find((c) => c.id === chatId);

      chatHistory[chatId] = existingChat
        ? existingChat.messages.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          }))
        : [];
    }

    // Add current user message to chat history
    chatHistory[chatId].push({ role: "user", content: message });

    // Fetch RAG contexts
    const webContext = await fetchGoogleSearchSnippets(message);
    const pdfContext = await fetchRelevantPdfContent(message);

    let combinedContext = "";
    if (webContext) {
      combinedContext += `--- Google 2025 Web Search ---\n${webContext}\n\n`;
    }
    if (pdfContext) {
      combinedContext += `--- PDF 2025 Documents ---\n${pdfContext}`;
    }

    console.log("🌐 Web Context Fetched:\n", webContext || "❌ No web context found.");
    console.log("📄 Injected System Context:\n", combinedContext);

    // Build single system prompt
    // let systemPrompt = `You are an expert in Canadian immigration, work permits, study guides, and visa rules. Use ONLY reliable, current information from the year 2025. Answer strictly about Canadian immigration-related topics. If the user requests, provide relevant web or YouTube links related to the topic. and also give long details if user want again or some some related topic\n\n`;
    let systemPrompt = `You are an expert in Canadian immigration, work permits, study guides, and visa rules. Use ONLY reliable, current information from the year 2025. Answer strictly about Canadian immigration-related topics. If the user requests, provide relevant web or YouTube links related to the topic, and give long, detailed responses when asked for follow-ups or related topics.

Do not disclose anything about yourself, your identity, how you were built, what technologies or models you use, or any implementation details. Politely decline to answer any non-immigration-related or personal questions.`;


    if (combinedContext.trim()) {
      systemPrompt += `--- Injected 2025 Context (from Web & PDF) ---\n${combinedContext}\n\n`;
    }

    // Prepare messages for OpenAI: system + conversation history (user & assistant only)
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory[chatId].filter(m => m.role !== "system"),
      // current user message is already in chatHistory
    ];

    // Call OpenAI Chat Completion API
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        messages,
      },
      {
        headers: {
          Authorization: `Bearer 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`,
          "Content-Type": "application/json",
        },
      }
    );

    const botMessage = aiResponse.data?.choices?.[0]?.message?.content?.trim();

    if (!botMessage) {
      return res.status(500).json({ error: "Invalid AI response" });
    }

    // Add assistant reply to chat history
    chatHistory[chatId].push({ role: "assistant", content: botMessage });

    // Prepare messages for DB (filter out system messages)
    const cleanedMessages = chatHistory[chatId].filter(m => m.role !== "system");
    // const formattedMessages = cleanedMessages.map(m => ({
    //   sender: m.role === "user" ? "user" : "bot",
    //   text: m.content,
    // }));
    const formattedMessages = cleanedMessages.map((m) => ({
      sender: m.role === "user" ? "user" : "bot",
      text: m.content,
      createdAt: m.createdAt || new Date(), // ✅ Keep original time if exists
    }));

    // Create chat title from first user message
    const firstUserMessage = cleanedMessages.find(m => m.role === "user");
    const title = firstUserMessage?.content
      ? firstUserMessage.content.length > 25
        ? firstUserMessage.content.slice(0, 25) + "..."
        : firstUserMessage.content
      : "New Chat";

    // Save or update chat in DB
    let userDoc = await Chat.findOne({ userEmail });

    if (userDoc) {
      const chatIndex = userDoc.chats.findIndex(c => c.id === chatId);
      if (chatIndex !== -1) {
        // Update existing chat
        userDoc.chats[chatIndex].messages = formattedMessages;
        userDoc.chats[chatIndex].name = title;
      } else {
        // Add new chat
        userDoc.chats.push({
          id: chatId,
          name: title,
          messages: formattedMessages,
          isTemp: false,
          createdAt: new Date(),
        });
      }
      userDoc.markModified("chats");
      await userDoc.save();
    } else {
      // New user document
      const newUserChat = new Chat({
        userEmail,
        chats: [
          {
            id: chatId,
            name: title,
            messages: formattedMessages,
            isTemp: false,
            createdAt: new Date(),
          },
        ],
      });
      await newUserChat.save();
    }

    res.json({ response: botMessage });
  } catch (error) {
    console.error("❌ Chat Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





// router.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Load previous chat messages if they exist
//     let chatMessages = [];
//     const userDoc = await Chat.findOne({ userEmail });
//     const existingChat = userDoc?.chats.find((c) => c.id === chatId);

//     if (existingChat) {
//       chatMessages = existingChat.messages.map((m) => ({
//         role: m.sender === "user" ? "user" : "assistant",
//         content: m.text,
//         createdAt: m.createdAt || new Date(),
//       }));
//     }

//     // Add new user message
//     const userMessage = {
//       role: "user",
//       content: message,
//       createdAt: new Date(),
//     };
//     chatMessages.push(userMessage);

//     // RAG: Fetch additional context
//     const webContext = await fetchGoogleSearchSnippets(message);
//     const pdfContext = await fetchRelevantPdfContent(message);

//     // Compose system prompt with 2025 context
//     let systemPrompt = `You are an expert in Canadian immigration. Answer clearly, citing relevant Canadian laws or official guidelines when possible.`;

//     if (webContext || pdfContext) {
//       systemPrompt += "\n\n--- Injected 2025 Context ---\n";
//       if (webContext) systemPrompt += `--- Google 2025 Web Search ---\n${webContext}\n\n`;
//       if (pdfContext) systemPrompt += `--- PDF 2025 Documents ---\n${pdfContext}`;
//     }

//     // Prepare chat history for OpenAI
//     const messages = [
//       { role: "system", content: systemPrompt },
//       ...chatMessages.map(({ role, content }) => ({ role, content })),
//     ];

//     // Get AI response
//     const aiResponse = await axios.post(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         model: "gpt-3.5-turbo",
//         temperature: 0.3,
//         messages,
//       },
//       {
//         headers: {
//           Authorization: `Bearer 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`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const botMessageText = aiResponse.data?.choices?.[0]?.message?.content?.trim();
//     if (!botMessageText) {
//       return res.status(500).json({ error: "Invalid AI response" });
//     }

//     const botMessage = {
//       role: "assistant",
//       content: botMessageText,
//       createdAt: new Date(),
//     };

//     // Append bot message to chat history
//     chatMessages.push(botMessage);

//     // Format both messages for MongoDB
//     const newFormattedMessages = [userMessage, botMessage].map((m) => ({
//       sender: m.role === "user" ? "user" : "bot",
//       text: m.content,
//       createdAt: m.createdAt,
//     }));

//     // Save the two messages only
//     if (userDoc && existingChat) {
//       existingChat.messages.push(...newFormattedMessages);
//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else if (userDoc) {
//       userDoc.chats.push({
//         id: chatId,
//         name: message.slice(0, 25) + (message.length > 25 ? "..." : ""),
//         messages: newFormattedMessages,
//         isTemp: false,
//         createdAt: new Date(),
//       });
//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else {
//       const newUserChat = new Chat({
//         userEmail,
//         chats: [
//           {
//             id: chatId,
//             name: message.slice(0, 25) + (message.length > 25 ? "..." : ""),
//             messages: newFormattedMessages,
//             isTemp: false,
//             createdAt: new Date(),
//           },
//         ],
//       });
//       await newUserChat.save();
//     }

//     res.json({ response: botMessageText });
//   } catch (error) {
//     console.error("❌ Chat Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });



// router.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Fetch existing chat messages
//     // const userDoc = await Chat.findOne({ userEmail });
//     // let existingChat = null;
//     // let chatMessages = [];

//     // if (userDoc) {
//     //   existingChat = userDoc.chats.find((c) => c.id === chatId);
//     //   if (existingChat) {
//     //     chatMessages = existingChat.messages.map((m) => ({
//     //       role: m.sender === "user" ? "user" : "assistant",
//     //       content: m.text,
//     //       createdAt: m.createdAt || new Date(),
//     //     }));
//     //   }
//     // }
//     let chatMessages = [];
//     const userDoc = await Chat.findOne({ userEmail });
//     const existingChat = userDoc?.chats.find((c) => c.id === chatId);

//     if (existingChat) {
//       chatMessages = existingChat.messages.map((m) => ({
//         role: m.sender === "user" ? "user" : "assistant",
//         content: m.text,
//         createdAt: m.createdAt || new Date(),
//       }));
//     }

//     // Add user message
//     const userMessage = {
//       role: "user",
//       content: message,
//       createdAt: new Date(),
//     };
//     chatMessages.push(userMessage);

//     // Fetch RAG context
//     const webContext = await fetchGoogleSearchSnippets(message);
//     const pdfContext = await fetchRelevantPdfContent(message);

//     let systemPrompt = `You are an expert in Canadian immigration...`;

//     if (webContext || pdfContext) {
//       systemPrompt += "\n\n--- Injected 2025 Context ---\n";
//       if (webContext)
//         systemPrompt += `--- Google 2025 Web Search ---\n${webContext}\n\n`;
//       if (pdfContext)
//         systemPrompt += `--- PDF 2025 Documents ---\n${pdfContext}`;
//     }

//     // Final messages for OpenAI
//     const messages = [
//       { role: "system", content: systemPrompt },
//       ...chatMessages.map(({ role, content }) => ({ role, content })),
//     ];

//     const aiResponse = await axios.post(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         model: "gpt-3.5-turbo",
//         temperature: 0.3,
//         messages,
//       },
//       {
//         headers: {
//           Authorization: `Bearer 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`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const botMessageText =
//       aiResponse.data?.choices?.[0]?.message?.content?.trim();
//     if (!botMessageText) {
//       return res.status(500).json({ error: "Invalid AI response" });
//     }

//     const botMessage = {
//       role: "assistant",
//       content: botMessageText,
//       createdAt: new Date(),
//     };

//     // Push both messages
//     chatMessages.push(botMessage);

//     // Format only the 2 new messages for DB
//     const newFormattedMessages = [userMessage, botMessage].map((m) => ({
//       sender: m.role === "user" ? "user" : "bot",
//       text: m.content,
//       createdAt: m.createdAt,
//     }));

//     // Save only the 2 new messages
//     if (userDoc && existingChat) {
//       existingChat.messages.push(...newFormattedMessages);
//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else if (userDoc) {
//       userDoc.chats.push({
//         id: chatId,
//         name: message.slice(0, 25) + (message.length > 25 ? "..." : ""),
//         messages: newFormattedMessages,
//         isTemp: false,
//         createdAt: new Date(),
//       });
//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else {
//       const newUserChat = new Chat({
//         userEmail,
//         chats: [
//           {
//             id: chatId,
//             name: message.slice(0, 25) + (message.length > 25 ? "..." : ""),
//             messages: newFormattedMessages,
//             isTemp: false,
//             createdAt: new Date(),
//           },
//         ],
//       });
//       await newUserChat.save();
//     }

//     res.json({ response: botMessageText });
//   } catch (error) {
//     console.error("❌ Chat Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// router.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Fetch or initialize chat messages from DB
//     let chatMessages = [];
//     const userDoc = await Chat.findOne({ userEmail });
//     const existingChat = userDoc?.chats.find((c) => c.id === chatId);

//     if (existingChat) {
//       chatMessages = existingChat.messages.map((m) => ({
//         role: m.sender === "user" ? "user" : "assistant",
//         content: m.text,
//         createdAt: m.createdAt || new Date(),
//       }));
//     }

//     // Add new user message
//     const userMessage = {
//       role: "user",
//       content: message,
//       createdAt: new Date(),
//     };
//     chatMessages.push(userMessage);

//     // Fetch RAG contexts
//     const webContext = await fetchGoogleSearchSnippets(message);
//     const pdfContext = await fetchRelevantPdfContent(message);

//     let combinedContext = "";
//     if (webContext) {
//       combinedContext += `--- Google 2025 Web Search ---\n${webContext}\n\n`;
//     }
//     if (pdfContext) {
//       combinedContext += `--- PDF 2025 Documents ---\n${pdfContext}`;
//     }

//     // Build system prompt
//     let systemPrompt = `You are an expert in Canadian immigration, work permits, study guides, and visa rules. Use ONLY reliable, current information from the year 2025. Answer strictly about Canadian immigration-related topics. If the user requests, provide relevant web or YouTube links related to the topic. and also give long details if user want again or some some related topic\n\n`;

//     if (combinedContext.trim()) {
//       systemPrompt += `--- Injected 2025 Context (from Web & PDF) ---\n${combinedContext}\n\n`;
//     }

//     // Prepare messages for OpenAI
//     const messages = [
//       { role: "system", content: systemPrompt },
//       ...chatMessages.map(({ role, content }) => ({ role, content })),
//     ];

//     // Call OpenAI API
//     const aiResponse = await axios.post(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         model: "gpt-3.5-turbo",
//         temperature: 0.3,
//         messages,
//       },
//       {
//         headers: {
//           Authorization: `Bearer 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`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const botMessageText = aiResponse.data?.choices?.[0]?.message?.content?.trim();
//     if (!botMessageText) {
//       return res.status(500).json({ error: "Invalid AI response" });
//     }

//     const botMessage = {
//       role: "assistant",
//       content: botMessageText,
//       createdAt: new Date(),
//     };

//     chatMessages.push(botMessage);

//     // Format messages for DB
//     const formattedMessages = chatMessages.map((m) => ({
//       sender: m.role === "user" ? "user" : "bot",
//       text: m.content,
//       createdAt: m.createdAt || new Date(),
//     }));

//     // Chat title from first user message
//     const firstUserMessage = chatMessages.find((m) => m.role === "user");
//     const title = firstUserMessage?.content
//       ? firstUserMessage.content.trim().slice(0, 25) + (firstUserMessage.content.length > 25 ? "..." : "")
//       : "New Chat";

//     // Save or update chat in DB
//     if (userDoc) {
//       const chatIndex = userDoc.chats.findIndex((c) => c.id === chatId);
//       if (chatIndex !== -1) {
//         // Update existing chat
//         userDoc.chats[chatIndex].messages = formattedMessages;
//         userDoc.chats[chatIndex].name = title;
//       } else {
//         // Add new chat
//         userDoc.chats.push({
//           id: chatId,
//           name: title,
//           messages: formattedMessages,
//           isTemp: false,
//           createdAt: new Date(),
//         });
//       }
//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else {
//       // New user
//       const newUserChat = new Chat({
//         userEmail,
//         chats: [
//           {
//             id: chatId,
//             name: title,
//             messages: formattedMessages,
//             isTemp: false,
//             createdAt: new Date(),
//           },
//         ],
//       });
//       await newUserChat.save();
//     }

//     res.json({ response: botMessageText });
//   } catch (error) {
//     console.error("❌ Chat Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// router.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Ensure chatHistory is initialized
//     if (!chatHistory[chatId]) {
//       const existingUserChat = await Chat.findOne({ userEmail });
//       const existingChat = existingUserChat?.chats.find((c) => c.id === chatId);

//       chatHistory[chatId] = existingChat
//         ? existingChat.messages.map((m) => ({
//             role: m.sender === "user" ? "user" : "assistant",
//             content: m.text,
//           }))
//         : [
//             {
//               role: "system",
//               content:
//                 "You are an expert in Canadian immigration. Use reliable information and stay current. This is year 2025. Give information latest 2025. Always give 2025 latest information. And if user want web links or youtube video link related to topic please give links",
//             },
//           ];
//     }

//     // Add the new user message
//     chatHistory[chatId].push({ role: "user", content: message });

//     // Get fresh RAG context from Google Search
//     const webContext = await fetchGoogleSearchSnippets(message);

//     console.log("🌐 Web Context Fetched:\n", webContext || "❌ No web context found.");

//     // Get 2025 PDF context
//     const pdfContext = await fetchRelevantPdfContent(message);

//     // Combine both RAG sources
//     let combinedContext = "";
//     if (webContext) {
//       combinedContext += `--- Google 2025 Web Search ---\n${webContext}\n\n`;
//     }
//     if (pdfContext) {
//       combinedContext += `--- PDF 2025 Documents ---\n${pdfContext}`;
//     }
//     console.log("📄 Injected System Context:\n", combinedContext);

//     if (combinedContext.trim()) {
//       chatHistory[chatId].push({
//         role: "system",
//         content: `Use the following 2025 context (from web and PDF) to answer strictly with the latest information. Prioritize this context over your own knowledge:\n\n${combinedContext}`,
//       });
//     }

//     // Generate AI response
//     const payload = {
//       model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//       temperature: 0.3,
//       messages: chatHistory[chatId],
//     };

//     const aiResponse = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const botMessage = aiResponse.data?.choices?.[0]?.message?.content?.trim();
//     if (!botMessage)
//       return res.status(500).json({ error: "Invalid AI response" });

//     // Add bot reply to chat history
//     chatHistory[chatId].push({ role: "assistant", content: botMessage });

//     // Prepare cleaned messages for DB
//     const cleanedMessages = chatHistory[chatId].filter(
//       (m) => m.role !== "system"
//     );
//     const formattedMessages = cleanedMessages.map((m) => ({
//       sender: m.role === "user" ? "user" : "bot",
//       text: m.content,
//     }));

//     const firstUserMessage = cleanedMessages.find((m) => m.role === "user");
//     const title = firstUserMessage?.content
//       ? firstUserMessage.content.length > 25
//         ? firstUserMessage.content.slice(0, 25) + "..."
//         : firstUserMessage.content
//       : "New Chat";

//     // Update or insert chat properly
//     let userDoc = await Chat.findOne({ userEmail });

//     if (userDoc) {
//       const chatIndex = userDoc.chats.findIndex((c) => c.id === chatId);

//       if (chatIndex !== -1) {
//         // ✅ Update existing chat
//         userDoc.chats[chatIndex].messages = formattedMessages;
//         userDoc.chats[chatIndex].name = title;
//       } else {
//         // ✅ Add new chat if not found
//         userDoc.chats.push({
//           id: chatId,
//           name: title,
//           messages: formattedMessages,
//           isTemp: false,
//           createdAt: new Date(),
//         });
//       }

//       userDoc.markModified("chats");
//       await userDoc.save();
//     } else {
//       // ✅ First-time user
//       const newUserChat = new Chat({
//         userEmail,
//         chats: [
//           {
//             id: chatId,
//             name: title,
//             messages: formattedMessages,
//             isTemp: false,
//             createdAt: new Date(),
//           },
//         ],
//       });
//       await newUserChat.save();
//     }

//     res.json({ response: botMessage });
//   } catch (error) {
//     console.error("❌ Chat Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

const chatHistoryShared = {};

router.post("/shared/chat", async (req, res) => {
  try {
    const { message, chatId, userEmail } = req.body;

    if (!message || !chatId || !userEmail) {
      return res
        .status(400)
        .json({ error: "Missing message, chatId, or userEmail" });
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

    // Add user message to history
    chatHistoryShared[chatId].push({ role: "user", content: message });

    // Classify message before generating response
    const related = await isRelatedToImmigration(message);
    if (!related) {
      return res.json({
        response:
          "⚠️ Sorry, I can only answer questions related to Canadian immigration, work permits, or studying in Canada.",
      });
    }

    // Call OpenAI GPT-3.5 for answer
    const payload = {
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      messages: chatHistoryShared[chatId],
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer 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`,
          "Content-Type": "application/json",
        },
      }
    );

    const botMessage = response.data?.choices?.[0]?.message?.content?.trim();

    if (!botMessage) {
      return res.status(500).json({ error: "Invalid response from AI" });
    }

    // Add assistant message to history
    chatHistoryShared[chatId].push({ role: "assistant", content: botMessage });

    return res.json({ response: botMessage });
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.response?.data || error.message,
    });
  }
});

// router.post("/shared/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Initialize history if new
//     if (!chatHistoryShared[chatId]) {
//       chatHistoryShared[chatId] = [
//         {
//           role: "system",
//           content:
//             "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
//         },
//       ];
//     }

//     // Add user message
//     chatHistoryShared[chatId].push({ role: "user", content: message });

//     // Optional: check if message is related to immigration
//     const related = await isRelatedToImmigration(message);
//     if (!related) {
//       return res.json({
//         response:
//           "⚠️ Sorry, I can only answer questions about Canadian immigration.",
//       });
//     }

//     // Call AI API
//     const payload = {
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

//     // Add assistant response to in-memory history (for continuity only)
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

// router.post("/chat/chatCountToday", async (req, res) => {
//   const { userEmail } = req.body;

//   const startOfDay = new Date();
//   startOfDay.setHours(0, 0, 0, 0);

//   try {
//     const user = await User.findOne({ email: userEmail }); // <--- Use User, not Chat

//     if (!user) {
//       return res.status(200).json({ count: 0, plan: "Free" }); // default if not found
//     }

//     const userChat = await Chat.findOne({ userEmail });

//     const count = userChat
//       ? userChat.chats.filter((chat) => new Date(chat.createdAt) >= startOfDay)
//           .length
//       : 0;

//     res.json({
//       count,
//       plan: user.plan || "Free", // <-- Correct dynamic plan
//     });
//   } catch (error) {
//     console.error("Error fetching chat count or plan:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

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

    console.log(`User: ${userEmail} - Messages Today: ${messageCountToday}`);

    return res.json({
      count: messageCountToday,
      plan: user.plan || "Free",
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
