import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  fetchTranscript, sendChat, generateSummary, generateQuiz,
  generateNotes, generateInsights, generateMindMap,
} from "./utils/api";

const API_BASE = "http://localhost:5001/api";

/* ─── Constants ─── */
const LANGUAGES = [
  { code: "auto",      label: "Auto Detect" },
  { code: "english",   label: "English" },
  { code: "tamil",     label: "Tamil / தமிழ்" },
  { code: "hindi",     label: "Hindi / हिंदी" },
  { code: "telugu",    label: "Telugu / తెలుగు" },
  { code: "malayalam", label: "Malayalam / മലയാളം" },
  { code: "kannada",   label: "Kannada / ಕನ್ನಡ" },
  { code: "bengali",   label: "Bengali / বাংলা" },
  { code: "marathi",   label: "Marathi / मराठी" },
  { code: "urdu",      label: "Urdu / اردو" },
  { code: "french",    label: "French / Français" },
  { code: "spanish",   label: "Spanish / Español" },
];

const TABS = [
  { id: "dashboard",  label: "Dashboard",  icon: "📊" },
  { id: "transcript", label: "Transcript", icon: "📝" },
  { id: "chat",       label: "Chat",       icon: "💬" },
  { id: "summary",    label: "Summary",    icon: "✨" },
  { id: "quiz",       label: "Quiz",       icon: "🎯" },
  { id: "notes",      label: "Notes",      icon: "📚" },
  { id: "insights",   label: "Insights",   icon: "🧠" },
  { id: "mindmap",    label: "Mind Map",   icon: "🗺️" },
];

const SK = {
  history:   "stube.history",
  bookmarks: "stube.bookmarks",
  favorites: "stube.favorites",
  checklist: "stube.checklist",
  watched:   "stube.watched",
  language:  "stube.language",
};

const ls = {
  get(key, fb) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

/* ════════════════════════════════════════════════════════ */
/*  MAIN APP                                                */
/* ════════════════════════════════════════════════════════ */
export default function App() {
  const [aiReady,       setAiReady]       = useState(false);
  const [url,           setUrl]           = useState("");
  const [videoId,       setVideoId]       = useState("");
  const [transcript,    setTranscript]    = useState("");
  const [segments,      setSegments]      = useState([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [tab,           setTab]           = useState("dashboard");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [language,      setLanguage]      = useState(() => ls.get(SK.language, "english"));
  const [focusMode,     setFocusMode]     = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  // Feature data
  const [chatMessages,   setChatMessages]   = useState([]);
  const [chatInput,      setChatInput]      = useState("");
  const [chatLoading,    setChatLoading]    = useState(false);
  const [summary,        setSummary]        = useState("");
  const [summaryType,    setSummaryType]    = useState("medium");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [quiz,           setQuiz]           = useState([]);
  const [quizAnswers,    setQuizAnswers]    = useState({});
  const [quizLoading,    setQuizLoading]    = useState(false);
  const [quizSubmitted,  setQuizSubmitted]  = useState(false);
  const [notes,          setNotes]          = useState("");
  const [notesLoading,   setNotesLoading]   = useState(false);
  const [insights,       setInsights]       = useState(null);
  const [insightsLoading,setInsightsLoading]= useState(false);
  const [mindmap,        setMindmap]        = useState(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);

  // Persistent
  const [history,   setHistory]   = useState(() => ls.get(SK.history, []));
  const [bookmarks, setBookmarks] = useState(() => ls.get(SK.bookmarks, {}));
  const [favorites, setFavorites] = useState(() => ls.get(SK.favorites, []));
  const [checklist, setChecklist] = useState(() => ls.get(SK.checklist, {}));
  const [watched,   setWatched]   = useState(() => ls.get(SK.watched, {}));

  const [transcriptQuery, setTranscriptQuery] = useState("");
  const transcriptSearchRef = useRef(null);

  useEffect(() => ls.set(SK.history,   history),   [history]);
  useEffect(() => ls.set(SK.bookmarks, bookmarks), [bookmarks]);
  useEffect(() => ls.set(SK.favorites, favorites), [favorites]);
  useEffect(() => ls.set(SK.checklist, checklist), [checklist]);
  useEffect(() => ls.set(SK.watched,   watched),   [watched]);
  useEffect(() => ls.set(SK.language,  language),  [language]);

  useEffect(() => {
    const checkAI = async () => {
      try {
        const res = await fetch(`${API_BASE}/test-ai`);
        const data = await res.json();
        setAiReady(data.success === true);
      } catch (error) {
        console.error("AI status check failed:", error);
        setAiReady(false);
      }
    };

    checkAI();
    const timer = setInterval(checkAI, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { document.body.classList.toggle("focus-mode", focusMode); }, [focusMode]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setTab("transcript");
        setTimeout(() => transcriptSearchRef.current?.focus(), 50);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && notes) {
        e.preventDefault(); downloadNotes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes]);

  /* ── Actions ── */
  async function handleAnalyze(targetUrl) {
    const finalUrl = (targetUrl ?? url).trim();
    if (!finalUrl) { setError("Please paste a YouTube URL."); return; }
    setError(""); setLoading(true);
    setTranscript(""); setSegments([]); setVideoId(""); setTotalDuration(0);
    setChatMessages([]); setSummary(""); setQuiz([]); setQuizAnswers({});
    setQuizSubmitted(false); setNotes(""); setInsights(null); setMindmap(null);
    try {
      const { data } = await fetchTranscript(finalUrl);
      if (!data.success) throw new Error(data.error || "Failed to fetch transcript");
      setVideoId(data.videoId);
      setTranscript(data.transcript);
      setSegments(data.segments || []);
      setTotalDuration(data.totalDuration || 0);
      setUrl(finalUrl);
      setHistory(prev => [
        { videoId: data.videoId, url: finalUrl, addedAt: Date.now(), duration: data.totalDuration || 0 },
        ...prev.filter(h => h.videoId !== data.videoId),
      ].slice(0, 15));
      setTab("dashboard");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendChat() {
    const q = chatInput.trim();
    if (!q || !transcript) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: q, ts: Date.now() }]);
    setChatLoading(true);
    try {
      const { data } = await sendChat(q, transcript, language);
      if (!data.success) throw new Error(data.error || "Chat failed");
      setChatMessages(prev => [...prev, { role: "ai", text: data.answer, ts: Date.now() }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "ai", text: `⚠️ ${e.message}`, ts: Date.now(), error: true }]);
    } finally { setChatLoading(false); }
  }

  async function handleGenerateSummary() {
    if (!transcript) return;
    setSummaryLoading(true); setSummary("");
    try {
      const { data } = await generateSummary(transcript, summaryType, language);
      if (!data.success) throw new Error(data.error);
      setSummary(data.summary);
    } catch (e) { setSummary(`⚠️ ${e.message}`); }
    finally { setSummaryLoading(false); }
  }

  async function handleGenerateQuiz() {
    if (!transcript) return;
    setQuizLoading(true); setQuiz([]); setQuizAnswers({}); setQuizSubmitted(false);
    try {
      const { data } = await generateQuiz(transcript, language);
      if (!data.success) throw new Error(data.error);
      setQuiz(Array.isArray(data.quiz) ? data.quiz : Array.isArray(data.questions) ? data.questions : []);
    } catch (e) { setError(e.message); }
    finally { setQuizLoading(false); }
  }

  async function handleGenerateNotes() {
    if (!transcript) return;
    setNotesLoading(true); setNotes("");
    try {
      const { data } = await generateNotes(transcript, language);
      if (!data.success) throw new Error(data.error);
      setNotes(data.notes);
    } catch (e) { setNotes(`⚠️ ${e.message}`); }
    finally { setNotesLoading(false); }
  }

  async function handleGenerateInsights() {
    if (!transcript) return;
    setInsightsLoading(true); setInsights(null);
    try {
      const { data } = await generateInsights(transcript, language);
      if (!data.success) throw new Error(data.error);
      setInsights(data.insights);
    } catch (e) { setError(e.message); }
    finally { setInsightsLoading(false); }
  }

  async function handleGenerateMindMap() {
    if (!transcript) return;
    setMindmapLoading(true); setMindmap(null);
    try {
      const { data } = await generateMindMap(transcript, language);
      if (!data.success) throw new Error(data.error);
      setMindmap(data.mindmap);
    } catch (e) { setError(e.message); }
    finally { setMindmapLoading(false); }
  }

  function copyNotes() { if (notes) navigator.clipboard?.writeText(notes); }
  function downloadNotes() {
    if (!notes) return;
    const blob = new Blob([notes], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smarttube-notes-${videoId || "video"}.md`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function toggleBookmark(seg) {
    if (!videoId) return;
    setBookmarks(prev => {
      const list = [...(prev[videoId] || [])];
      const idx = list.findIndex(b => b.offset === seg.offset);
      if (idx >= 0) list.splice(idx, 1); else list.push({ offset: seg.offset, timestamp: seg.timestamp, text: seg.text });
      return { ...prev, [videoId]: list };
    });
  }
  const isBookmarked = offset => !!bookmarks[videoId]?.some(b => b.offset === offset);

  function toggleFavorite(idx) {
    const m = chatMessages[idx], prev = chatMessages[idx - 1];
    if (!m || m.role !== "ai" || !prev || prev.role !== "user") return;
    const id = `${videoId}-${prev.ts}-${m.ts}`;
    setFavorites(list => {
      const exists = list.find(f => f.id === id);
      if (exists) return list.filter(f => f.id !== id);
      return [{ id, videoId, question: prev.text, answer: m.text, savedAt: Date.now() }, ...list];
    });
  }
  const isFavorited = idx => {
    const m = chatMessages[idx], prev = chatMessages[idx - 1];
    if (!m || !prev) return false;
    return !!favorites.find(f => f.id === `${videoId}-${prev.ts}-${m.ts}`);
  };

  function toggleChecklist(item) {
    if (!videoId) return;
    setChecklist(prev => {
      const list = [...(prev[videoId] || [])];
      const idx = list.findIndex(c => c.text === item);
      if (idx >= 0) list[idx] = { ...list[idx], done: !list[idx].done };
      else list.push({ text: item, done: false });
      return { ...prev, [videoId]: list };
    });
  }
  const getChecklistFor = id => checklist[id] || [];

  function markWatched(id, pct) { if (id) setWatched(prev => ({ ...prev, [id]: { percent: pct, when: Date.now() } })); }

  const filteredSegments = useMemo(() => {
    if (!transcriptQuery.trim()) return segments;
    const q = transcriptQuery.toLowerCase();
    return segments.filter(s => s.text.toLowerCase().includes(q));
  }, [segments, transcriptQuery]);

  const watchSaver = useMemo(() => {
    if (!transcript) return null;
    const words = transcript.split(/\s+/).length;
    const readMin = Math.max(1, Math.round(words / 250));
    const watchMin = totalDuration || Math.max(1, Math.round(words / 130));
    return { saved: Math.max(0, watchMin - readMin), readMin, watchMin };
  }, [transcript, totalDuration]);

  const difficulty = useMemo(() => {
    if (insights?.difficultyLevel) return insights.difficultyLevel;
    if (!transcript) return "—";
    const avg = transcript.replace(/[^a-zA-Z ]/g, "").split(/\s+/).reduce((a, w) => a + w.length, 0) / Math.max(1, transcript.split(/\s+/).length);
    return avg > 6 ? "Advanced" : avg > 5 ? "Intermediate" : "Beginner";
  }, [insights, transcript]);

  const topicTimeline = useMemo(() => {
    if (!segments.length) return [];
    const n = segments.length;
    return [
      { label: "Intro",  from: 0,                    to: Math.floor(n / 3) },
      { label: "Core",   from: Math.floor(n / 3),    to: Math.floor(2 * n / 3) },
      { label: "Outro",  from: Math.floor(2 * n / 3), to: n },
    ].map(s => ({
      label: s.label,
      timestamp: segments[s.from]?.timestamp || "00:00",
      preview: segments.slice(s.from, s.from + 4).map(x => x.text).join(" ").slice(0, 110) + "…",
    }));
  }, [segments]);

  const hasVideo = !!transcript;
  const watchedPct = watched[videoId]?.percent || 0;
  const completedCount = Object.values(watched).filter(w => w.percent >= 100).length;

  const followUpSuggestions = insights?.followUpQuestions || [
    "Summarize the key points",
    "What are the main takeaways?",
    "Explain the most complex part simply",
    "What happens at the beginning?",
    "List 5 actionable insights",
  ];

  /* ── Render ── */
  return (
    <div className="min-h-screen relative z-10 text-slate-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40" style={{ background: "rgba(6,6,18,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)", boxShadow: "0 0 25px rgba(124,58,237,0.5)" }}>
              ▶
            </div>
            <div>
              <div className="font-extrabold text-xl leading-none">
                Smart<span className="gradient-text">Tube</span> AI
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block tracking-wide">
                YOUTUBE INTELLIGENCE STUDIO
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl hidden md:flex">
            <div className="flex w-full gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Paste YouTube URL and press Enter…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              />
              <button className="btn btn-neon flex-shrink-0" onClick={() => handleAnalyze()} disabled={loading}>
                {loading ? <><span className="spinner" /> Analyzing…</> : <>✨ Analyze</>}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select className="select !w-auto !py-2 text-xs hidden sm:block" value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>🌐 {l.label}</option>)}
            </select>
            <span className={`badge ${aiReady ? "badge-success" : "badge-warn"}`}>
              <span className={`dot ${aiReady ? "" : "dot-off"}`} />
              {aiReady ? "AI Ready" : "AI Offline"}
            </span>
            <span className="badge badge-purple hidden lg:inline-flex">⚡ Groq</span>
            <button className={`btn btn-ghost text-xs ${focusMode ? "!border-purple-400/60 !text-purple-300" : ""}`}
              onClick={() => setFocusMode(v => !v)} title="Focus mode">
              {focusMode ? "🔍 Exit" : "🎯 Focus"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
        {/* Mobile URL bar */}
        <div className="md:hidden mb-4 focus-hide">
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" placeholder="Paste YouTube URL…" value={url}
              onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAnalyze()} />
            <button className="btn btn-neon" onClick={() => handleAnalyze()} disabled={loading}>
              {loading ? <span className="spinner" /> : "Go"}
            </button>
          </div>
          <div className="mt-2">
            <select className="select text-xs" value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>🌐 {l.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex items-center gap-2 focus-hide">
            ⚠️ {error}
            <button className="ml-auto text-red-400 hover:text-red-200" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* Tabs */}
        <nav className="mb-4 flex flex-wrap gap-2 focus-hide">
          {TABS.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? "tab-active" : ""}`} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.id === "mindmap" && <span className="badge badge-cyan !px-1.5 !py-0 text-[10px]">NEW</span>}
            </button>
          ))}
        </nav>

        {/* Content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Main */}
          <div className="xl:col-span-8 space-y-5">
            {tab === "dashboard" && (
              <DashboardPanel
                hasVideo={hasVideo} videoId={videoId} totalDuration={totalDuration}
                difficulty={difficulty} watchSaver={watchSaver} topicTimeline={topicTimeline}
                history={history} onOpen={u => handleAnalyze(u)}
                completedCount={completedCount} bookmarksCount={(bookmarks[videoId] || []).length}
                favoritesCount={favorites.length} onMarkComplete={() => markWatched(videoId, 100)}
                watchedPct={watchedPct} historyLen={history.length}
              />
            )}
            {tab === "transcript" && (
              <TranscriptPanel
                hasVideo={hasVideo} segments={filteredSegments} allSegments={segments}
                videoId={videoId} query={transcriptQuery} setQuery={setTranscriptQuery}
                searchRef={transcriptSearchRef} onToggleBookmark={toggleBookmark} isBookmarked={isBookmarked}
              />
            )}
            {tab === "chat" && (
              <ChatPanel
                hasVideo={hasVideo} language={language} setLanguage={setLanguage}
                messages={chatMessages} input={chatInput} setInput={setChatInput}
                onSend={handleSendChat} loading={chatLoading}
                onToggleFavorite={toggleFavorite} isFavorited={isFavorited}
                followUpSuggestions={followUpSuggestions}
              />
            )}
            {tab === "summary" && (
              <SummaryPanel
                hasVideo={hasVideo} summary={summary} summaryType={summaryType}
                setSummaryType={setSummaryType} onGenerate={handleGenerateSummary} loading={summaryLoading}
                language={language}
              />
            )}
            {tab === "quiz" && (
              <QuizPanel
                hasVideo={hasVideo} quiz={quiz} answers={quizAnswers} setAnswers={setQuizAnswers}
                submitted={quizSubmitted} onSubmit={() => setQuizSubmitted(true)}
                onReset={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
                onGenerate={handleGenerateQuiz} loading={quizLoading} language={language}
              />
            )}
            {tab === "notes" && (
              <NotesPanel
                hasVideo={hasVideo} notes={notes} onGenerate={handleGenerateNotes}
                loading={notesLoading} onCopy={copyNotes} onDownload={downloadNotes} language={language}
              />
            )}
            {tab === "insights" && (
              <InsightsPanel
                hasVideo={hasVideo} insights={insights} onGenerate={handleGenerateInsights}
                loading={insightsLoading} onAddToChecklist={toggleChecklist}
                checklist={getChecklistFor(videoId)} onToggleChecklist={toggleChecklist}
              />
            )}
            {tab === "mindmap" && (
              <MindMapPanel
                hasVideo={hasVideo} mindmap={mindmap} onGenerate={handleGenerateMindMap}
                loading={mindmapLoading} language={language}
              />
            )}
          </div>

          {/* Sidebar */}
          <aside className="xl:col-span-4 space-y-4 focus-hide">
            {videoId && (
              <div className="card !p-3">
                <div className="aspect-video rounded-xl overflow-hidden border border-white/10">
                  <iframe title="YouTube" src={`https://www.youtube.com/embed/${videoId}`}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen style={{ width: "100%", height: "100%", border: 0 }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="badge badge-info">⏱ {totalDuration || "?"} min</span>
                  <span className={`badge ${difficulty === "Beginner" ? "badge-success" : difficulty === "Advanced" ? "badge-warn" : "badge-cyan"}`}>
                    🎓 {difficulty}
                  </span>
                  {watchedPct > 0 && <span className="badge badge-purple">📈 {watchedPct}%</span>}
                </div>
              </div>
            )}

            {/* Bookmarks sidebar */}
            <div className="card">
              <div className="font-semibold flex items-center gap-2 mb-3">🔖 Bookmarks
                <span className="badge badge-purple ml-auto">{(bookmarks[videoId] || []).length}</span>
              </div>
              {!(bookmarks[videoId] || []).length
                ? <div className="text-xs text-slate-500">Bookmark segments in Transcript tab.</div>
                : <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(bookmarks[videoId] || []).map(b => (
                    <li key={b.offset} className="flex items-start gap-2 text-sm">
                      <a href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor((b.offset || 0) / 1000)}s`}
                        target="_blank" rel="noreferrer" className="badge badge-info flex-shrink-0">⏱ {b.timestamp}</a>
                      <span className="flex-1 text-slate-300 text-xs line-clamp-2">{b.text}</span>
                      <button className="text-slate-600 hover:text-red-400 text-xs" onClick={() => toggleBookmark(b)}>✕</button>
                    </li>
                  ))}
                </ul>
              }
            </div>

            {/* Saved Q&A */}
            {favorites.length > 0 && (
              <div className="card">
                <div className="font-semibold flex items-center gap-2 mb-3">⭐ Saved Q&A
                  <span className="badge badge-purple ml-auto">{favorites.length}</span>
                </div>
                <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {favorites.slice(0, 8).map(f => (
                    <li key={f.id} className="p-2 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-xs text-purple-300 line-clamp-2">Q: {f.question}</div>
                      <div className="text-xs text-slate-400 line-clamp-2 mt-1">{f.answer}</div>
                      <button className="text-[11px] text-slate-600 hover:text-red-400 mt-1"
                        onClick={() => setFavorites(l => l.filter(x => x.id !== f.id))}>Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Checklist */}
            {getChecklistFor(videoId).length > 0 && (
              <div className="card">
                <div className="font-semibold mb-2">📋 Revision Checklist</div>
                {(() => {
                  const items = getChecklistFor(videoId);
                  const done = items.filter(i => i.done).length;
                  return <>
                    <div className="text-xs text-slate-500 mb-2">{done}/{items.length} done</div>
                    <div className="progress mb-3"><div className="progress-bar" style={{ width: `${(done / items.length) * 100}%` }} /></div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {items.map(c => (
                        <li key={c.text}>
                          <label className="flex items-start gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(c.text)} className="mt-0.5" />
                            <span className={c.done ? "line-through text-slate-600" : "text-slate-300"}>{c.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>;
                })()}
              </div>
            )}

            {/* History */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">🕘 History</div>
                {history.length > 0 && (
                  <button className="text-xs text-slate-600 hover:text-red-400" onClick={() => setHistory([])}>Clear</button>
                )}
              </div>
              {!history.length
                ? <div className="text-xs text-slate-500">Analyzed videos appear here.</div>
                : <ul className="space-y-2">
                  {history.map(h => (
                    <li key={h.videoId} className="flex items-center gap-2 group">
                      <img src={`https://i.ytimg.com/vi/${h.videoId}/mqdefault.jpg`} alt=""
                        className="w-14 h-9 object-cover rounded-lg border border-white/10 flex-shrink-0"
                        onError={e => e.currentTarget.style.opacity = "0.3"} />
                      <button className="flex-1 text-left text-xs hover:text-purple-300 truncate transition"
                        onClick={() => handleAnalyze(h.url)}>
                        <div className="font-medium">{h.videoId}</div>
                        <div className="text-slate-500">{h.duration || "?"} min · {new Date(h.addedAt).toLocaleDateString()}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              }
            </div>
          </aside>
        </div>

        <footer className="mt-10 mb-4 text-center text-xs text-slate-600">
          SmartTube AI · Powered by Groq · llama-3.1-8b-instant · Built with React + Vite
        </footer>
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
/*  SUB-COMPONENTS                                          */
/* ════════════════════════════════════════════════════════ */

function EmptyState({ icon = "🎬", title, hint, action }) {
  return (
    <div className="card text-center py-16 fade-in">
      <div className="text-6xl mb-4">{icon}</div>
      <div className="text-xl font-bold gradient-text">{title}</div>
      {hint && <div className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">{hint}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function LoadingBlock({ lines = 4 }) {
  return (
    <div className="card space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span className="spinner" />
        <span className="text-sm text-slate-400">AI is generating…</span>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="shimmer h-4 rounded" style={{ width: `${55 + (i * 13 % 45)}%` }} />
      ))}
    </div>
  );
}

/* ── Dashboard ── */
function DashboardPanel({ hasVideo, videoId, totalDuration, difficulty, watchSaver, topicTimeline,
  history, onOpen, completedCount, bookmarksCount, favoritesCount, onMarkComplete, watchedPct, historyLen }) {
  const stats = [
    { label: "Analyzed",  value: historyLen,      icon: "🎥", color: "text-purple-400" },
    { label: "Completed", value: completedCount,  icon: "✅", color: "text-green-400" },
    { label: "Bookmarks", value: bookmarksCount,  icon: "🔖", color: "text-blue-400" },
    { label: "Saved Q&A", value: favoritesCount,  icon: "⭐", color: "text-yellow-400" },
  ];
  return (
    <div className="space-y-5 fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card !p-5 hover:scale-[1.02] transition-transform">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {hasVideo ? (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">📈 Study Progress</div>
              <button className="btn btn-ghost text-xs" onClick={onMarkComplete}>✓ Mark Complete</button>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${watchedPct}%` }} /></div>
            <div className="mt-2 text-xs text-slate-500">{watchedPct}% complete</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card !p-4">
              <div className="text-xs text-slate-500 mb-1">Difficulty</div>
              <span className={`badge text-sm ${difficulty === "Beginner" ? "badge-success" : difficulty === "Advanced" ? "badge-warn" : "badge-cyan"}`}>
                🎓 {difficulty}
              </span>
            </div>
            <div className="card !p-4">
              <div className="text-xs text-slate-500 mb-1">Duration</div>
              <div className="text-2xl font-bold text-slate-200">{totalDuration || "—"} <span className="text-sm text-slate-500">min</span></div>
            </div>
            <div className="card !p-4">
              <div className="text-xs text-slate-500 mb-1">Time Saved by Skimming</div>
              <div className="text-2xl font-bold gradient-text">{watchSaver ? `~${watchSaver.saved}m` : "—"}</div>
              {watchSaver && <div className="text-[11px] text-slate-600 mt-1">Watch {watchSaver.watchMin}m vs read {watchSaver.readMin}m</div>}
            </div>
          </div>

          <div className="card">
            <div className="font-semibold mb-4">⏱ Topic Timeline</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topicTimeline.map((t, i) => (
                <div key={t.label} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-purple-500/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{t.label}</span>
                    <span className="badge badge-info">⏱ {t.timestamp}</span>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">{t.preview}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-16">
          <div className="text-6xl mb-5">🎬</div>
          <div className="text-2xl font-black gradient-text mb-2">SmartTube AI</div>
          <div className="text-slate-400 mb-1">Your Intelligent YouTube Learning Studio</div>
          <div className="text-slate-500 text-sm">Paste a YouTube URL above to unlock all features</div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
            {["💬 AI Chat", "✨ Smart Summary", "🎯 Auto Quiz", "📚 Study Notes", "🧠 Insights", "🗺️ Mind Map"].map(f => (
              <span key={f} className="badge badge-purple">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Transcript ── */
function TranscriptPanel({ hasVideo, segments, allSegments, videoId, query, setQuery, searchRef, onToggleBookmark, isBookmarked }) {
  if (!hasVideo) return <EmptyState icon="📝" title="No transcript yet" hint="Analyze a YouTube video first." />;
  return (
    <div className="card fade-in">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="font-semibold flex-1">Transcript
          <span className="text-slate-500 text-xs ml-2">{allSegments.length} segments</span>
        </div>
        <input ref={searchRef} className="input !w-auto md:w-72 text-sm"
          placeholder="🔎 Search transcript… (Ctrl+K)"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      {query && (
        <div className="mb-3 text-xs text-purple-400">{segments.length} matches found</div>
      )}
      <div className="max-h-[65vh] overflow-y-auto space-y-1 pr-2">
        {!segments.length
          ? <div className="text-slate-500 text-sm py-8 text-center">No matches found.</div>
          : segments.map((s, i) => (
            <div key={`${s.offset}-${i}`} className="flex gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition group">
              <a href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor((s.offset || 0) / 1000)}s`}
                target="_blank" rel="noreferrer" className="badge badge-info flex-shrink-0 hover:scale-105 transition text-[11px]">
                ⏱ {s.timestamp}
              </a>
              <div className="flex-1 text-sm leading-relaxed text-slate-300"
                dangerouslySetInnerHTML={{ __html: highlight(s.text, query) }} />
              <button className="opacity-0 group-hover:opacity-100 btn btn-ghost !py-1 !px-2 text-xs transition"
                onClick={() => onToggleBookmark(s)} title="Bookmark">
                {isBookmarked(s.offset) ? "🔖" : "➕"}
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function highlight(text, q) {
  const safe = String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  if (!q?.trim()) return safe;
  return safe.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
}

/* ── Chat ── */
function ChatPanel({ hasVideo, language, setLanguage, messages, input, setInput, onSend, loading, onToggleFavorite, isFavorited, followUpSuggestions }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const quickPrompts = [
    "Summarize the key points",
    "What are the main takeaways?",
    "Explain simply (ELI5)",
    "What happens at 01:00?",
    "List 5 action items",
  ];

  if (!hasVideo) return <EmptyState icon="💬" title="Ask anything about the video"
    hint="Analyze a video to start chatting with SmartTube AI." />;

  return (
    <div className="card fade-in flex flex-col" style={{ minHeight: "65vh" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="font-semibold flex items-center gap-2">
          💬 SmartTube Chat
          <span className="badge badge-success">⚡ Groq · Llama 3.1 8B</span>
        </div>
        <select className="select !w-auto text-xs" value={language} onChange={e => setLanguage(e.target.value)}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>🌐 {l.label}</option>)}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1 pb-2" style={{ maxHeight: "55vh" }}>
        {messages.length === 0 && (
          <div className="py-4">
            <div className="text-sm text-slate-500 mb-3">💡 Quick prompts:</div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map(s => (
                <button key={s} className="followup-chip" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start"}>
            {m.role === "user"
              ? <div className="bubble-user slide-up">{m.text}</div>
              : <>
                <div className="bubble-ai slide-up">{m.text}</div>
                {!m.error && (
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <button className="btn btn-ghost !py-1 !px-2 text-[11px]"
                      onClick={() => onToggleFavorite(i)}>
                      {isFavorited(i) ? "⭐ Saved" : "☆ Save"}
                    </button>
                    <button className="btn btn-ghost !py-1 !px-2 text-[11px]"
                      onClick={() => navigator.clipboard?.writeText(m.text)}>
                      📋 Copy
                    </button>
                  </div>
                )}
              </>
            }
          </div>
        ))}
        {loading && (
          <div className="bubble-ai slide-up flex items-center gap-2">
            <span className="spinner" /> Thinking in {language}…
          </div>
        )}
      </div>

      {/* Follow-up suggestions after AI response */}
      {messages.length > 0 && !loading && followUpSuggestions.length > 0 && (
        <div className="mt-2 mb-2">
          <div className="text-[11px] text-slate-600 mb-1.5">Follow-up suggestions:</div>
          <div className="flex flex-wrap gap-1.5">
            {followUpSuggestions.slice(0, 3).map((q, i) => (
              <button key={i} className="followup-chip !text-[11px] !py-1"
                onClick={() => setInput(q)}>
                💬 {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <input className="input flex-1 text-sm" placeholder="Ask anything about the video… (Enter to send)"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), onSend())} />
        <button className="btn btn-neon" onClick={onSend} disabled={loading || !input.trim()}>
          {loading ? <span className="spinner" /> : "→"}
        </button>
      </div>
    </div>
  );
}

/* ── Summary ── */
function SummaryPanel({ hasVideo, summary, summaryType, setSummaryType, onGenerate, loading, language }) {
  if (!hasVideo) return <EmptyState icon="✨" title="No summary yet" hint="Analyze a video to generate a smart summary." />;
  return (
    <div className="card fade-in">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="font-semibold flex-1">✨ AI Summary</div>
        <div className="flex items-center gap-2">
          {["short", "medium", "detailed"].map(t => (
            <button key={t} className={`btn text-xs ${summaryType === t ? "btn-neon" : "btn-ghost"}`}
              onClick={() => setSummaryType(t)}>
              {t === "short" ? "⚡ Short" : t === "medium" ? "📄 Medium" : "📖 Detailed"}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <><span className="spinner" /> Generating…</> : "Generate"}
        </button>
      </div>
      {loading ? <LoadingBlock lines={8} />
        : summary
          ? <div className="notes">{summary}</div>
          : <div className="text-slate-500 text-sm py-8 text-center">
              Select a length and click Generate to create an AI summary in <strong className="text-purple-400">{language}</strong>.
            </div>
      }
    </div>
  );
}

/* ── Quiz ── */
function QuizPanel({ hasVideo, quiz, answers, setAnswers, submitted, onSubmit, onReset, onGenerate, loading, language }) {
  if (!hasVideo) return <EmptyState icon="🎯" title="No quiz yet" hint="Analyze a video to take an auto-generated MCQ quiz." />;
  const score = submitted ? quiz.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0) : 0;
  const diffColor = d => d === "Easy" ? "badge-easy" : d === "Hard" ? "badge-hard" : "badge-medium";

  return (
    <div className="card fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="font-semibold">🎯 MCQ Quiz
          {quiz.length > 0 && <span className="text-slate-500 text-xs ml-2">{quiz.length} questions</span>}
        </div>
        <div className="flex gap-2">
          {quiz.length > 0 && !submitted && (
            <button className="btn btn-primary" onClick={onSubmit}>Submit Answers</button>
          )}
          {quiz.length > 0 && submitted && (
            <button className="btn btn-ghost" onClick={onReset}>🔄 Retry</button>
          )}
          <button className="btn btn-neon" onClick={onGenerate} disabled={loading}>
            {loading ? <><span className="spinner" /> Building…</> : "Generate Quiz"}
          </button>
        </div>
      </div>

      {loading && <LoadingBlock lines={10} />}

      {submitted && quiz.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
          <div>
            🏆 Score: <b className="text-emerald-300">{score} / {quiz.length}</b>
            <span className="text-slate-400 ml-2">({Math.round((score / quiz.length) * 100)}%)</span>
          </div>
          <span className={`badge ${score / quiz.length >= 0.7 ? "badge-success" : score / quiz.length >= 0.5 ? "badge-warn" : "badge-red"}`}>
            {score / quiz.length >= 0.7 ? "🎉 Excellent!" : score / quiz.length >= 0.5 ? "👍 Good" : "📖 Review needed"}
          </span>
        </div>
      )}

      <div className="space-y-5">
        {quiz.map((q, i) => (
          <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-purple-500/20 transition">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="font-semibold text-sm">{i + 1}. {q.question}</div>
              {q.difficulty && (
                <span className={`badge ${diffColor(q.difficulty)} flex-shrink-0 text-[10px]`}>{q.difficulty}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(q.options || []).map(opt => {
                const selected = answers[i] === opt;
                const correct  = submitted && opt === q.answer;
                const wrong    = submitted && selected && opt !== q.answer;
                return (
                  <button key={opt}
                    className={`text-left text-sm px-3 py-2.5 rounded-lg border transition
                      ${correct ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                        : wrong ? "border-red-500 bg-red-500/15 text-red-200"
                        : selected ? "border-purple-400 bg-purple-500/15 text-purple-200"
                        : "border-white/10 hover:bg-white/5 hover:border-purple-500/30"}`}
                    onClick={() => !submitted && setAnswers({ ...answers, [i]: opt })}>
                    <span className="mr-1">{correct ? "✅" : wrong ? "❌" : ""}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <div className="mt-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                💡 {q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Notes ── */
function NotesPanel({ hasVideo, notes, onGenerate, loading, onCopy, onDownload, language }) {
  if (!hasVideo) return <EmptyState icon="📚" title="No notes yet" hint="Generate structured study notes from any analyzed video." />;
  return (
    <div className="card fade-in">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="font-semibold flex-1">📚 Study Notes</div>
        {notes && <>
          <button className="btn btn-ghost text-xs" onClick={onCopy}>📋 Copy</button>
          <button className="btn btn-ghost text-xs" onClick={onDownload}>⬇️ Download .md</button>
        </>}
        <button className="btn btn-neon" onClick={onGenerate} disabled={loading}>
          {loading ? <><span className="spinner" /> Writing…</> : "Generate Notes"}
        </button>
      </div>
      {loading ? <LoadingBlock lines={12} />
        : notes
          ? <div className="notes">{notes}</div>
          : <div className="text-slate-500 text-sm py-8 text-center">
              Click <strong>Generate Notes</strong> to create bullet-point study notes in <strong className="text-purple-400">{language}</strong>.
            </div>
      }
    </div>
  );
}

/* ── Insights ── */
function InsightsPanel({ hasVideo, insights, onGenerate, loading, onAddToChecklist, checklist, onToggleChecklist }) {
  if (!hasVideo) return <EmptyState icon="🧠" title="No insights yet" hint="Generate deep AI insights about topics, audience, and learning outcomes." />;

  const insightText = typeof insights === "string" ? insights : "";
  const insightObj = insights && typeof insights === "object" ? insights : null;

  return (
    <div className="card fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold">🧠 AI Insights</div>
        <button className="btn btn-neon" onClick={onGenerate} disabled={loading}>
          {loading ? <><span className="spinner" /> Analyzing…</> : "Generate Insights"}
        </button>
      </div>

      {loading && <LoadingBlock lines={8} />}

      {insightText && !loading && (
        <div className="notes whitespace-pre-wrap fade-in">{insightText}</div>
      )}

      {insightObj && !loading && (
        <div className="space-y-4 fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: "🎓", label: "Difficulty",    value: insightObj.difficultyLevel },
              { icon: "⏱",  label: "Read Time",     value: insightObj.estimatedReadTime },
              { icon: "🎬", label: "Content Type",  value: insightObj.contentType },
              { icon: "😊", label: "Tone",           value: insightObj.sentiment },
            ].map(x => (
              <div key={x.label} className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="text-xs text-slate-500 mb-1">{x.icon} {x.label}</div>
                <div className="font-semibold text-sm">{x.value || "—"}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="text-xs text-slate-500 mb-2">🎯 Target Audience</div>
            <div className="text-sm">{insightObj.targetAudience || "—"}</div>
          </div>

          <TagsGrid title="📌 Main Topics" items={insightObj.mainTopics} color="purple" />
          <TagsGrid title="💡 Key Concepts" items={insightObj.importantConcepts} color="cyan" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ListWithAction title="🔑 Key Takeaways" items={insightObj.keyTakeaways}
              action={item => (
                <button className="btn btn-ghost !py-0.5 !px-2 text-[11px] flex-shrink-0"
                  onClick={() => onAddToChecklist(item)}>+ Add</button>
              )} />
            <ListWithAction title="🎓 Learning Outcomes" items={insightObj.learningOutcomes} />
          </div>

          {insightObj.followUpQuestions?.length > 0 && (
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-xs text-slate-500 mb-2">❓ Follow-up Questions</div>
              <div className="flex flex-wrap gap-2">
                {insightObj.followUpQuestions.map((q, i) => (
                  <span key={i} className="followup-chip">{q}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagsGrid({ title, items, color }) {
  return (
    <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-xs text-slate-500 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {(items || []).map((t, i) => <span key={i} className={`badge badge-${color}`}>{t}</span>)}
      </div>
    </div>
  );
}

function ListWithAction({ title, items, action }) {
  return (
    <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-xs text-slate-500 mb-2">{title}</div>
      <ul className="space-y-2 text-sm">
        {(items || []).map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
            <span className="flex-1">{it}</span>
            {action && action(it)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Mind Map ── */
function MindMapPanel({ hasVideo, mindmap, onGenerate, loading, language }) {
  const [expandedBranches, setExpandedBranches] = useState({});

  const normalizedMindmap = useMemo(() => {
    if (!mindmap || mindmap.error) return mindmap;

    const root = mindmap.root || mindmap.topic || "Mind Map";
    const colors = ["#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];

    const branches = (mindmap.branches || []).map((branch, index) => {
      const id = branch.id || `branch-${index}`;
      const label = branch.label || branch.title || `Branch ${index + 1}`;
      const color = branch.color || colors[index % colors.length];

      if (Array.isArray(branch.children) && branch.children.length > 0) {
        return { ...branch, id, label, color };
      }

      const children = (branch.points || []).map((point, pointIndex) => ({
        id: `${id}-point-${pointIndex}`,
        label: point,
        children: [],
      }));

      return { id, label, color, children };
    });

    return { ...mindmap, root, branches };
  }, [mindmap]);

  function toggleBranch(id) {
    setExpandedBranches(prev => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (normalizedMindmap?.branches) {
      const state = {};
      normalizedMindmap.branches.forEach(b => { state[b.id] = true; });
      setExpandedBranches(state);
    }
  }, [normalizedMindmap]);

  if (!hasVideo) return <EmptyState icon="🗺️" title="No mind map yet"
    hint="Generate a visual mind map to see the video's knowledge structure." />;

  return (
    <div className="card fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="font-semibold">🗺️ Mind Map
          <span className="badge badge-cyan ml-2 text-[10px]">NEW</span>
        </div>
        <button className="btn btn-neon" onClick={onGenerate} disabled={loading}>
          {loading ? <><span className="spinner" /> Mapping…</> : "Generate Mind Map"}
        </button>
      </div>

      {loading && <LoadingBlock lines={8} />}

      {normalizedMindmap && !normalizedMindmap.error && !loading && (
        <div className="fade-in">
          <div className="flex justify-center mb-8">
            <div className="mindmap-root max-w-md">{normalizedMindmap.root}</div>
          </div>

          <div className="space-y-4">
            {(normalizedMindmap.branches || []).map((branch) => (
              <div key={branch.id} className="rounded-xl border border-white/10 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition"
                  style={{ borderLeft: `3px solid ${branch.color}` }}
                  onClick={() => toggleBranch(branch.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="mindmap-branch" style={{ background: `${branch.color}25`, border: `1px solid ${branch.color}60` }}>
                      {branch.label}
                    </div>
                    <span className="text-xs text-slate-500">{branch.children?.length || 0} points</span>
                  </div>
                  <span className="text-slate-500 text-xs">{expandedBranches[branch.id] ? "▲" : "▼"}</span>
                </button>

                {expandedBranches[branch.id] && (
                  <div className="p-3 bg-white/[0.01] space-y-3">
                    {(branch.children || []).map((child) => (
                      <div key={child.id} className="ml-4">
                        <div className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <span style={{ color: branch.color }}>◆</span> {child.label}
                        </div>
                        {child.children?.length > 0 && (
                          <div className="ml-5 flex flex-wrap gap-2">
                            {child.children.map(leaf => (
                              <span key={leaf.id} className="mindmap-leaf">{leaf.label}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="text-xs text-slate-500 mb-3">📋 Text Tree View</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", lineHeight: "1.8", color: "#94a3b8" }}>
              <div className="text-purple-400 font-bold">📌 {normalizedMindmap.root}</div>
              {(normalizedMindmap.branches || []).map(b => (
                <div key={b.id} className="ml-2">
                  <div style={{ color: b.color }}>├── {b.label}</div>
                  {(b.children || []).map((c) => (
                    <div key={c.id} className="ml-4">
                      <div className="text-slate-400">│   ├── {c.label}</div>
                      {(c.children || []).map((leaf) => (
                        <div key={leaf.id} className="ml-8 text-slate-500">│   │   └── {leaf.label}</div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {normalizedMindmap?.error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
          ⚠️ {normalizedMindmap.error}. Try generating again.
        </div>
      )}
    </div>
  );
}
