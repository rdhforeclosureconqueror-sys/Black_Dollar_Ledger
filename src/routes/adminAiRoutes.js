// ✅ src/routes/adminAiRoutes.js
import { Router } from "express";
import { pool } from "../server.js";

const r = Router();

// 📊 AI Metrics Overview
r.get("/overview", async (_req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE metric_type='motion') AS motions,
        COUNT(*) FILTER (WHERE metric_type='voice') AS voices,
        COUNT(*) FILTER (WHERE metric_type='journal') AS journals,
        ROUND(AVG(score)::numeric, 2) AS avg_score
      FROM ai_metrics;
    `);

    const byType = await pool.query(`
      SELECT metric_type, ROUND(AVG(score)::numeric, 2) AS avg_score, COUNT(*) AS samples
      FROM ai_metrics
      GROUP BY metric_type
      ORDER BY metric_type;
    `);

    const latestModels = await pool.query(`
      SELECT model_name, version, created_at, parameters
      FROM ai_models
      ORDER BY created_at DESC LIMIT 3;
    `);

    res.json({
      ok: true,
      data: {
        totals: totals.rows[0],
        byType: byType.rows,
        models: latestModels.rows,
      },
    });
  } catch (err) {
    console.error("❌ /admin/ai/overview error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 👥 AI Scores by Member
r.get("/members", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.member_id,
        m.display_name,
        m.email,
        ROUND(AVG(a.score)::numeric, 2) AS avg_score,
        COUNT(*) AS total_metrics,
        COUNT(*) FILTER (WHERE a.metric_type='motion') AS motions,
        COUNT(*) FILTER (WHERE a.metric_type='voice') AS voices,
        COUNT(*) FILTER (WHERE a.metric_type='journal') AS journals
      FROM members m
      LEFT JOIN ai_metrics a ON a.member_id = m.member_id
      GROUP BY m.member_id, m.display_name, m.email
      ORDER BY avg_score DESC NULLS LAST;
    `);

    res.json({ ok: true, members: result.rows });
  } catch (err) {
    console.error("❌ /admin/ai/members error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
