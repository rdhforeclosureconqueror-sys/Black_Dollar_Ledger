// ✅ src/routes/aiRoutes.js
import { Router } from "express";
import { aiPipeline } from "../ai/aiPipeline.js";
import { analyzeMovement } from "../ai/movementModel.js";
import { db as pool } from "../server.js"; // ✅ shared DB instance from server.js

const router = Router();

/**
 * 🧠 Unified AI Routes
 * All routes require authentication via middleware (handled in server.js)
 */

// 🏋️ POST /ai/movement — Receives preprocessed metrics from frontend TensorFlow
router.post("/movement", async (req, res) => {
  try {
    const { member_id } = req.user;
    const { session_id, movement_type, accuracy, reps } = req.body;

    if (!member_id || !session_id) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const result = await analyzeMovement({
      member_id,
      session_id,
      movement_type,
      accuracy,
      reps,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ /ai/movement error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🏃 POST /ai/workout — For TensorFlow motionData
router.post("/workout", async (req, res) => {
  try {
    const { member_id } = req.user;
    const { motionData } = req.body;
    const result = await aiPipeline.processWorkoutMotion({ member_id, motionData });
    res.json(result);
  } catch (err) {
    console.error("❌ /ai/workout error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🗣️ POST /ai/voice — Analyze clarity or pronunciation
router.post("/voice", async (req, res) => {
  try {
    const { member_id } = req.user;
    const { audioFeatures } = req.body;
    const result = await aiPipeline.analyzeLanguageVoice({ member_id, audioFeatures });
    res.json(result);
  } catch (err) {
    console.error("❌ /ai/voice error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧘 POST /ai/journal — Analyze reflective writing positivity
router.post("/journal", async (req, res) => {
  try {
    const { member_id } = req.user;
    const { content } = req.body;
    const result = await aiPipeline.analyzeJournal({ member_id, content });
    res.json(result);
  } catch (err) {
    console.error("❌ /ai/journal error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧩 GET /ai/metrics/:member_id — Retrieve all AI metrics for a member
router.get("/metrics/:member_id", async (req, res) => {
  try {
    const { member_id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM ai_metrics WHERE member_id = $1 ORDER BY created_at DESC`,
      [member_id]
    );
    res.json({ ok: true, metrics: rows });
  } catch (err) {
    console.error("❌ /ai/metrics error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
