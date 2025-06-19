// utils/tavily.js
const axios = require("axios");
const TavilyCache = require("../models/TavilyCache");

const TAVILY_API_KEY = "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";

function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

// async function getTavilyWebContext(query) {
//   const key = normalizeQuery(query);

//   // ✅ Check MongoDB cache first
//   const existing = await TavilyCache.findOne({ query: key });
//   if (existing) {
//     console.log("⚡ Serving Tavily result from MongoDB cache for:", key);
//     return existing.result;
//   }

//   try {
//     const res = await axios.post("https://api.tavily.com/search", {
//       api_key: TAVILY_API_KEY,
//       query,
//       search_depth: "advanced",
//       max_results: 5,
//     });

//     const formatted = (
//       res.data?.results
//         ?.map((r) => `- ${r.title}: ${r.url}\n${r.content}`)
//         .join("\n\n") || ""
//     );

//     // ✅ Save to MongoDB
//     await TavilyCache.create({ query: key, result: formatted });
//     console.log("✅ Cached new Tavily result to MongoDB:", key);

//     return formatted;
//   } catch (err) {
//     console.error("❌ Tavily fetch failed:", err.message);
//     return null;
//   }
// }
async function getTavilyWebContext(query) {
  const key = normalizeQuery(query);

  // ✅ Use regex to find related cached queries (match any keyword)
  const keywords = key.split(" ").filter(Boolean).join("|"); // e.g., "canada|student|visa"
  const regex = new RegExp(`\\b(${keywords})\\b`, "i");

  const existing = await TavilyCache.findOne({ query: { $regex: regex } });

  if (existing) {
    console.log("⚡ Serving Tavily result from MongoDB fuzzy match:", existing.query);
    return existing.result;
  }

  // 🔍 Fetch from Tavily if no match found
  try {
    const res = await axios.post("https://api.tavily.com/search", {
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 5,
    });

    const formatted = (
      res.data?.results
        ?.map((r) => `- ${r.title}: ${r.url}\n${r.content}`)
        .join("\n\n") || ""
    );

    // ✅ Save to MongoDB cache
    await TavilyCache.create({ query: key, result: formatted });
    console.log("✅ Cached new Tavily result to MongoDB:", key);

    return formatted;
  } catch (err) {
    console.error("❌ Tavily fetch failed:", err.message);
    return null;
  }
}


// 🔍 Debug endpoint helper
async function getCacheEntries() {
  const entries = await TavilyCache.find({}, { query: 1, result: 1 }).sort({ createdAt: -1 });
  return entries.map((entry) => ({
    query: entry.query,
    preview: entry.result.slice(0, 300),
    length: entry.result.length,
  }));
}

// 🧹 Optional: Clear all cache entries
async function clearCache() {
  await TavilyCache.deleteMany({});
  console.log("🧼 Tavily cache cleared from MongoDB.");
}

module.exports = {
  getTavilyWebContext,
  getCacheEntries,
  clearCache,
};
