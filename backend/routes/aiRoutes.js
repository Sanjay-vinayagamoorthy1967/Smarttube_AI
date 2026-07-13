// backend/routes/aiRoutes.js  ── Complete (Part 1 helpers + Part 2 routes)
// SmartTube AI – All AI routes, Groq only, no Gemini.

import express from "express";
import {
  generateContent,
  hasValidKey,
} from "../services/groqService.js";

export const router = express.Router();

router.get("/test-ai", (req, res) => {
  res.json({
    success: true,
    message: "AI backend connected"
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 – Helpers
// ═══════════════════════════════════════════════════════════════════════════════

// ── Language maps ─────────────────────────────────────────────────────────────

export const LANG_MAP = {
  auto: "English",
  english: "English",
  tamil: "Tamil",
  hindi: "Hindi",
  telugu: "Telugu",
  malayalam: "Malayalam",
  kannada: "Kannada",
  bengali: "Bengali",
  marathi: "Marathi",
  urdu: "Urdu",
  french: "French",
  spanish: "Spanish",
};

export const VOICE_CODE_MAP = {
  auto: "en-US",
  english: "en-US",
  tamil: "ta-IN",
  hindi: "hi-IN",
  telugu: "te-IN",
  malayalam: "ml-IN",
  kannada: "kn-IN",
  bengali: "bn-IN",
  marathi: "mr-IN",
  urdu: "ur-PK",
  french: "fr-FR",
  spanish: "es-ES",
};

// ── Language utilities ────────────────────────────────────────────────────────

export function normalizeLanguage(lang) {
  if (!lang) return "english";
  const key = String(lang).trim().toLowerCase();
  return LANG_MAP[key] ? key : "english";
}

export function getLanguageName(lang) {
  return LANG_MAP[normalizeLanguage(lang)] ?? "English";
}

export function strictLanguageRule(lang) {
  const name = getLanguageName(lang);
  const scriptRules = {
    tamil:
      "You MUST write ONLY in Tamil script (தமிழ் எழுத்து). " +
      "Do NOT use English words, Roman letters, or transliteration anywhere. " +
      "Every single word must be authentic Tamil script (Unicode U+0B80–U+0BFF).",
    hindi:
      "You MUST write ONLY in Hindi using Devanagari script (देवनागरी). " +
      "Do NOT use English words, Roman letters, or transliteration anywhere. " +
      "Every single word must be authentic Devanagari (Unicode U+0900–U+097F).",
    english:
      "You MUST write ONLY in English. Do NOT mix any other language or script.",
    auto:
      "You MUST write ONLY in English. Do NOT mix any other language or script.",
  };
  return (
    scriptRules[lang] ??
    `You MUST write ONLY in ${name}. Do NOT mix English or any other language. Every word must be in ${name}.`
  );
}

// ── Transcript utilities ──────────────────────────────────────────────────────

export function truncateTranscript(transcript, limit = 1800) {
  if (typeof transcript !== "string") return "";
  const t = transcript.trim();
  if (t.length <= limit) return t;
  const cut = t.lastIndexOf(" ", limit);
  const boundary = cut > limit * 0.8 ? cut : limit;
  return t.slice(0, boundary);
}

// ── JSON utilities ────────────────────────────────────────────────────────────

export function cleanJson(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  const arrayStart = s.indexOf("[");
  const objectStart = s.indexOf("{");

  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    const arrayEnd = s.lastIndexOf("]");
    if (arrayEnd !== -1) s = s.slice(arrayStart, arrayEnd + 1);
  } else if (objectStart !== -1) {
    const objectEnd = s.lastIndexOf("}");
    if (objectEnd !== -1) s = s.slice(objectStart, objectEnd + 1);
  }

  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([\]}])/g, "$1");

  // Normalise smart quotes
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  return s.trim();
}

export function safeJsonParseArray(raw, fallback = []) {
  try {
    const cleaned = cleanJson(raw);
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const found = Object.values(parsed).find((v) => Array.isArray(v));
      if (found) return found;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function safeJsonParseObject(raw, fallback = {}) {
  try {
    const cleaned = cleanJson(raw);
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ── Quiz fallback ─────────────────────────────────────────────────────────────

export function createFallbackQuiz(lang) {
  const name = getLanguageName(lang);
  const fallbacks = {
    english: [
      {
        question: "What is the main topic of this video?",
        options: [
          "A) The video's primary subject",
          "B) An unrelated topic",
          "C) Background information only",
          "D) None of the above",
        ],
        answer: "A) The video's primary subject",
        difficulty: "Easy",
        explanation:
          "Fallback question — the quiz could not be generated for this transcript.",
      },
    ],
    tamil: [
      {
        question: "இந்த வீடியோவின் முக்கிய தலைப்பு என்ன?",
        options: [
          "அ) வீடியோவின் முக்கிய விஷயம்",
          "ஆ) தொடர்பில்லாத தலைப்பு",
          "இ) பின்னணி தகவல் மட்டும்",
          "ஈ) மேற்கூறிய எதுவும் இல்லை",
        ],
        answer: "அ) வீடியோவின் முக்கிய விஷயம்",
        difficulty: "Easy",
        explanation:
          "மாற்று கேள்வி — இந்த டிரான்ஸ்கிரிப்டிற்கு வினாடி வினா உருவாக்க முடியவில்லை.",
      },
    ],
    hindi: [
      {
        question: "इस वीडियो का मुख्य विषय क्या है?",
        options: [
          "अ) वीडियो का प्राथमिक विषय",
          "ब) असंबंधित विषय",
          "स) केवल पृष्ठभूमि जानकारी",
          "द) इनमें से कोई नहीं",
        ],
        answer: "अ) वीडियो का प्राथमिक विषय",
        difficulty: "Easy",
        explanation:
          "वैकल्पिक प्रश्न — इस ट्रांसक्रिप्ट के लिए क्विज़ नहीं बनाई जा सकी।",
      },
    ],
    telugu: [
      {
        question: "ఈ వీడియో యొక్క ప్రధాన అంశం ఏమిటి?",
        options: [
          "అ) వీడియో యొక్క ప్రాథమిక విషయం",
          "ఆ) సంబంధం లేని అంశం",
          "ఇ) నేపథ్య సమాచారం మాత్రమే",
          "ఈ) పైవేమీ కాదు",
        ],
        answer: "అ) వీడియో యొక్క ప్రాథమిక విషయం",
        difficulty: "Easy",
        explanation:
          "ప్రత్యామ్నాయ ప్రశ్న — ఈ ట్రాన్స్క్రిప్ట్ కోసం క్విజ్ రూపొందించబడలేదు.",
      },
    ],
    malayalam: [
      {
        question: "ഈ വീഡിയോയുടെ പ്രധാന വിഷയം എന്താണ്?",
        options: [
          "അ) വീഡിയോയുടെ പ്രാഥമിക വിഷയം",
          "ആ) ബന്ധമില്ലാത്ത വിഷയം",
          "ഇ) പശ്ചാത്തല വിവരങ്ങൾ മാത്രം",
          "ഈ) മേൽപ്പറഞ്ഞ ഒന്നും അല്ല",
        ],
        answer: "അ) വീഡിയോയുടെ പ്രാഥമിക വിഷയം",
        difficulty: "Easy",
        explanation:
          "ഓൾട്ടർനേറ്റ് ചോദ്യം — ഈ ട്രാൻസ്ക്രിപ്റ്റിനായി ക്വിസ് നിർമ്മിക്കാൻ കഴിഞ്ഞില്ല.",
      },
    ],
    kannada: [
      {
        question: "ಈ ವೀಡಿಯೊದ ಮುಖ್ಯ ವಿಷಯ ಏನು?",
        options: [
          "ಅ) ವೀಡಿಯೊದ ಪ್ರಾಥಮಿಕ ವಿಷಯ",
          "ಆ) ಅಸಂಬದ್ಧ ವಿಷಯ",
          "ಇ) ಹಿನ್ನೆಲೆ ಮಾಹಿತಿ ಮಾತ್ರ",
          "ಈ) ಮೇಲಿನ ಯಾವುದೂ ಅಲ್ಲ",
        ],
        answer: "ಅ) ವೀಡಿಯೊದ ಪ್ರಾಥಮಿಕ ವಿಷಯ",
        difficulty: "Easy",
        explanation:
          "ಪರ್ಯಾಯ ಪ್ರಶ್ನೆ — ಈ ಟ್ರಾನ್ಸ್‌ಕ್ರಿಪ್ಟ್‌ಗಾಗಿ ರಸಪ್ರಶ್ನೆ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
      },
    ],
    bengali: [
      {
        question: "এই ভিডিওর মূল বিষয় কী?",
        options: [
          "ক) ভিডিওর প্রাথমিক বিষয়",
          "খ) অসম্পর্কিত বিষয়",
          "গ) শুধু পটভূমির তথ্য",
          "ঘ) উপরের কোনোটিই নয়",
        ],
        answer: "ক) ভিডিওর প্রাথমিক বিষয়",
        difficulty: "Easy",
        explanation:
          "বিকল্প প্রশ্ন — এই ট্রান্সক্রিপ্টের জন্য কুইজ তৈরি করা সম্ভব হয়নি।",
      },
    ],
    marathi: [
      {
        question: "या व्हिडिओचा मुख्य विषय काय आहे?",
        options: [
          "अ) व्हिडिओचा प्राथमिक विषय",
          "ब) असंबंधित विषय",
          "क) केवळ पार्श्वभूमी माहिती",
          "ड) यापैकी काहीही नाही",
        ],
        answer: "अ) व्हिडिओचा प्राथमिक विषय",
        difficulty: "Easy",
        explanation:
          "पर्यायी प्रश्न — या ट्रान्सक्रिप्टसाठी क्विझ तयार करता आली नाही.",
      },
    ],
    urdu: [
      {
        question: "اس ویڈیو کا مرکزی موضوع کیا ہے؟",
        options: [
          "الف) ویڈیو کا بنیادی موضوع",
          "ب) غیر متعلق موضوع",
          "ج) صرف پس منظر کی معلومات",
          "د) مذکورہ بالا میں سے کوئی نہیں",
        ],
        answer: "الف) ویڈیو کا بنیادی موضوع",
        difficulty: "Easy",
        explanation:
          "متبادل سوال — اس ٹرانسکرپٹ کے لیے کوئز نہیں بنائی جا سکی۔",
      },
    ],
    french: [
      {
        question: "Quel est le sujet principal de cette vidéo ?",
        options: [
          "A) Le sujet principal de la vidéo",
          "B) Un sujet sans rapport",
          "C) Des informations de contexte uniquement",
          "D) Aucune des réponses ci-dessus",
        ],
        answer: "A) Le sujet principal de la vidéo",
        difficulty: "Easy",
        explanation:
          "Question de secours — le quiz n'a pas pu être généré pour cette transcription.",
      },
    ],
    spanish: [
      {
        question: "¿Cuál es el tema principal de este vídeo?",
        options: [
          "A) El tema principal del vídeo",
          "B) Un tema no relacionado",
          "C) Solo información de fondo",
          "D) Ninguna de las anteriores",
        ],
        answer: "A) El tema principal del vídeo",
        difficulty: "Easy",
        explanation:
          "Pregunta de respaldo — no se pudo generar el cuestionario para esta transcripción.",
      },
    ],
  };

  return fallbacks[lang] ?? fallbacks.english;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

const aiCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getCacheKey(feature, transcript, language, extra = "") {
  const snippet = (transcript ?? "").slice(0, 500);
  let hash = 5381;
  for (let i = 0; i < snippet.length; i++) {
    hash = ((hash << 5) + hash) ^ snippet.charCodeAt(i);
    hash = hash >>> 0;
  }
  return `${feature}::${language}::${extra}::${hash.toString(36)}`;
}

export function getCached(key) {
  const entry = aiCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    aiCache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key, value) {
  if (aiCache.size > 200) {
    const firstKey = aiCache.keys().next().value;
    aiCache.delete(firstKey);
  }
  aiCache.set(key, { value, ts: Date.now() });
}

// ── Guard middleware ──────────────────────────────────────────────────────────

function requireGroqKey(req, res, next) {
  if (!hasValidKey()) {
    return res.status(500).json({
      success: false,
      error: "GROQ_API_KEY is not configured. Add it to your .env file.",
    });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 – Routes
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { question, transcript, language }

router.post("/chat", requireGroqKey, async (req, res) => {
  try {
    const { question, transcript = "", language } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, error: "question is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("chat", ctx + question, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

You are a helpful AI tutor answering questions about a YouTube video.
${ctx ? `\nVideo transcript context:\n${ctx}\n` : ""}
User question: ${question}

Answer clearly and helpfully. Write ONLY in ${langName}. No mixing of languages.`;

    const answer = await generateContent(prompt, { max_tokens: 400, temperature: 0.6 });

    const payload = { success: true, language: lang, question, answer };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/chat]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/summary ─────────────────────────────────────────────────────────
// Body: { transcript, type, language }
// type: "short" | "medium" | "detailed"

router.post("/summary", requireGroqKey, async (req, res) => {
  try {
    const { transcript, type = "medium", language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const summaryType = ["short", "medium", "detailed"].includes(type) ? type : "medium";
    const cacheKey = getCacheKey("summary", ctx, lang, summaryType);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const formatInstructions = {
      short: `Write a SHORT summary in 3 to 5 sentences only. Be concise and capture the core idea.`,
      medium: `Write a MEDIUM summary in 2 small paragraphs. First paragraph: main topic and key ideas. Second paragraph: key takeaways.`,
      detailed: `Write a DETAILED summary with clearly labelled sections:
- Overview
- Key Points (bullet list of 4–6 items)
- Important Details
- Conclusion
Use proper headings for each section.`,
    };

    const prompt = `${langRule}

Summarise the following YouTube video transcript in ${langName}.
${formatInstructions[summaryType]}
Write ONLY in ${langName}. Do NOT mix English or any other language.

Transcript:
${ctx}`;

    const summary = await generateContent(prompt, { max_tokens: 350, temperature: 0.5 });

    const payload = { success: true, language: lang, type: summaryType, summary };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/summary]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/notes ───────────────────────────────────────────────────────────
// Body: { transcript, language }

router.post("/notes", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("notes", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

Create structured study notes from this YouTube video transcript in ${langName}.

Use EXACTLY these 5 headings in order (translate the headings into ${langName} too):
# Main Topic
# Key Concepts
# Important Terms
# Step-by-Step
# Quick Revision

Under each heading write 3–5 bullet points.
Write ONLY in ${langName}. Do NOT mix English or any other language.

Transcript:
${ctx}`;

    const notes = await generateContent(prompt, { max_tokens: 500, temperature: 0.5 });

    const payload = { success: true, language: lang, notes };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/notes]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/quiz ────────────────────────────────────────────────────────────
// Body: { transcript, language }

router.post("/quiz", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("quiz", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

Generate exactly 10 multiple-choice quiz questions about this YouTube video transcript.

STRICT RULES:
1. Return ONLY a valid JSON array — no markdown, no code fences, no explanation text before or after.
2. The JSON array must contain exactly 10 objects.
3. Every question, option, answer, and explanation must be written in ${langName} ONLY.
4. No English words unless the language is English.
5. No trailing commas in the JSON.

JSON format (follow exactly):
[
  {
    "question": "question text in ${langName}",
    "options": ["A) option", "B) option", "C) option", "D) option"],
    "answer": "A) correct option",
    "difficulty": "Easy",
    "explanation": "brief explanation in ${langName}"
  }
]

Difficulty distribution: 4 Easy, 4 Medium, 2 Hard.
Do NOT include anything outside the JSON array.

Transcript:
${ctx}`;

    const raw = await generateContent(prompt, {
      max_tokens: 600,
      temperature: 0.1,
      jsonMode: false, // we parse manually for resilience
    });

    // Attempt to parse; fall back gracefully on failure
    let quiz = safeJsonParseArray(raw, null);

    if (!quiz || quiz.length === 0) {
      // Try extracting embedded JSON more aggressively
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        quiz = safeJsonParseArray(jsonMatch[0], null);
      }
    }

    if (!quiz || quiz.length === 0) {
      console.warn(`[/api/quiz] JSON parse failed for lang=${lang}. Sending fallback.`);
      quiz = createFallbackQuiz(lang);
    }

    // Ensure all 10 items have required fields; patch missing ones
    quiz = quiz.slice(0, 10).map((q, i) => ({
      question: q.question ?? `Question ${i + 1}`,
      options: Array.isArray(q.options) ? q.options : ["A) -", "B) -", "C) -", "D) -"],
      answer: q.answer ?? "A) -",
      difficulty: q.difficulty ?? "Easy",
      explanation: q.explanation ?? "",
    }));

    // If model returned fewer than 10, pad with fallback questions
    while (quiz.length < 10) {
      const fb = createFallbackQuiz(lang)[0];
      quiz.push({ ...fb, question: `${fb.question} (${quiz.length + 1})` });
    }

    const payload = { success: true, language: lang, quiz };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/quiz]", err.message);
    // Even on hard crash, return a usable fallback instead of 500
    const lang = normalizeLanguage(req.body?.language);
    return res.status(200).json({
      success: true,
      language: lang,
      quiz: createFallbackQuiz(lang),
      warning: "Quiz generation failed; showing fallback questions.",
    });
  }
});

// ── POST /api/insights ────────────────────────────────────────────────────────
// Body: { transcript, language }

router.post("/insights", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("insights", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

Analyse this YouTube video transcript and provide deep insights in ${langName}.

Provide exactly these sections:
1. Core Message (1–2 sentences)
2. Key Insights (4–5 bullet points of the most valuable ideas)
3. Surprising or Counterintuitive Points (2–3 items)
4. Practical Applications (3 actionable takeaways)
5. Target Audience (who benefits most from this video)

Write ONLY in ${langName}. Do NOT mix English or any other language.

Transcript:
${ctx}`;

    const insights = await generateContent(prompt, { max_tokens: 400, temperature: 0.6 });

    const payload = { success: true, language: lang, insights };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/insights]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/mindmap ─────────────────────────────────────────────────────────
// Body: { transcript, language }

router.post("/mindmap", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("mindmap", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

Create a mind map JSON from this YouTube video transcript.

STRICT RULES:
1. Return ONLY a valid JSON object — no markdown, no code fences, no text before or after.
2. All text values must be in ${langName} ONLY.
3. No trailing commas in the JSON.

JSON format (follow exactly):
{
  "topic": "main topic in ${langName}",
  "branches": [
    {
      "title": "branch title in ${langName}",
      "points": ["point 1", "point 2", "point 3"]
    }
  ]
}

Requirements:
- topic: the central subject of the video (1 short phrase)
- branches: 4 to 6 branches
- each branch: a key theme with 2 to 4 supporting points
- every word in ${langName}

Do NOT include anything outside the JSON object.

Transcript:
${ctx}`;

    const raw = await generateContent(prompt, {
      max_tokens: 450,
      temperature: 0.1,
      jsonMode: false,
    });

    let mindmap = safeJsonParseObject(raw, null);

    // Validate structure; build a safe fallback if broken
    if (!mindmap || !mindmap.topic || !Array.isArray(mindmap.branches)) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) mindmap = safeJsonParseObject(jsonMatch[0], null);
    }

    if (!mindmap || !mindmap.topic || !Array.isArray(mindmap.branches) || mindmap.branches.length === 0) {
      mindmap = {
        topic: getLanguageName(lang) === "English" ? "Video Overview" : getLanguageName(lang),
        branches: [
          { title: "Key Ideas", points: ["See the video transcript for details."] },
        ],
      };
    }

    // Ensure every branch has required shape
    mindmap.branches = mindmap.branches.map((b) => ({
      title: b.title ?? "—",
      points: Array.isArray(b.points) ? b.points : [],
    }));

    const payload = { success: true, language: lang, mindmap };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/mindmap]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/video-explanation ───────────────────────────────────────────────
// Body: { transcript, language }

router.post("/video-explanation", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const voiceCode = VOICE_CODE_MAP[lang] ?? "en-US";
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("video-explanation", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prompt = `${langRule}

You are an engaging video explainer. Explain this YouTube video transcript clearly and conversationally in ${langName}.

Structure your explanation as:
1. What this video is about (1–2 sentences)
2. The main ideas explained simply (3–4 sentences)
3. Why this matters / key takeaway (1–2 sentences)

Write in a warm, natural tone as if speaking to a friend.
Write ONLY in ${langName}. No mixing of languages.

Transcript:
${ctx}`;

    const explanation = await generateContent(prompt, { max_tokens: 600, temperature: 0.65 });

    // Estimate reading duration (~130 words per minute for most languages)
    const wordCount = explanation.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(wordCount / 130));
    const duration = `${minutes} min`;

    const payload = {
      success: true,
      language: lang,
      title: "AI Video Explanation",
      explanation,
      voiceCode,
      duration,
    };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/video-explanation]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/analyze ─────────────────────────────────────────────────────────
// Body: { transcript, language }
// Runs summary + insights in parallel for a combined analysis payload.

router.post("/analyze", requireGroqKey, async (req, res) => {
  try {
    const { transcript, language } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, error: "transcript is required." });
    }

    const lang = normalizeLanguage(language);
    const langName = getLanguageName(lang);
    const langRule = strictLanguageRule(lang);
    const ctx = truncateTranscript(transcript);

    const cacheKey = getCacheKey("analyze", ctx, lang);
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Run summary and insights concurrently to halve latency
    const summaryPrompt = `${langRule}

Summarise the following YouTube video transcript in ${langName} in 2 short paragraphs.
Write ONLY in ${langName}. No mixing of languages.

Transcript:
${ctx}`;

    const insightsPrompt = `${langRule}

Analyse this YouTube video transcript and list 4 key insights in ${langName}.
Each insight should be 1–2 sentences. Use a numbered list.
Write ONLY in ${langName}. No mixing of languages.

Transcript:
${ctx}`;

    const [summary, insights] = await Promise.all([
      generateContent(summaryPrompt, { max_tokens: 300, temperature: 0.5 }),
      generateContent(insightsPrompt, { max_tokens: 300, temperature: 0.5 }),
    ]);

    const payload = { success: true, language: lang, summary, insights };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("[/api/analyze]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

router.get("/health", (req, res) => {
  res.json({
    success: true,
    groqKeyConfigured: hasValidKey(),
    cacheSize: aiCache.size,
    supportedLanguages: Object.keys(LANG_MAP),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
export default router;