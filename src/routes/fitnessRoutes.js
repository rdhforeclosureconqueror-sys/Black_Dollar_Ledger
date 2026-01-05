import { Router } from "express";
import { pool } from "../server.js";
import { grantReward } from "../utils/rewardEngine.js";

const r = Router();

r.post("/log", async (req, res) => {
  const { type } = req.body; // "workout" | "water"
  const memberId = req.user.id;
  try {
    await pool.query(
      `INSERT INTO fitness_events (member_id, event_type)
       VALUES ($1, $2)`,
      [memberId, type]
    );

    const trigger =
      type === "workout" ? "workout_complete" : "water_log";
    const reward = await grantReward(memberId, "fitness", trigger);
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
