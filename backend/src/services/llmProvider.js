/**
 * LLM Provider Service
 * Pluggable backend: defaults to DeepSeek (deepseek-v4-flash).
 * Supports: deepseek, gemini, groq via LLM_PROVIDER env var.
 * DeepSeek API is OpenAI-compatible.
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PROVIDER = process.env.LLM_PROVIDER || "deepseek";

// Gemini setup (fallback)
let genAI, geminiModel;
if (PROVIDER === "gemini" && GEMINI_API_KEY) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// ─────────────── DeepSeek (OpenAI-compatible) ───────────────

async function deepseekChat(messages, temperature = 0.3) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─────────────── Public API ───────────────

async function generateAnswer(question, context) {
  const systemPrompt = `You are Urjasetu, an expert assistant for the IIT Kharagpur Solar PV + Ice TES platform.
Answer questions ONLY using the provided context. Cite sources by name.
If you don't have enough information, say so explicitly.
Never make up information not present in the context.
Keep answers concise and factual.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:` },
  ];

  if (PROVIDER === "deepseek" && DEEPSEEK_API_KEY) {
    try {
      return await deepseekChat(messages);
    } catch (err) {
      console.error("DeepSeek API error:", err.message);
      return fallbackAnswer(question);
    }
  }

  if (PROVIDER === "gemini" && geminiModel) {
    try {
      const result = await geminiModel.generateContent([
        { text: systemPrompt + "\n\n" + `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:` },
      ]);
      return result.response.text();
    } catch (err) {
      console.error("Gemini API error:", err.message);
      return fallbackAnswer(question);
    }
  }

  return fallbackAnswer(question);
}

async function gradeRelevance(question, chunkText) {
  const prompt = `Question: ${question}\n\nDocument chunk: ${chunkText.substring(0, 1000)}\n\nIs this chunk relevant to answering the question? Reply with only 'yes' or 'no'.`;

  if (PROVIDER === "deepseek" && DEEPSEEK_API_KEY) {
    try {
      const result = await deepseekChat([{ role: "user", content: prompt }]);
      return result.trim().toLowerCase().startsWith("yes");
    } catch (err) {
      console.error("DeepSeek grading error:", err.message);
      return fallbackGrade(question, chunkText);
    }
  }

  if (PROVIDER === "gemini" && geminiModel) {
    try {
      const result = await geminiModel.generateContent([{ text: prompt }]);
      const text = result.response.text().trim().toLowerCase();
      return text.startsWith("yes");
    } catch (err) {
      console.error("Gemini grading error:", err.message);
      return fallbackGrade(question, chunkText);
    }
  }

  return fallbackGrade(question, chunkText);
}

async function rewriteQuery(originalQuestion) {
  const prompt = `Rewrite this question to be more specific and searchable, keeping the same intent. Return only the rewritten question.\n\nQuestion: ${originalQuestion}`;

  if (PROVIDER === "deepseek" && DEEPSEEK_API_KEY) {
    try {
      const result = await deepseekChat([{ role: "user", content: prompt }]);
      return result.trim();
    } catch (err) {
      console.error("DeepSeek rewrite error:", err.message);
      return originalQuestion;
    }
  }

  if (PROVIDER === "gemini" && geminiModel) {
    try {
      const result = await geminiModel.generateContent([{ text: prompt }]);
      return result.response.text().trim();
    } catch (err) {
      console.error("Gemini rewrite error:", err.message);
      return originalQuestion;
    }
  }

  return originalQuestion;
}

// Fallbacks when no API key is configured
function fallbackAnswer(question) {
  return `[Local fallback] Configure DEEPSEEK_API_KEY in .env for full LLM functionality. Question received: "${question}"`;
}

function fallbackGrade(question, chunkText) {
  const qWords = question.toLowerCase().split(/\s+/);
  const cWords = chunkText.toLowerCase().split(/\s+/);
  const overlap = qWords.filter((w) => w.length > 3 && cWords.includes(w)).length;
  return overlap >= 2;
}

module.exports = { generateAnswer, gradeRelevance, rewriteQuery };
