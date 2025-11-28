const express = require("express");
const User = require("../models/User");

const router = express.Router();

// User Profile Routes
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const { name, settings, preferences } = req.body;
    const update = {};
    if (name) update.name = name;
    if (settings) update.settings = settings;
    if (preferences) update.preferences = preferences;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users by email or name
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Query must be at least 2 characters" });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.id } }, // Exclude current user
        {
          $or: [
            { email: new RegExp(query, "i") },
            { name: new RegExp(query, "i") },
          ],
        },
      ],
    })
      .select("name email")
      .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
