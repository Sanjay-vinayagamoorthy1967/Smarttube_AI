import express from "express";
import { YoutubeTranscript } from "youtube-transcript";

const router = express.Router();

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// POST /api/transcript
router.post("/transcript", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "URL is required" });

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ success: false, error: "Invalid YouTube URL" });
    }

    console.log(`Fetching transcript for video: ${videoId}`);
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptData || transcriptData.length === 0) {
      return res.status(404).json({ success: false, error: "No transcript found for this video" });
    }

    const segments = transcriptData.map((item) => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
      timestamp: formatTimestamp(item.offset / 1000),
    }));

    const fullText = segments.map((s) => s.text).join(" ");
    const totalDuration = segments.reduce((sum, s) => sum + (s.duration || 0), 0);

    res.json({
      success: true,
      videoId,
      transcript: fullText,
      segments,
      totalSegments: segments.length,
      totalDuration: Math.round(totalDuration / 1000 / 60),
    });
  } catch (error) {
    console.error("Transcript error:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch transcript. The video may not have subtitles.",
    });
  }
});

export default router;
