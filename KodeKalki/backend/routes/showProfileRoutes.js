import express from "express";
import User from "../models/User.js";  // Using existing User model

const router = express.Router();

// GET /api/profiles/search?q=shubham
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { "profile.bio": { $regex: q, $options: "i" } },
        { "profile.skills": { $regex: q, $options: "i" } }
      ]
    })
      .select("name username profile stats")
      .limit(20);

    // Format the response
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      username: user.username,
      avatar: user.profile?.avatar,
      skills: user.profile?.skills || [],
      bio: user.profile?.bio || ""
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
};

// GET /api/profiles/:username
export const getUserProfile = async (req, res) => {
  try {
    const username = req.params.username;

    const user = await User.findOne({ username }).select(
      "name username email profile stats createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Format the response to match frontend expectations
    const formattedProfile = {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      bio: user.profile?.bio || "",
      skills: user.profile?.skills || [],
      github: user.profile?.github || "",
      linkedin: user.profile?.linkedin || "",
      avatar: user.profile?.avatar || "",
      projects: user.profile?.projects || [],
      createdAt: user.createdAt,
      stats: {
        problemsSolved: user.stats?.problemsSolved || 0,
        currentStreak: user.stats?.currentStreak || 0,
        longestStreak: user.stats?.longestStreak || 0
      }
    };

    res.json(formattedProfile);
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ message: "Profile fetch failed" });
  }
};

router.get("/search", searchUsers);
router.get("/:username", getUserProfile);

export default router;