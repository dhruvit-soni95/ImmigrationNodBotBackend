const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();
require("dotenv").config();

const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const Chat = require("./models/Chat"); // ⬅️ MongoDB model

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

const TOGETHER_AI_API_KEY = process.env.TOGETHER_AI_API_KEY;

// Store conversation history per chatId
const chatHistory = {};

async function isRelatedToImmigration(userMessage) {
  try {
    const payload = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a classifier. Reply with 'related' if the question is about Canadian immigration. Otherwise, reply with 'unrelated'.",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 5,
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
    console.log("🔍 Classification Result:", classification);

    return classification.includes("related");
  } catch (error) {
    console.error(
      "❌ Classification Error:",
      error.response?.data || error.message
    );
    return true; // Default to true if classification fails
  }
}

// Routes
app.use("/api/auth", authRoutes);

// 🧠 Chat route
// app.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Load or create chat history for chatId
//     if (!chatHistory[chatId]) {
//       // Try loading from DB first
//       const existingUser = await Chat.findOne({ userEmail });
//       const existingChat = existingUser?.chats?.find((c) => c.id === chatId);

//       if (existingChat) {
//         chatHistory[chatId] = existingChat.messages.map((m) => ({
//           role: m.sender === "user" ? "user" : "assistant",
//           content: m.text,
//         }));
//       } else {
//         // No existing chat, initialize
//         chatHistory[chatId] = [
//           {
//             role: "system",
//             content:
//               "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
//           },
//         ];

//         // Relevance check only for new chat
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

//     // Prepare AI request
//     const payload = {
//       model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//       temperature: 0.3,
//       messages: chatHistory[chatId],
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
//       throw new Error("Invalid API response from Together AI");
//     }

//     // Add bot response to history
//     chatHistory[chatId].push({ role: "assistant", content: botMessage });

//     // Remove system message before saving
//     const cleanedMessages = chatHistory[chatId].filter(
//       (m) => m.role !== "system"
//     );

//     const formattedChat = {
//       id: chatId,
//       name: `Chat ${new Date().toLocaleString()}`, // You can customize the title
//       messages: cleanedMessages.map((m) => ({
//         sender: m.role === "user" ? "user" : "bot",
//         text: m.content,
//       })),
//     };

//     // Save to DB
//     const existingUser = await Chat.findOne({ userEmail });

//     if (existingUser) {
//       // Remove old chat with same ID if it exists
//       existingUser.chats = existingUser.chats.filter((c) => c.id !== chatId);
//       existingUser.chats.push(formattedChat);
//       await existingUser.save();
//     } else {
//       // Create new user document
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

app.post("/chat", async (req, res) => {
  try {
    const { message, chatId, userEmail } = req.body;

    if (!message || !chatId || !userEmail) {
      return res
        .status(400)
        .json({ error: "Missing message, chatId, or userEmail" });
    }

    // Load history from DB if chatId not seen before
    if (!chatHistory[chatId]) {
      const existingUser = await Chat.findOne({ userEmail });
      const existingChat = existingUser?.chats?.find((c) => c.id === chatId);

      if (existingChat) {
        chatHistory[chatId] = existingChat.messages.map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));
      } else {
        chatHistory[chatId] = [
          {
            role: "system",
            content:
              "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
          },
        ];

        // Run immigration topic check only for new chats
        const related = await isRelatedToImmigration(message);
        if (!related) {
          return res.json({
            response:
              "⚠️ Sorry, I can only answer questions about Canadian immigration.",
          });
        }
      }
    }

    // Add user message
    chatHistory[chatId].push({ role: "user", content: message });

    // AI response
    const payload = {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      temperature: 0.3,
      messages: chatHistory[chatId],
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
      throw new Error("Invalid API response from Together AI");
    }

    // Add bot reply
    chatHistory[chatId].push({ role: "assistant", content: botMessage });

    // Prepare messages for saving (skip system)
    const cleanedMessages = chatHistory[chatId].filter(
      (m) => m.role !== "system"
    );

    const hasUserMessage = cleanedMessages.some((m) => m.role === "user");
    const justDefaultResponse =
      cleanedMessages.length === 1 &&
      cleanedMessages[0].role === "assistant";

    if (!hasUserMessage || justDefaultResponse) {
      return res.json({ response: botMessage });
    }

    // 💡 Generate title from first user message
    const firstUserMessage = cleanedMessages.find((m) => m.role === "user");
    let title = "New Chat";
    if (firstUserMessage?.content) {
      title =
        firstUserMessage.content.length > 25
          ? firstUserMessage.content.slice(0, 25) + "..."
          : firstUserMessage.content;
    }

    // Prepare chat object
    const formattedChat = {
      id: chatId,
      name: title,
      messages: cleanedMessages.map((m) => ({
        sender: m.role === "user" ? "user" : "bot",
        text: m.content,
      })),
    };

    // Save to DB
    const existingUser = await Chat.findOne({ userEmail });

    if (existingUser) {
      existingUser.chats = existingUser.chats.filter((c) => c.id !== chatId);
      existingUser.chats.push(formattedChat);
      await existingUser.save();
    } else {
      const newChat = new Chat({
        userEmail,
        chats: [formattedChat],
      });
      await newChat.save();
    }

    res.json({ response: botMessage });
  } catch (error) {
    console.error("❌ Chat Error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.response?.data || error.message,
    });
  }
});


// app.post("/chat", async (req, res) => {
//   try {
//     const { message, chatId, userEmail } = req.body;

//     if (!message || !chatId || !userEmail) {
//       return res
//         .status(400)
//         .json({ error: "Missing message, chatId, or userEmail" });
//     }

//     // Initialize chat history if it's a new chat
//     // if (!chatHistory[chatId]) {
//     //   chatHistory[chatId] = [
//     //     {
//     //       role: "system",
//     //       content:
//     //         "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
//     //     },
//     //   ];

//     //   // Check relevance to Canadian immigration only once per new chat
//     //   const related = await isRelatedToImmigration(message);
//     //   if (!related) {
//     //     return res.json({
//     //       response:
//     //         "⚠️ Sorry, I can only answer questions about Canadian immigration.",
//     //     });
//     //   }
//     // }

//     if (!chatHistory[chatId]) {
//       // Try loading from DB first
//       const existingUser = await Chat.findOne({ userEmail });
//       const existingChat = existingUser?.chats?.find((c) => c.id === chatId);
    
//       if (existingChat) {
//         chatHistory[chatId] = existingChat.messages.map((m) => ({
//           role: m.sender === "user" ? "user" : "assistant",
//           content: m.text,
//         }));
//       } else {
//         // If no DB chat found, start a new one
//         chatHistory[chatId] = [
//           {
//             role: "system",
//             content:
//               "You are an expert in Canadian immigration. Only answer questions about Canadian immigration.",
//           },
//         ];
    
//         // Do relevance check only once for new chats
//         const related = await isRelatedToImmigration(message);
//         if (!related) {
//           return res.json({
//             response:
//               "⚠️ Sorry, I can only answer questions about Canadian immigration.",
//           });
//         }
//       }
//     }
    

//     // Add user's message to the chat history
//     chatHistory[chatId].push({ role: "user", content: message });

//     // Prepare the payload for the Llama 3.3 model
//     const payload = {
//       model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//       temperature: 0.3,
//       messages: chatHistory[chatId],
//     };

//     // Send request to Together AI
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
//       throw new Error("Invalid API response from Together AI");
//     }

//     // Add bot's reply to the history
//     chatHistory[chatId].push({ role: "assistant", content: botMessage });

//     // Prepare messages to save (excluding system message)
//     const cleanedMessages = chatHistory[chatId].filter(
//       (m) => m.role !== "system"
//     );

//     const hasRealUserMessage = cleanedMessages.some(
//       (m) => m.role === "user"
//     );

//     const chatNameIsTemp =
//       cleanedMessages.length === 1 &&
//       cleanedMessages[0].role === "assistant";

//     // Skip saving chats with only system/default responses
//     if (!hasRealUserMessage || chatNameIsTemp) {
//       return res.json({ response: botMessage });
//     }

//     // Save to DB
//     const existingUser = await Chat.findOne({ userEmail });

//     const formattedChat = {
//       id: chatId,
//       name: "Chat from server",
//       messages: cleanedMessages.map((m) => ({
//         sender: m.role === "user" ? "user" : "bot",
//         text: m.content,
//       })),
//     };

//     if (existingUser) {
//       // Remove old version of the chat with same ID
//       existingUser.chats = existingUser.chats.filter((c) => c.id !== chatId);
//       // Add updated chat
//       existingUser.chats.push(formattedChat);
//       await existingUser.save();
//     } else {
//       // Create new user chat document
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


// 🔁 Reset chat
app.post("/new-chat", (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: "Chat ID is required" });

  chatHistory[chatId] = []; // Reset chat history
  res.json({ message: "New chat created", chatId });
});

// 📦 Save chat to DB
// 📦 Save or update a single chat inside a user's chat list
// app.post("/api/chats", async (req, res) => {
//   try {
//     const { userEmail, chat } = req.body;
//     if (!userEmail || !chat)
//       return res.status(400).json({ error: "Missing data" });

//     // 🔥 Remove system messages before saving
//     const filteredMessages = chat.messages.filter(
//       (msg) => msg.sender !== "system"
//     );

//     const cleanedChat = {
//       ...chat,
//       messages: filteredMessages,
//     };

//     const existingUser = await Chat.findOne({ userEmail });

//     if (existingUser) {
//       const chatIndex = existingUser.chats.findIndex((c) => c.id === chat.id);
//       if (chatIndex !== -1) {
//         // update the existing chat
//         existingUser.chats[chatIndex] = cleanedChat;
//       } else {
//         // add new chat
//         existingUser.chats.push(cleanedChat);
//       }
//       await existingUser.save();
//     } else {
//       // first chat for this user
//       const newChat = new Chat({
//         userEmail,
//         chats: [cleanedChat],
//       });
//       await newChat.save();
//     }

//     res.json({ message: "✅ Chat saved successfully" });
//   } catch (err) {
//     console.error("❌ Save Chat Error:", err);
//     res.status(500).json({ error: "Failed to save chat" });
//   }
// });

// 📥 Get all chats
app.get("/api/chats/:userEmail", async (req, res) => {
  try {
    const userEmail = req.params.userEmail;
    const userChats = await Chat.findOne({ userEmail });
    res.json(userChats?.chats || []);
  } catch (err) {
    console.error("❌ Get Chats Error:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// const express = require("express");
// const axios = require("axios");
// const cors = require("cors");
// const app = express();
// const connectDB = require("./db");
// const authRoutes = require("./routes/auth");
// require("dotenv").config();

// // Connect to MongoDB
// connectDB();

// app.use(cors());
// app.use(express.json());

// const TOGETHER_AI_API_KEY = "4987ed2d3a1313e9e83a5978987bbdb0fcd8a53d8692d082b33e88b986a2d091";

// // Store conversation history per chatId
// const chatHistory = {};

// // const Chat = require("../models/Chat");
// // const Message = require("../models/Message");

// async function isRelatedToImmigration(userMessage) {
//     try {
//         const payload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             messages: [
//                 { role: "system", content: "You are a classifier. Reply with 'related' if the question is about Canadian immigration. Otherwise, reply with 'unrelated'." },
//                 { role: "user", content: userMessage }
//             ],
//             max_tokens: 5
//         };

//         const response = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             payload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         const classification = response.data.choices[0]?.message?.content.trim().toLowerCase();
//         console.log("🔍 Classification Result:", classification);

//         return classification.includes("related");
//     } catch (error) {
//         console.error("❌ Classification Error:", error.response?.data || error.message);
//         return true; // Default to true if classification fails
//     }
// }

// // Routes
// app.use("/api/auth", authRoutes);

// app.post("/chat", async (req, res) => {
//     try {
//         const { message, chatId } = req.body;
//         if (!message) {
//             return res.status(400).json({ error: "Message is required" });
//         }

//         // Ensure each chat session has its own history

//         if (!chatHistory[chatId]) {
//             chatHistory[chatId] = [
//                 { role: "system", content: "You are an expert in Canadian immigration. Only answer questions about Canadian immigration." }
//             ];

//             const related = await isRelatedToImmigration(message);
//             if (!related) {
//                 return res.json({ response: "⚠️ Sorry, I can only answer questions about Canadian immigration." });
//             }
//         }

//         // Add user message to its specific chat history
//         chatHistory[chatId].push({ role: "user", content: message });

//         // AI response using only the chat's history
//         const payload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             temperature: 0.3,  // Keeps answers factual
//             messages: chatHistory[chatId]
//         };

//         const response = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             payload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         if (!response.data.choices || !response.data.choices[0]?.message?.content) {
//             throw new Error("Invalid API response format");
//         }

//         const botMessage = response.data.choices[0].message.content.trim();

//         // Store bot response in the same chat history
//         chatHistory[chatId].push({ role: "assistant", content: botMessage });

//         res.json({ response: botMessage });

//     } catch (error) {
//         console.error("❌ API Error:", error.response?.data || error.message);
//         res.status(500).json({
//             error: "Internal Server Error",
//             details: error.response?.data || error.message
//         });
//     }
// });

// // Reset chat history when creating a new chat
// app.post("/new-chat", (req, res) => {
//     const { chatId } = req.body;
//     if (!chatId) return res.status(400).json({ error: "Chat ID is required" });

//     chatHistory[chatId] = []; // Reset the chat history
//     res.json({ message: "New chat created", chatId });
// });

// const PORT = 5000;
// app.listen(PORT, () => {
//     console.log(`🚀 Server running on port ${PORT}`);
// });

// const express = require("express");
// const axios = require("axios");
// const cors = require("cors");
// const app = express();

// app.use(cors());
// app.use(express.json());

// const TOGETHER_AI_API_KEY = "4987ed2d3a1313e9e83a5978987bbdb0fcd8a53d8692d082b33e88b986a2d091";

// // Function to determine if the message is about immigration
// async function isRelatedToImmigration(userMessage) {
//     try {
//         const payload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             messages: [
//                 { role: "system", content: "You are a classifier. Reply with 'related' if the question is about Canadian immigration. Otherwise, reply with 'unrelated'." },
//                 { role: "user", content: userMessage }
//             ],
//             max_tokens: 5
//         };

//         const response = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             payload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         const classification = response.data.choices[0]?.message?.content.trim().toLowerCase();
//         console.log("🔍 Classification Result:", classification); // Debugging log

//         return classification.includes("related");
//     } catch (error) {
//         console.error("❌ Classification Error:", error.response?.data || error.message);
//         return true; // Default to true if classification fails
//     }
// }

// app.post("/chat", async (req, res) => {
//     try {
//         const userMessage = req.body.message;
//         if (!userMessage) {
//             return res.status(400).json({ error: "Message is required" });
//         }

//         const related = await isRelatedToImmigration(userMessage);
//         if (!related) {
//             return res.json({
//                 response: "⚠️ Sorry, I can only answer questions about Canadian immigration."
//             });
//         }

//         // Stronger system prompt to improve response relevance
//         const payload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             temperature: 0.3,  // Reduces randomness for more factual answers
//             messages: [
//                 { role: "system", content: "You are an expert in Canadian immigration. You only answer questions about Canadian immigration and legal pathways. You do NOT answer questions about other countries, unrelated topics, or personal opinions." },
//                 { role: "user", content: userMessage }
//             ]
//         };

//         const response = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             payload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         if (!response.data.choices || !response.data.choices[0]?.message?.content) {
//             throw new Error("Invalid API response format");
//         }

//         const botMessage = response.data.choices[0].message.content.trim();
//         res.json({ response: botMessage });

//     } catch (error) {
//         console.error("❌ API Error:", error.response?.data || error.message);
//         res.status(500).json({
//             error: "Internal Server Error",
//             details: error.response?.data || error.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => {
//     console.log(`🚀 Server running on port ${PORT}`);
// });

// const express = require("express");
// const axios = require("axios");
// const cors = require("cors");  // Import CORS
// const app = express();

// // ✅ Enable CORS for all routes
// app.use(cors());  // This allows requests from all origins (default setting)

// app.use(express.json());

// const TOGETHER_AI_API_KEY = "4987ed2d3a1313e9e83a5978987bbdb0fcd8a53d8692d082b33e88b986a2d091";

// // Function to check if the question is related to immigration
// // function isRelatedToImmigration(userMessage) {
// //     const keywords = [
// //         "visa", "immigration", "Canada PR", "permanent residency", "work permit",
// //         "express entry", "PNP", "study permit", "citizenship", "refugee",
// //         "visitor visa", "family sponsorship", "LMIA", "PGWP", "spouse visa",
// //         "IELTS", "biometrics", "passport", "travel history", "NOC code",
// //         "express entry", "Federal Skill",
// //     ];

// //     return keywords.some(keyword => userMessage.toLowerCase().includes(keyword));
// // }
// function isRelatedToImmigration(userMessage) {
//     const keywords = [
//         "visa", "immigration", "canada pr", "permanent residency", "work permit",
//         "express entry", "pnp", "study permit", "citizenship", "refugee",
//         "visitor visa", "family sponsorship", "lmia", "pgwp", "spouse visa",
//         "ielts", "biometrics", "passport", "travel history", "noc code",
//         "federal skill", "key differences in eligibility criteria", "provincial nominee program",
//         "immigration programs", "canadian experience", "clb", "canadian language benchmark",
//         "noc", "national occupation classification", "teer", "training, education, experience and responsibilities",
//         "job offer in canada", "amount of work", "education in canada", "express entry system",
//         "family sponsorship", "permanent residence portal", "spouses or partners experiencing abuse or violence",
//         "start up visa","start-up visa", "immigrant entrepreneurs", "businesses in Canada", "atlantic immigration program",
//         "atlantic provinces", "rural and northern immigration pilot", "rural immigration pilot", "northern immigration pilot",
//         "rnip", "ircc eligibility requirements", "agri food pilot", "agri-food pilot", "canadian agriculture", "immigrate permanently",
//         "immigrate", "federal and provincial", "provincial and territorial immigration programs", "provincial immigration programs",
//         "territorial immigration programs", "ainp", "alberta immigrant nominee program", "economic immigration",
//         "alberta advantage immigration program", "aaip", "tourism and hospitality stream", "alberta opportunity stream",
//         "alberta express entry stream", "rural renewal stream", "rural entrepreneur stream", "graduate entrepreneur stream",
//         "farm stream", "foreign graduate entrepreneur stream", "british columbia provincial nominee program", "bc pnp", "bcpnp",
//         "bc provincial nominee", "immigrating to bc", "ei regional stream communities", "mpnp", "manitoba provincial nominee program",
//         "nbpnp", "new brunswick provincial nominee", "nlpnp", "newfoundland and labrador provincial nominee", "newfoundland provincial nominee",
//         "labrador provincial nominee", "ntnp", "northwest territories nominee", "nsnp", "nova scotia nominee", "oinp",
//         "ontario immigrant nominee", "pei pnp", "peipnp", "prince edward island provincial nominee"
//     ];

//     const lowerMessage = userMessage.toLowerCase(); // Convert input to lowercase

//     return keywords.some(keyword => lowerMessage.includes(keyword));
// }

// app.post("/chat", async (req, res) => {
//     try {
//         const userMessage = req.body.message;
//         if (!userMessage) {
//             return res.status(400).json({ error: "Message is required" });
//         }

//         // If the question is unrelated, return a predefined message
//         if (!isRelatedToImmigration(userMessage)) {
//             return res.json({
//                 response: "⚠️ Sorry, I can only answer questions about Canadian immigration."
//             });
//         }

//         // Proceed to call AI API for relevant questions
//         const payload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             messages: [
//                 { role: "system", content: "You are an expert on Canadian immigration." },
//                 { role: "user", content: userMessage }
//             ]
//         };

//         const response = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             payload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         if (!response.data.choices || !response.data.choices[0]?.message?.content) {
//             throw new Error("Invalid API response format");
//         }

//         // Extract bot response safely
//         const botMessage = response.data.choices[0].message.content.trim();
//         res.json({ response: botMessage });

//     } catch (error) {
//         console.error("❌ API Error:", error.response?.data || error.message);
//         res.status(500).json({
//             error: "Internal Server Error",
//             details: error.response?.data || error.message
//         });
//     }
// });

// const PORT = 5000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

// const express = require("express");
// const cors = require("cors");
// const axios = require("axios");

// const app = express();
// const PORT = 5000;
// const TOGETHER_AI_API_KEY = "your_api_key_here";

// app.use(cors());
// app.use(express.json());

// app.post("/chat", async (req, res) => {
//     try {
//         const userMessage = req.body.message;
//         if (!userMessage) {
//             return res.status(400).send("Message is required");
//         }

//         // Step 1: Determine if the question is related to Canadian immigration
//         const categoryCheckPayload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             messages: [
//                 { role: "system", content: "Determine if the user's message is related to Canadian immigration. Respond with 'yes' or 'no' only." },
//                 { role: "user", content: userMessage }
//             ]
//         };

//         const categoryResponse = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             categoryCheckPayload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         const isRelated = categoryResponse.data.choices[0].message.content.toLowerCase().includes("yes");

//         // Step 2: If unrelated, send a polite rejection message
//         if (!isRelated) {
//             return res.send("⚠️ Sorry, I can only assist with Canadian immigration-related questions. Please ask about visas, work permits, study permits, or residency in Canada.");
//         }

//         // Step 3: Generate AI response for relevant questions (Streaming response)
//         const chatPayload = {
//             model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//             messages: [
//                 { role: "system", content: "You are a professional Canadian immigration consultant. Answer queries like ChatGPT in a conversational, professional tone, sentence-by-sentence." },
//                 { role: "user", content: userMessage }
//             ],
//             stream: true // Enable streaming response
//         };

//         const aiResponse = await axios.post(
//             "https://api.together.xyz/v1/chat/completions",
//             chatPayload,
//             {
//                 headers: {
//                     "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
//                     "Content-Type": "application/json"
//                 },
//                 responseType: "stream" // Stream the response
//             }
//         );

//         res.setHeader("Content-Type", "text/event-stream");
//         res.setHeader("Cache-Control", "no-cache");
//         res.setHeader("Connection", "keep-alive");

//         aiResponse.data.on("data", (chunk) => {
//             res.write(chunk.toString()); // Send raw response without JSON wrapping
//         });

//         aiResponse.data.on("end", () => {
//             res.end();
//         });
//     } catch (error) {
//         console.error("❌ API Error:", error.response?.data || error.message);
//         res.status(500).send("Internal Server Error");
//     }
// });

// app.listen(PORT, () => {
//     console.log(`✅ Server is running on http://localhost:${PORT}`);
// });
