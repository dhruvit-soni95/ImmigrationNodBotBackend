const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  answer: { type: String, required: true },
});

const testTopicSchema = new mongoose.Schema({
  topic: { type: String, required: true, enum: ["immigration", "study", "work"] },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TestTopic", testTopicSchema);
