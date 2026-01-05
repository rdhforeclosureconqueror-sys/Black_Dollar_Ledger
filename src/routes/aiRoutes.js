// ✅ src/routes/aiRoutes.js
import { Router } from "express";
import { aiPipeline } from "../ai/aiPipeline.js";

const r = Router();

// 🏋️ POST /ai/workout
r.post("/workout", async (req, res) => {
  const { member_id } = req.user;
  const { motionData } = req.body;
  const result = await aiPipeline.processWorkoutMotion({ member_id, motionData });
  res.json(result);
});

// 🗣️ POST /ai/language
r.post("/language", async (req, res) => {
  const { member_id } = req.user;
  const { audioFeatures } = req.body;
  const result = await aiPipeline.analyzeLanguageVoice({ member_id, audioFeatures });
  res.json(result);
});

// 📚 POST /ai/journal
r.post("/journal", async (req, res) => {
  const { member_id } = req.user;
  const { content } = req.body;
  const result = await aiPipeline.analyzeJournal({ member_id, content });
  res.json(result);
});

export default r;
