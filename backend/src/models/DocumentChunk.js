const mongoose = require("mongoose");

const documentChunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  embedding: [{ type: Number }],
  doc_type: {
    type: String,
    enum: ["paper", "sop", "tariff", "daily_summary", "reference"],
    required: true,
  },
  source_file: { type: String, required: true },
  section: { type: String, default: null },
  chunk_date: { type: Date, default: null },
  metadata: {
    page: Number,
    table_caption: String,
    license: String,
    source_url: String,
  },
  created_at: { type: Date, default: Date.now },
});

documentChunkSchema.index({ doc_type: 1 });
documentChunkSchema.index({ source_file: 1 });

module.exports = mongoose.model("DocumentChunk", documentChunkSchema, "urjasetu_collection");
