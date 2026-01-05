// ✅ src/routes/aiMovementRoutes.js
import { Router } from "express";
import { analyzeMovement } from "../ai/movementModel.js";

const r = Router();

r.post("/analyze", async (req, res) => {
  const { member_id, session_id, movement_type, poseData } = req.body;

  if (!member_id || !poseData?.length)
    return res.status(400).json({ ok: false, error: "Invalid pose payload" });

  const result = await analyzeMovement({ member_id, session_id, movement_type, poseData });
  res.json(result);
});

r.get("/sessions/:member_id", async (req, res) => {
  const data = await pool.query(
    `SELECT * FROM ai_movement_sessions WHERE member_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [req.params.member_id]
  );
  res.json({ ok: true, sessions: data.rows });
});

export default r;
