const express = require("express");
const multer = require("multer");
const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");
const { auth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// List documents
router.get("/", async (req, res) => {
  try {
    const { doc_type } = req.query;
    const filter = {};
    if (doc_type) filter.doc_type = doc_type;

    const documents = await Document.find(filter).sort({ ingested_at: -1 });
    res.json({ documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get document stats
router.get("/stats", async (req, res) => {
  try {
    const totalDocs = await Document.countDocuments();
    const totalChunks = await DocumentChunk.countDocuments();
    const byType = await Document.aggregate([
      { $group: { _id: "$doc_type", count: { $sum: 1 }, chunks: { $sum: "$chunk_count" } } },
    ]);

    res.json({
      total_documents: totalDocs,
      total_chunks: totalChunks,
      by_type: byType,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload document (admin only)
router.post("/upload", auth, requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const document = new Document({
      filename: req.file.originalname,
      doc_type: req.body.doc_type || "paper",
      title: req.body.title,
      license: req.body.license || "unknown",
      access_basis: req.body.access_basis || "unknown",
      source_url: req.body.source_url,
    });

    await document.save();

    // Trigger ingestion (would call Python service in production)
    res.status(201).json({
      message: "Document uploaded. Ingestion will be processed asynchronously.",
      document,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search chunks
router.get("/search", async (req, res) => {
  try {
    const { q, doc_type, limit = 10 } = req.query;

    const filter = {};
    if (doc_type) filter.doc_type = doc_type;

    const chunks = await DocumentChunk.find({
      ...filter,
      text: { $regex: q, $options: "i" },
    }).limit(parseInt(limit));

    res.json({ chunks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
