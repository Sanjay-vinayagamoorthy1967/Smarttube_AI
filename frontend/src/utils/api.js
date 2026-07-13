import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

const LIMIT = 8000;

const trimText = (t) => {
  if (!t) return "";
  return t.length > LIMIT ? t.slice(0, LIMIT) : t;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      error.message = "Request timed out.";
    } else if (!error.response) {
      error.message =
        "Cannot connect to backend. Make sure backend runs on port 5001.";
    } else if (error.response?.data?.error) {
      error.message = error.response.data.error;
    }

    return Promise.reject(error);
  }
);

// Transcript
export const fetchTranscript = (url) =>
  api.post("/transcript", { url });

// Chat
export const sendChat = (
  question,
  transcript,
  language = "english"
) =>
  api.post("/chat", {
    question,
    transcript: trimText(transcript),
    language,
  });

// Summary
export const generateSummary = (
  transcript,
  type = "medium",
  language = "english"
) =>
  api.post("/summary", {
    transcript: trimText(transcript),
    type,
    language,
  });

// Quiz
export const generateQuiz = (
  transcript,
  language = "english"
) =>
  api.post("/quiz", {
    transcript: trimText(transcript),
    language,
  });

// Notes
export const generateNotes = (
  transcript,
  language = "english"
) =>
  api.post("/notes", {
    transcript: trimText(transcript),
    language,
  });

// Insights
export const generateInsights = (
  transcript,
  language = "english"
) =>
  api.post("/insights", {
    transcript: trimText(transcript),
    language,
  });

// MindMap
export const generateMindMap = (
  transcript,
  language = "english"
) =>
  api.post("/mindmap", {
    transcript: trimText(transcript),
    language,
  });

// Health
export const checkHealth = () =>
  api.get("/test-ai");

export default api;