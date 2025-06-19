const express = require("express");
const mongoose = require("mongoose");
const TestTopic = require("../models/test"); // adjust the path if needed

const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const router = express.Router();
const TOGETHER_AI_API_KEY =
  "ccd534e23377572759c4e3e037acd8af56412ae39cca3c80b75d61a5d846092f";
const cheerio = require("cheerio");

const GOOGLE_API_KEY = "abc";
const GOOGLE_CX = "abc";

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Normalize for deduplication
const normalizeUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
};

// // Google search: top 1 deduplicated link
// const fetchFromGoogle = async (queryText, API_KEY, CX) => {
//   const query = encodeURIComponent(queryText);
//   const res = await fetch(
//     `https://www.googleapis.com/customsearch/v1?q=${query}&key=${API_KEY}&cx=${CX}`
//   );
//   const data = await res.json();
//   if (!data.items) return [];

//   const seen = new Set();
//   const filtered = data.items
//     .map((item) => ({ title: item.title, url: item.link }))
//     .filter((item) => {
//       const normalized = normalizeUrl(item.url);
//       if (seen.has(normalized)) return false;
//       seen.add(normalized);
//       return true;
//     });

//   return filtered.slice(0, 1);
// };

// // Extract body text from page
// const scrapeWebpageText = async (url) => {
//   const page = await axios.get(url);
//   const $ = cheerio.load(page.data);
//   $("script, style, noscript").remove();
//   return $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
// };

// // ✅ Main route
// router.post("/api/generate-questions", async (req, res) => {
//   try {
//     const { topic, sourceType, url } = req.body;
//     const API_KEY = GOOGLE_API_KEY;
//     const CX = GOOGLE_CX;
//     // const API_KEY = process.env.GOOGLE_API_KEY;
//     // const CX = process.env.GOOGLE_CX;

//     // Validate topic
//     // const allowedTopics = ["immigration", "canada study permit", "work"];
//     const allowedTopics = [
//       "immigration",
//       "canada study permit",
//       "work",
//       "express entry",
//       "permanent residency",
//       "visitor visa",
//       "post graduate work permit",
//       "lmia",
//       "open work permit",
//       "provincial nominee program",
//       "citizenship",
//       "refugee",
//       "family sponsorship",
//       "spousal sponsorship",
//       "rural and northern immigration pilot",
//       "atlantic immigration program",
//       "startup visa",
//       "super visa",
//     ];

//     if (!allowedTopics.includes(topic)) {
//       return res.status(400).json({ error: "Invalid topic provided" });
//     }

//     let text = "";

//     if (sourceType === "url") {
//       if (!url) return res.status(400).json({ error: "URL is required" });
//       text = await scrapeWebpageText(url);
//     } else if (sourceType === "google") {
//       const results = await fetchFromGoogle(topic, API_KEY, CX);
//       if (!results.length)
//         return res.status(404).json({ error: "No search results found" });

//       text = await scrapeWebpageText(results[0].url);
//     } else {
//       return res.status(400).json({
//         error: "Invalid sourceType (must be 'url' or 'google')",
//       });
//     }

//     const prompt = `
// You are an exam creator. Based on the following text, generate 10 multiple-choice questions.

// Format:
// Each question should be a JSON object like this:
// {
//   "question": "Your question here?",
//   "options": ["Option A", "Option B", "Option C", "Option D"],
//   "answer": "One of the options exactly"
// }

// Requirements:
// - "answer" must match EXACTLY one of the options.
// - Only return the JSON array (no explanation).

// TEXT:
// """${text}"""
// `;

//     const apiRes = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       {
//         model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//         temperature: 0.3,
//         messages: [
//           { role: "system", content: "You generate test questions" },
//           { role: "user", content: prompt },
//         ],
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const content = apiRes.data.choices?.[0]?.message?.content;
//     const match = content.match(/\[\s*{[\s\S]*}\s*\]/);
//     if (!match)
//       throw new Error(
//         "Failed to extract valid JSON array from model response."
//       );

//     const parsedQuestions = JSON.parse(match[0]);

//     const questions = parsedQuestions.map((q, i) => {
//       if (!q.answer && q.correct_answer) q.answer = q.correct_answer;

//       if (
//         !q.question ||
//         !q.options ||
//         !q.answer ||
//         !Array.isArray(q.options) ||
//         !q.options.includes(q.answer)
//       ) {
//         throw new Error(`Invalid question format at index ${i + 1}`);
//       }

//       return {
//         question: q.question.trim(),
//         options: q.options.map((opt) => opt.trim()),
//         answer: q.answer.trim(),
//       };
//     });

//     const doc = await TestTopic.findOneAndUpdate(
//       { topic },
//       { $push: { questions: { $each: questions } } },
//       { upsert: true, new: true }
//     );

//     res.json({ success: true, savedCount: questions.length, doc });
//   } catch (err) {
//     console.error("🚨 Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });






// ✅ Validate question structure
const validateQuestion = (q) => {
  return (
    q &&
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.answer === "string" &&
    q.options.includes(q.answer)
  );
};

// ✅ Google search: top 1 deduplicated link
const fetchFromGoogle = async (queryText, API_KEY, CX) => {
  const query = encodeURIComponent(queryText);
  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?q=${query}&key=${API_KEY}&cx=${CX}`
  );
  const data = await res.json();
  if (!data.items) return [];

  const seen = new Set();
  const filtered = data.items
    .map((item) => ({ title: item.title, url: item.link }))
    .filter((item) => {
      const normalized = normalizeUrl(item.url);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

  return filtered.slice(0, 1);
};

// ✅ Extract body text from page
const scrapeWebpageText = async (url) => {
  const page = await axios.get(url);
  const $ = cheerio.load(page.data);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
};

// ✅ Main route
router.post("/api/generate-questions", async (req, res) => {
  try {
    const { topic, sourceType, url } = req.body;
    const API_KEY = GOOGLE_API_KEY;
    const CX = GOOGLE_CX;

    const allowedTopics = [
      "immigration",
      "canada study permit",
      "work",
      "express entry",
      "permanent residency",
      "visitor visa",
      "post graduate work permit",
      "lmia",
      "open work permit",
      "provincial nominee program",
      "citizenship",
      "refugee",
      "family sponsorship",
      "spousal sponsorship",
      "rural and northern immigration pilot",
      "atlantic immigration program",
      "startup visa",
      "super visa",
    ];

    if (!allowedTopics.includes(topic)) {
      return res.status(400).json({ error: "Invalid topic provided" });
    }

    let text = "";

    if (sourceType === "url") {
      if (!url) return res.status(400).json({ error: "URL is required" });
      text = await scrapeWebpageText(url);
    } else if (sourceType === "google") {
      const results = await fetchFromGoogle(topic, API_KEY, CX);
      if (!results.length)
        return res.status(404).json({ error: "No search results found" });

      text = await scrapeWebpageText(results[0].url);
    } else {
      return res.status(400).json({
        error: "Invalid sourceType (must be 'url' or 'google')",
      });
    }

    const prompt = `
You are an exam creator. Based on the following text, generate 10 multiple-choice questions.

Format:
Each question should be a JSON object like this:
{
  "question": "Your question here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "One of the options exactly"
}

Requirements:
- "answer" must match EXACTLY one of the options.
- Only return the JSON array (no explanation).

TEXT:
"""${text}"""
`;

    const apiRes = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You generate test questions" },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = apiRes.data.choices?.[0]?.message?.content;
    const match = content.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!match)
      throw new Error("Failed to extract valid JSON array from model response.");

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(match[0]);
    } catch (err) {
      throw new Error("Invalid JSON format returned by the model.");
    }

    // ✅ Validate and clean questions
    const questions = parsedQuestions.map((q, i) => {
      if (!q.answer && q.correct_answer) q.answer = q.correct_answer;

      if (!validateQuestion(q)) {
        throw new Error(`Invalid question format at index ${i + 1}`);
      }

      return {
        question: q.question.trim(),
        options: q.options.map((opt) => opt.trim()),
        answer: q.answer.trim(),
      };
    });

    // ✅ Save to DB
    const doc = await TestTopic.findOneAndUpdate(
      { topic },
      { $push: { questions: { $each: questions } } },
      { upsert: true, new: true }
    );

    res.json({ success: true, savedCount: questions.length, doc });
  } catch (err) {
    console.error("🚨 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

















// // 🔥 Main route
// router.post("/api/generate-questions", async (req, res) => {
//   try {
//     const { topic, sourceType, url } = req.body;

//     if (!topic) return res.status(400).json({ error: "Topic is required" });

//     let text = "";

//     // 📄 PDF Source
//     if (sourceType === "pdf") {
//       const pdfPath = path.join(__dirname, "..", "pdfs", `${topic}.pdf`);
//       if (!fs.existsSync(pdfPath)) {
//         return res
//           .status(404)
//           .json({ error: "PDF file not found for this topic" });
//       }
//       const dataBuffer = fs.readFileSync(pdfPath);
//       const parsed = await pdfParse(dataBuffer);
//       text = parsed.text.slice(0, 4000); // LLM token limit safety
//     }

//     // 🌐 Webpage Source
//     else if (sourceType === "url") {
//       if (!url)
//         return res
//           .status(400)
//           .json({ error: "URL is required for web source" });

//       const page = await axios.get(url);
//       const $ = cheerio.load(page.data);

//       // Strip out scripts/styles, get only text
//       $("script, style, noscript").remove();
//       text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
//     }

//     // ❌ No source found
//     else {
//       return res
//         .status(400)
//         .json({ error: "Invalid sourceType (must be 'pdf' or 'url')" });
//     }

//     // 🧠 Prompt for LLM
//     const prompt = `
// You are an exam creator. Based on the following text, generate 10 multiple-choice questions.

// Format:
// Each question should be a JSON object like this:
// {
//   "question": "Your question here?",
//   "options": ["Option A", "Option B", "Option C", "Option D"],
//   "answer": "One of the options exactly"
// }

// Requirements:
// - "answer" must match EXACTLY one of the options.
// - Only return the JSON array (no explanation).

// TEXT:
// """${text}"""
// `;

//     // 🔗 Call Together AI
//     const apiRes = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       {
//         model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//         temperature: 0.3,
//         messages: [
//           { role: "system", content: "You generate test questions" },
//           { role: "user", content: prompt },
//         ],
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.TOGETHER_AI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const content = apiRes.data.choices?.[0]?.message?.content;
//     const match = content.match(/\[\s*{[\s\S]*}\s*\]/);
//     if (!match)
//       throw new Error(
//         "Failed to extract valid JSON array from model response."
//       );

//     const parsedQuestions = JSON.parse(match[0]);

//     const questions = parsedQuestions.map((q, i) => {
//       if (!q.answer && q.correct_answer) {
//         q.answer = q.correct_answer;
//       }

//       if (
//         !q.question ||
//         !q.options ||
//         !q.answer ||
//         !q.options.includes(q.answer)
//       ) {
//         throw new Error(
//           `Invalid or missing answer/options in question ${i + 1}`
//         );
//       }

//       return {
//         question: q.question.trim(),
//         options: q.options.map((opt) => opt.trim()),
//         answer: q.answer.trim(),
//       };
//     });

//     const doc = await TestTopic.findOneAndUpdate(
//       { topic },
//       { $push: { questions: { $each: questions } } },
//       { upsert: true, new: true }
//     );

//     res.json({ success: true, savedCount: questions.length, doc });
//   } catch (err) {
//     console.error("🚨 Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get("/api/add-testdata", async (req, res) => {
// router.post("/api/generate-questions", async (req, res) => {
//   console.log("aaaaaaaaaaaaa");
//   try {
//     const topic = req.body.topic;
//     if (!topic) return res.status(400).json({ error: "Topic is required" });

//     // 👇 Set your local PDF path based on the topic
//     const pdfPath = `./pdfs/${topic}.pdf`;
//     if (!fs.existsSync(pdfPath)) {
//       console.log("PDF not found: ");
//       return res
//         .status(404)
//         .json({ error: "PDF file not found for this topic" });
//     }

//     const dataBuffer = fs.readFileSync(pdfPath);
//     const parsed = await pdfParse(dataBuffer);
//     const text = parsed.text.slice(0, 4000); // limit token length

//     // const prompt = `You are an exam creator. Based on the text below, generate 10 multiple-choice questions (4 options each, with correct answer). Return JSON array:\n\nTEXT:\n"""${text}"""`;

//     const prompt = `
// You are an exam creator. Based on the following text, generate 10 multiple-choice questions.

// Format:
// Each question should be a JSON object like this:
// {
//   "question": "Your question here?",
//   "options": ["Option A", "Option B", "Option C", "Option D"],
//   "answer": "One of the options exactly"
// }

// Requirements:
// - "answer" must match EXACTLY one of the options.
// - Only return the JSON array (no explanation).

// TEXT:
// """${text}"""
// `;

//     const apiRes = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       {
//         model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//         temperature: 0.3,
//         messages: [
//           { role: "system", content: "You generate test questions" },
//           { role: "user", content: prompt },
//         ],
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.TOGETHER_AI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const content = apiRes.data.choices?.[0]?.message?.content;
//     // const questions = JSON.parse(content);
//     const match = content.match(/\[\s*{[\s\S]*}\s*\]/); // matches JSON array
//     if (!match) {
//       throw new Error(
//         "Failed to extract valid JSON array from model response."
//       );
//     }
//     // const questions = JSON.parse(match[0]);
//     const parsedQuestions = JSON.parse(match[0]);

//     const questions = parsedQuestions.map((q) => {
//       if (!q.answer && q.correct_answer) {
//         q.answer = q.correct_answer;
//       }
//       if (!q.answer || !q.options?.includes(q.answer)) {
//         throw new Error("Invalid or missing answer in one or more questions");
//       }
//       return {
//         question: q.question,
//         options: q.options,
//         answer: q.answer,
//       };
//     });

//     const doc = await TestTopic.findOneAndUpdate(
//       { topic },
//       { $push: { questions: { $each: questions } } },
//       { upsert: true, new: true }
//     );

//     res.json({ success: true, savedCount: questions.length, doc });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// const upload = multer({ dest: "uploads/" });

// mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// router.post("/api/generate-questions", upload.single("file"), async (req, res) => {
//   try {
//     const topic = req.body.topic;
//     if (!req.file || !topic) return res.status(400).json({ error: "File and topic required" });

//     const dataBuffer = require("fs").readFileSync(req.file.path);
//     const parsed = await pdfParse(dataBuffer);
//     const text = parsed.text.slice(0, 4000); // limit token length

//     const prompt = `You are an exam creator. Based on the text below, generate 10 multiple-choice questions (4 options each, with correct answer). Return JSON array:\n\nTEXT:\n"""${text}"""`;

//     const apiRes = await axios.post(
//       "https://api.together.xyz/v1/chat/completions",
//       {
//         model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
//         temperature: 0.3,
//         messages: [
//           { role: "system", content: "You generate test questions" },
//           { role: "user", content: prompt },
//         ],
//       },
//       { headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_API_KEY}` } }
//     );

//     const content = apiRes.data.choices?.[0]?.message?.content;
//     const questions = JSON.parse(content);

//     const doc = await TestTopic.findOneAndUpdate(
//       { topic },
//       { $push: { questions: { $each: questions } } },
//       { upsert: true, new: true }
//     );

//     res.json({ success: true, savedCount: questions.length, doc });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// Your static testData
const testData = {
  immigration: [
    {
      question: "What is the capital of Canada?",
      options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
      answer: "Ottawa",
    },
    {
      question: "What year did Canada become a country?",
      options: ["1867", "1905", "1492", "1776"],
      answer: "1867",
    },
  ],
  study: [
    {
      question: "What is a study permit?",
      options: [
        "A visa to work in Canada",
        "A permit to study at a DLI in Canada",
        "A tourist visa",
        "None of the above",
      ],
      answer: "A permit to study at a DLI in Canada",
    },
    {
      question: "Can you work while studying?",
      options: [
        "No",
        "Yes, up to 20 hours/week",
        "Yes, full-time",
        "Only off-campus",
      ],
      answer: "Yes, up to 20 hours/week",
    },
  ],
  work: [
    {
      question: "What is a work permit?",
      options: [
        "A permanent residency card",
        "A document allowing employment in Canada",
        "Student visa",
        "Travel document",
      ],
      answer: "A document allowing employment in Canada",
    },
  ],
};

// ✅ Route to insert the test data
router.get("/api/add-testdata", async (req, res) => {
  try {
    // Optional: clear existing topics
    await TestTopic.deleteMany({});

    // Convert testData object into array of documents
    const entries = Object.entries(testData).map(([topic, questions]) => ({
      topic,
      questions,
    }));

    // Insert into DB
    await TestTopic.insertMany(entries);

    res.json({ message: "Test data successfully added to DB ✅" });
  } catch (err) {
    console.error("Error inserting test data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/api/testdata", async (req, res) => {
  try {
    const topics = await TestTopic.find({});
    const formatted = {};

    topics.forEach((topic) => {
      formatted[topic.topic] = topic.questions;
    });

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching test data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
