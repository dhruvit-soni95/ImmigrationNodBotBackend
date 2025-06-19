// const mongoose = require("mongoose");

// const questionSchema = new mongoose.Schema({
//   question: { type: String, required: true },
//   options: { type: [String], required: true },
//   answer: { type: String, required: true },
// });

// const testTopicSchema = new mongoose.Schema({
//   topic: { type: String, required: true, enum: ["immigration", "canada study permit", "work"] },
//   questions: [questionSchema],
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("TestTopic", testTopicSchema);

const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  answer: { type: String, required: true },
});

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
  "super visa"
];

const testTopicSchema = new mongoose.Schema({
  topic: { type: String, required: true, enum: allowedTopics },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TestTopic", testTopicSchema);
