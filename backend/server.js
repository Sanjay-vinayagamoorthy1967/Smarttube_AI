import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transcriptRoutes from "./routes/transcriptRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware first
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Root health check
app.get("/", (req, res) => {
  res.json({ status: "SmartTube AI backend running" });
});

// Routes only once
app.use("/api", transcriptRoutes);
app.use("/api", aiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Global error]", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`SmartTube AI backend listening on port ${PORT}`);
});

export default app;