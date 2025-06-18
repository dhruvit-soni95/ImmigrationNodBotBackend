// models/TavilyCache.js
const mongoose = require("mongoose");

const TavilyCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, unique: true },
  result: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Optional: auto-delete entries after 7 days
// TavilyCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model("TavilyCache", TavilyCacheSchema);


// const mongoose = require("mongoose");

// const TavilyCacheSchema = new mongoose.Schema({
//   query: { type: String, required: true, unique: true },
//   result: { type: String, required: true },
//   embedding: { type: [Number], required: true }, // NEW
//   createdAt: { type: Date, default: Date.now },
// });

// // TavilyCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // optional TTL

// module.exports = mongoose.model("TavilyCache", TavilyCacheSchema);
