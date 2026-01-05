import { Router } from "express";
import { pool } from "../server.js";
import { grantReward } from "../utils/rewardEngine.js";

const r = Router();

r.post("/journal", async (req, res) => {
  const { title, content } = req.body;
  const memberId = req.user.id;
  try {
    await pool.query(
      `INSERT INTO study_events (member_id, type, title, content)
       VALUES ($1, 'journal', $2, $3)`,
      [memberId, title, content]
    );
    const reward = await grantReward(memberId, "study", "journal_entry");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

r.post("/share", async (req, res) => {
  const { topic } = req.body;
  const memberId = req.user.id;
  try {
    await pool.query(
      `INSERT INTO study_events (member_id, type, title)
       VALUES ($1, 'share', $2)`,
      [memberId, topic]
    );
    const reward = await grantReward(memberId, "study", "share_completed");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
