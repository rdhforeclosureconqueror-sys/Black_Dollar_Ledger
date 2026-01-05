import { Router } from "express";
import { pool } from "../server.js";

const r = Router();

r.get("/profiles", async (_req, res) => {
  const data = await pool.query("SELECT * FROM ai_adaptive_profiles");
  res.json({ ok: true, profiles: data.rows });
});

export default r;
