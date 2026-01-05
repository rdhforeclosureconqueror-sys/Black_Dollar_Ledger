import { Router } from "express";
import { pool } from "../server.js";
import { grantReward } from "../utils/rewardEngine.js";

const r = Router();

r.post("/practice", async (req, res) => {
  const { language_key, practice_date, recordings } = req.body;
  const memberId = req.user.id;
  try {
    await pool.query(
      `INSERT INTO language_events (member_id, language_key, practice_date, recordings_json)
       VALUES ($1, $2, $3, $4)`,
      [memberId, language_key, practice_date, JSON.stringify(recordings || [])]
    );
    const reward = await grantReward(
      memberId,
      "language",
      "daily_practice_complete"
    );
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
