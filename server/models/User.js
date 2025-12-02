const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  storageUsed: { type: Number, default: 0 }, // Storage used in bytes
  storageLimit: { type: Number, default: 5 * 1024 * 1024 * 1024 }, // Default 5GB limit in bytes
  settings: {
    emailNotifications: { type: Boolean, default: true },
    language: { type: String, default: "en" },
    theme: { type: String, default: "light" },
  },
  preferences: {
    viewMode: { type: String, default: "list" },
    itemsPerPage: { type: Number, default: 20 },
  },
});

module.exports = mongoose.model("User", UserSchema);
