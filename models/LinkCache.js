const mongoose = require("mongoose");

const RelatedLinkSchema = new mongoose.Schema({
  title: String,
  url: String,
});

const LinkCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, index: true },
  mainUrl: { type: String, required: true },
  related: [RelatedLinkSchema],
  source: { type: String, default: "google" }, // "google" or "cache"
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LinkCache", LinkCacheSchema);
