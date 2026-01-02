import { Router } from "express";
import { pool } from "../server.js";

const r = Router();

// 🧾 GET /admin/overview — dashboard summary
r.get("/overview", async (_req, res) => {
  try {
    const members = await pool.query("SELECT COUNT(*) FROM members");
    const shares = await pool.query("SELECT COUNT(*) FROM share_events");
    const stars = await pool.query("SELECT COALESCE(SUM(delta),0) FROM star_transactions");
    const bd = await pool.query("SELECT COALESCE(SUM(delta),0) FROM bd_transactions");

    const platformBreakdown = await pool.query(`
      SELECT share_platform AS platform, COUNT(*) AS count
      FROM share_events
      GROUP BY share_platform
      ORDER BY count DESC;
    `);

    const recentActivity = await pool.query(`
      SELECT 
        s.member_id, m.display_name, 'share' AS category, s.created_at
      FROM share_events s
      JOIN members m ON m.member_id = s.member_id
      UNION ALL
      SELECT 
        v.member_id, m.display_name, 'review' AS category, v.created_at
      FROM video_reviews v
      JOIN members m ON m.member_id = v.member_id
      ORDER BY created_at DESC LIMIT 15;
    `);

    res.json({
      ok: true,
      stats: {
        members_total: parseInt(members.rows[0].count),
        shares_total: parseInt(shares.rows[0].count),
        stars_total: parseInt(stars.rows[0].coalesce || 0),
        bd_total: parseInt(bd.rows[0].coalesce || 0),
      },
      platformBreakdown: platformBreakdown.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error("❌ /admin/overview error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
