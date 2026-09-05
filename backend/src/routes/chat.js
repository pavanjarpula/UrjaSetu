const express = require("express");
const { v4: uuidv4 } = require("uuid");
const ChatSession = require("../models/ChatSession");
const DocumentChunk = require("../models/DocumentChunk");
const ForecastDaily = require("../models/ForecastDaily");
const TesRun = require("../models/TesRun");
const { validateChat } = require("../middleware/validation");
const { auth } = require("../middleware/auth");
const { generateAnswer, gradeRelevance, rewriteQuery } = require("../services/llmProvider");
const axios = require("axios");

const router = express.Router();
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

// Embed query via Python ML service (sentence-transformers)
async function embedQuery(text) {
  try {
    const response = await axios.post(`${ML_SERVICE}/embed`, { text }, { timeout: 10000 });
    return response.data.embedding;
  } catch (error) {
    return text.toLowerCase().split(/\s+/);
  }
}

// Atlas Vector Search retrieval
async function vectorSearch(queryEmbedding, k = 5) {
  try {
    const results = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: k,
        },
      },
      {
        $project: {
          text: 1,
          source_file: 1,
          section: 1,
          doc_type: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
    return results;
  } catch (error) {
    console.warn("Vector search failed, falling back to sample:", error.message);
    const results = await DocumentChunk.aggregate([
      { $sample: { size: k } },
      { $project: { text: 1, source_file: 1, section: 1, doc_type: 1 } },
    ]);
    return results;
  }
}

// Fetch live data based on question context
async function fetchLiveData(question) {
  const q = question.toLowerCase();
  const today = new Date().toISOString().split("T")[0];

  if (q.includes("forecast") || q.includes("generation") || q.includes("today") || q.includes("kwh")) {
    const forecast = await ForecastDaily.findOne({ date: new Date(today) });
    if (forecast) {
      return {
        type: "forecast",
        date: forecast.date,
        p10_kwh: forecast.p10_kwh,
        p50_kwh: forecast.p50_kwh,
        p90_kwh: forecast.p90_kwh,
      };
    }
  }

  if (q.includes("ice") || q.includes("tes") || q.includes("storage") || q.includes("coverage") || q.includes("cop")) {
    const tes = await TesRun.findOne({ date: new Date(today) });
    if (tes) {
      return {
        type: "tes",
        date: tes.date,
        ice_mass_kg: tes.ice_mass_kg,
        coverage_pct: tes.coverage_pct,
        cop_actual: tes.cop_actual,
      };
    }
  }

  return null;
}

// ─────────────── Corrective RAG Pipeline ───────────────
const MAX_RETRIES = 1;

async function runCorrectiveRAG(message, sid) {
  let correctiveAction = null;
  let retries = 0;
  let answer = "";
  let citations = [];

  // Step 1: Embed
  const queryEmbedding = await embedQuery(message);

  // Step 2: Retrieve
  let chunks = await vectorSearch(queryEmbedding, 5);

  // Step 3: Grade
  const graded = await Promise.all(
    chunks.map(async (chunk) => {
      const isRelevant = await gradeRelevance(message, chunk.text);
      return { ...chunk, grade: isRelevant };
    })
  );

  let relevant = graded.filter((c) => c.grade);

  // Step 4: Corrective action if too few relevant chunks
  if (relevant.length < 2 && retries < MAX_RETRIES) {
    correctiveAction = "query_rewrite";
    const rewritten = await rewriteQuery(message);
    const newEmbedding = await embedQuery(rewritten);
    const chunks2 = await vectorSearch(newEmbedding, 5);

    const graded2 = await Promise.all(
      chunks2.map(async (chunk) => {
        const isRelevant = await gradeRelevance(message, chunk.text);
        return { ...chunk, grade: isRelevant };
      })
    );

    const relevant2 = graded2.filter((c) => c.grade);
    if (relevant2.length > relevant.length) {
      chunks = chunks2;
      graded.push(...graded2);
      relevant.push(...relevant2);
      retries++;
    }
  }

  // Step 5: Tavily web search fallback (if configured and still not enough)
  if (relevant.length < 2 && process.env.TAVILY_API_KEY) {
    try {
      const tavilyResponse = await axios.post(
        "https://api.tavily.com/search",
        {
          api_key: process.env.TAVILY_API_KEY,
          query: message,
          max_results: 3,
        },
        { timeout: 10000 }
      );

      if (tavilyResponse.data.results?.length > 0) {
        const webChunks = tavilyResponse.data.results.map((r) => ({
          text: r.content,
          source_file: r.url,
          section: "web_search",
          grade: true,
        }));
        chunks.push(...webChunks);
        relevant.push(...webChunks);
        correctiveAction = correctiveAction
          ? `${correctiveAction}+tavily_web_search`
          : "tavily_web_search";
      }
    } catch (err) {
      console.warn("Tavily search failed:", err.message);
    }
  }

  // Step 6: Fetch live data
  const liveData = await fetchLiveData(message);

  // Step 7: Generate answer
  if (relevant.length === 0 && !liveData) {
    answer = "I don't have enough information in the current documents or live data to answer that. Please try rephrasing your question or ask about a specific topic covered in the documentation.";
  } else {
    const context = [
      ...relevant.map((c) => `[${c.source_file} - ${c.section || "N/A"}]: ${c.text}`),
    ];

    if (liveData) {
      context.push(`[Live Data]: ${JSON.stringify(liveData)}`);
      citations.push("Live forecast/TES data");
    }

    answer = await generateAnswer(message, context.join("\n\n"));

    // Self-reflection: grade generation
    const reflectPrompt = `You are grading whether the answer is USEFUL (directly answers) and GROUNDED (supported by context).\n\nQuestion: ${message}\nAnswer: ${answer.substring(0, 1500)}\n\nReply: "useful", "not_useful", or "hallucination".`;

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          messages: [{ role: "user", content: reflectPrompt }],
          temperature: 0.1,
          max_tokens: 20,
        }),
      });
      const data = await response.json();
      const grade = data.choices[0].message.content.trim().toLowerCase();

      if ((grade.includes("hallucination") || grade.includes("not_useful")) && retries < MAX_RETRIES) {
        // Retry with rewritten query
        retries++;
        correctiveAction = correctiveAction
          ? `${correctiveAction}+self_reflection_retry`
          : "self_reflection_retry";

        const rewritten = await rewriteQuery(message);
        const newEmbedding = await embedQuery(rewritten);
        const retryChunks = await vectorSearch(newEmbedding, 5);

        const retryRelevant = [];
        for (const chunk of retryChunks) {
          const isRelevant = await gradeRelevance(message, chunk.text);
          if (isRelevant) retryRelevant.push(chunk);
        }

        if (retryRelevant.length > 0) {
          const retryContext = retryRelevant.map((c) => `[${c.source_file} - ${c.section || "N/A"}]: ${c.text}`);
          answer = await generateAnswer(message, retryContext.join("\n\n"));
          retryRelevant.forEach((c) => {
            const citation = `${c.source_file}${c.section ? " - " + c.section : ""}`;
            if (!citations.includes(citation)) citations.push(citation);
          });
        }
      }
    } catch (err) {
      console.warn("Self-reflection grading failed:", err.message);
    }

    // Extract citations
    relevant.forEach((c) => {
      const citation = `${c.source_file}${c.section ? " - " + c.section : ""}`;
      if (!citations.includes(citation)) {
        citations.push(citation);
      }
    });
  }

  return { answer, citations, correctiveAction, retries };
}

// ─────────────── Routes ───────────────

router.post("/", validateChat, async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const sid = session_id || uuidv4();

    const { answer, citations, correctiveAction, retries } = await runCorrectiveRAG(message, sid);

    // Log the turn
    await ChatSession.findOneAndUpdate(
      { session_id: sid },
      {
        $push: {
          turns: {
            question: message,
            answer,
            corrective_action: correctiveAction,
            citations,
            retries,
          },
        },
        $setOnInsert: { session_id: sid },
      },
      { upsert: true, new: true }
    );

    res.json({
      session_id: sid,
      answer,
      citations,
      corrective_action: correctiveAction,
      retries,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/history/:sessionId", async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      session_id: req.params.sessionId,
    });
    if (!session) {
      return res.json({ turns: [] });
    }
    res.json({ turns: session.turns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
