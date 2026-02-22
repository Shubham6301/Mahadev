import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tech: [String],
  link: String,
  description: String
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, required: true },
    bio: { type: String, default: "" },
    skills: [String],
    github: String,
    linkedin: String,
    avatar: String,
    projects: [projectSchema],
    // Additional fields for compatibility
    role: { type: String, default: "user" },
    coins: { type: Number, default: 0 },
    stats: {
      currentStreak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      problemsSolved: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Create indexes for better search performance
userSchema.index({ name: "text", username: "text", skills: "text" });

export default mongoose.model("ShowProfile", userSchema);