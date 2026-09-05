const mongoose = require("mongoose");

const chatSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  turns: [{
    question: { type: String, required: true },
    answer: { type: String, required: true },
    retrieved_chunks: [{
      chunk_id: mongoose.Schema.Types.ObjectId,
      text: String,
      source_file: String,
      section: String,
      grade: Boolean,
      score: Number,
    }],
    corrective_action: { type: String, default: null },
    citations: [{ type: String }],
    live_data_used: { type: Boolean, default: false },
    retries: { type: Number, default: 0 },
    web_search_used: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

chatSessionSchema.index({ session_id: 1 });
chatSessionSchema.index({ user_id: 1 });

module.exports = mongoose.model("ChatSession", chatSessionSchema);
