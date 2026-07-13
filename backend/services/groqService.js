// backend/services/groqService.js
// SmartTube AI – Groq-only service layer
// Model: llama-3.1-8b-instant

import Groq from "groq-sdk";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL = "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = 400;
const MAX_PROMPT_CHARS = 3000; // safe ceiling before Groq's context limit

// ─── Client (lazy-initialised so import never throws) ────────────────────────

let _client = null;

function getClient() {
  if (!_client) {
    const key = process.env.GROQ_API_KEY;
    if (!key || key.trim() === "") {
      throw new Error(
        "GROQ_API_KEY is missing or empty. Set it in your .env file."
      );
    }
    _client = new Groq({ apiKey: key.trim() });
  }
  return _client;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when a non-empty GROQ_API_KEY is present in the environment.
 */
export function hasValidKey() {
  const key = process.env.GROQ_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Trim a prompt to MAX_PROMPT_CHARS, appending a notice when truncated.
 * Keeps the trim on a word boundary to avoid mid-token cuts.
 *
 * @param {string} prompt
 * @returns {string}
 */
export function safeTrimPrompt(prompt) {
  if (typeof prompt !== "string") return "";
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  // Cut at the last space before the limit so we don't slice a word in half
  const cut = prompt.lastIndexOf(" ", MAX_PROMPT_CHARS);
  const boundary = cut > MAX_PROMPT_CHARS * 0.8 ? cut : MAX_PROMPT_CHARS;
  return prompt.slice(0, boundary) + "\n[...transcript trimmed for length...]";
}

/**
 * Core generation function. All routes should go through this.
 *
 * @param {string} prompt  – the full prompt string
 * @param {object} options – optional overrides
 * @param {number} [options.max_tokens=500]
 * @param {number} [options.temperature=0.7]
 * @param {boolean} [options.jsonMode=false]  – lower temperature, tighter output
 * @returns {Promise<string>} – the assistant's text response (trimmed)
 */
export async function generateContent(prompt, options = {}) {
  const {
    max_tokens = DEFAULT_MAX_TOKENS,
    temperature = options.jsonMode ? 0.1 : 0.4,
    jsonMode = false,
  } = options;

  // Guard: never send an oversized prompt
  const safePrompt = safeTrimPrompt(prompt);

  const requestParams = {
    model: MODEL,
    max_tokens,
    temperature,
    messages: [{ role: "user", content: safePrompt }],
  };

  // Groq supports response_format for JSON mode on supported models
  if (jsonMode) {
    requestParams.response_format = { type: "json_object" };
  }

  try {
    const client = getClient();
    const completion = await client.chat.completions.create(requestParams);
    const text = completion?.choices?.[0]?.message?.content ?? "";
    return text.trim();
  } catch (err) {
    // Surface a clean, actionable error message
    const status = err?.status ?? err?.statusCode;
    const groqMsg = err?.error?.error?.message ?? err?.message ?? "Unknown error";

    if (status === 401) {
      throw new Error("Invalid GROQ_API_KEY. Check your .env file.");
    }
    if (status === 413 || groqMsg.toLowerCase().includes("too large")) {
      throw new Error(
        "Prompt too large for Groq. Use truncateTranscript() before calling generateContent()."
      );
    }
    if (status === 429) {
      throw new Error("Groq rate limit reached. Please wait a moment and retry.");
    }
    if (status >= 500) {
      throw new Error(`Groq server error (${status}). Try again shortly.`);
    }

    throw new Error(`Groq API error: ${groqMsg}`);
  }
}