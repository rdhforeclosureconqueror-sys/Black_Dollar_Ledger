import { Router } from "express";
import { pool } from "../server.js";

const r = Router();

r.post("/submit", async (req, res) => {
  const memberId = req.user.id;
  const { form_type, form_data } = req.body;
  try {
    await pool.query(
      `INSERT INTO form_submissions (member_id, form_type, form_json)
       VALUES ($1, $2, $3)`,
      [memberId, form_type, JSON.stringify(form_data)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
