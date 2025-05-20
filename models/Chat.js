const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: String,
  text: String,
});

const chatSchema = new mongoose.Schema({
  id: String,
  name: String,
  messages: [messageSchema],
  isTemp: Boolean,
  createdAt: { type: Date, default: Date.now }, // ✅ Add this line
});

const userChatSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  chats: [chatSchema],
});

module.exports = mongoose.model("UserChat", userChatSchema);

