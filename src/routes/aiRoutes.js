import { Router } from "express";
import { pool } from "../server.js";
import { grantReward } from "../utils/rewardEngine.js";

const r = Router();

r.post("/session", async (req, res) => {
  const memberId = req.user.id;
  const { session_id, summary } = req.body;
  try {
    await pool.query(
      `INSERT INTO ai_sessions (member_id, session_id, summary_json)
       VALUES ($1, $2, $3)`,
      [memberId, session_id, JSON.stringify(summary || {})]
    );
    const reward = await grantReward(memberId, "fitness", "workout_complete");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
