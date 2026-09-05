const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  doc_type: {
    type: String,
    enum: ["paper", "sop", "tariff", "daily_summary", "reference"],
    required: true,
  },
  title: { type: String, default: null },
  authors: [{ type: String }],
  source_url: { type: String, default: null },
  license: { type: String, default: "unknown" },
  access_basis: {
    type: String,
    enum: ["open_access", "author_postprint", "public_report", "institutional", "unknown"],
    default: "unknown",
  },
  chunk_count: { type: Number, default: 0 },
  ingested_at: { type: Date, default: Date.now },
});

documentSchema.index({ doc_type: 1 });

module.exports = mongoose.model("Document", documentSchema);
