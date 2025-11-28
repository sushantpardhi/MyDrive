const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  settings: {
    notifications: { type: Boolean, default: true },
    language: { type: String, default: "en" },
  },
  preferences: {
    viewMode: { type: String, default: "list" },
    itemsPerPage: { type: Number, default: 20 },
  },
});

module.exports = mongoose.model("User", UserSchema);
