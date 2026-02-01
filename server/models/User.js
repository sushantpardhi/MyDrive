const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Role-based storage constants
const ROLE_STORAGE_LIMITS = {
  admin: -1, // Unlimited (represented as -1)
  family: -1, // Unlimited (represented as -1)
  user: 5 * 1024 * 1024 * 1024, // 5GB for registered users
  guest: 500 * 1024 * 1024, // 500MB for temporary guests
  temporaryGuest: 500 * 1024 * 1024, // 500MB for temporary guests (legacy)
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "family", "user", "guest"],
    default: "user",
  },
  createdAt: { type: Date, default: Date.now },
  storageUsed: { type: Number, default: 0 }, // Storage used in bytes
  storageLimit: { type: Number, default: 5 * 1024 * 1024 * 1024 }, // Default 5GB limit in bytes
  lastStorageNotificationLevel: { type: Number, default: 0 }, // Last storage notification threshold sent (0, 50, 75, 90, 100)

  // Guest session fields
  isTemporaryGuest: { type: Boolean, default: false },
  guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "GuestSession" },

  // Admin dashboard preferences
  dashboardPreferences: {
    visibleWidgets: { type: [String], default: null }, // null means show all (default)
    widgetOrder: { type: [mongoose.Schema.Types.Mixed], default: null }, // Stores layout objects {i, x, y, w, h}
  },

  settings: {
    emailNotifications: { type: Boolean, default: true },
    language: { type: String, default: "en" },
    theme: { type: String, default: "light" },
  },
  preferences: {
    viewMode: { type: String, default: "list" },
    itemsPerPage: { type: Number, default: 25 },
  },
});

// Pre-save hook to set storage limit based on role
UserSchema.pre("save", function (next) {
  // Only set storage limit if role has changed or it's a new user
  if (this.isNew || this.isModified("role")) {
    const limit = ROLE_STORAGE_LIMITS[this.role];
    if (limit !== undefined) {
      this.storageLimit = limit;
      logger.info("Storage limit set based on role", {
        userId: this._id,
        role: this.role,
        storageLimit: limit,
      });
    }
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
module.exports.ROLE_STORAGE_LIMITS = ROLE_STORAGE_LIMITS;
