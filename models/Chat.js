// const mongoose = require("mongoose");

// const chatSchema = new mongoose.Schema({
//   chatId: { type: String, required: true },
//   chatName: { type: String },
//   userEmail: { type: String, required: true }, // ✅ add this
// }, { timestamps: true });

// module.exports = mongoose.model("Chat", chatSchema);

// const mongoose = require("mongoose");

// const MessageSchema = new mongoose.Schema({
//   sender: String,
//   text: String,
// });

// const ChatSchema = new mongoose.Schema({
//   id: String, // Chat ID from frontend
//   name: String,
//   userEmail: String,
//   isTemp: Boolean,
//   message: String,
//   messages: [MessageSchema],
// });

// module.exports = mongoose.model("Chat", ChatSchema);


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
});

const userChatSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  chats: [chatSchema],
});

module.exports = mongoose.model("UserChat", userChatSchema);

