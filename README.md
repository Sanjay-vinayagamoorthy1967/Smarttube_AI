# SmartTube AI 🎬✨

> Premium AI-powered YouTube Video Learning Studio — analyze any YouTube video and chat, summarize, quiz, and study from it. Powered by **Groq** (Llama 3.3 70B).

![Tech](https://img.shields.io/badge/React-18-61dafb)
![Tech](https://img.shields.io/badge/Vite-5-purple)
![Tech](https://img.shields.io/badge/Tailwind-3-38bdf8)
![Tech](https://img.shields.io/badge/Express-4-black)
![Tech](https://img.shields.io/badge/AI-Groq-orange)

---

## ✨ Features

### Core
- 📝 **Transcript** — fetch transcript for any YouTube video with subtitles
- 💬 **Chat** — ask questions about the video in natural language
- ✨ **Summary** — short / medium / detailed
- 🎯 **Quiz** — auto-generated 10-question MCQ quiz with scoring & explanations
- 📚 **Notes** — structured study notes (copy + download as Markdown)
- 🧠 **Insights** — topics, audience, difficulty, learning outcomes

### Premium UI Extras
- 📊 **Video Learning Dashboard** with live stats
- 📈 **Study Progress Tracker**
- 🔖 **Important Timestamp Bookmarks**
- 🎯 **Focus Mode** (distraction-free)
- ⏱ **Watch-Time Saver Calculator** (read vs watch)
- 🎓 **Difficulty Badge**
- 🗺 **Topic Timeline** (Intro / Core / Outro)
- 📋 **Revision Checklist**
- 📋 **Copy Notes** + ⬇️ **Download Notes**
- ⭐ **Save Favorite Q&A**
- 🕘 **Recent Video History**
- 🔎 **Search Inside Transcript**
- ⌨️ **Keyboard Shortcuts**: `Enter` send chat · `Ctrl+K` focus transcript search · `Ctrl+S` save notes
- 🌐 **Multi-language responses**: Auto Detect, English, Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, Urdu, French, Spanish

### Design
- Modern dark theme · Glassmorphism · Purple/blue gradient · Neon glow buttons · Smooth animations · Mobile responsive

---

## 🗂 Folder Structure

```
smarttube-ai/
├── backend/
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   └── transcriptRoutes.js
│   ├── services/
│   │   └── groqService.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── utils/api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

---

## ⚙️ Setup

### 1. Get a free Groq API key
1. Go to **https://console.groq.com/keys**
2. Sign in / sign up (free)
3. Create a new API key and copy it

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# then edit backend/.env and paste your key:
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
npm run dev
```

Backend runs at: **http://localhost:5001**

Health check: http://localhost:5001/api/health

### 3. Frontend

In a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

Open your browser at: **http://localhost:5173** 🎉

---

## 🔌 API Routes (do not change)

All routes are prefixed with `/api`:

| Method | Route               | Body                                                    |
|--------|---------------------|---------------------------------------------------------|
| POST   | `/api/transcript`   | `{ url }`                                               |
| POST   | `/api/chat`         | `{ question, transcript, language }`                    |
| POST   | `/api/summary`      | `{ transcript, type, language }`                        |
| POST   | `/api/quiz`         | `{ transcript }`                                        |
| POST   | `/api/notes`        | `{ transcript, language }`                              |
| POST   | `/api/insights`     | `{ transcript }`                                        |
| GET    | `/api/health`       | —                                                       |

---

## 🧪 Run Commands (cheat sheet)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Browser: **http://localhost:5173**

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, Axios
- **Backend**: Node.js, Express 4, youtube-transcript
- **AI**: Groq SDK (`llama-3.3-70b-versatile`)

---

Made with ❤️ for learners.
