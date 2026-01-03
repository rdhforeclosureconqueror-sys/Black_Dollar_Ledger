// ✅ src/routes/adminRoutes.js
import { Router } from "express";
import { pool } from "../server.js";

const router = Router();

// 🧾 GET /admin/overview — Cosmic Command Center data
router.get("/overview", async (_req, res) => {
  try {
    // 📊 Core stats
    const members = await pool.query(`SELECT COUNT(*) AS count FROM members`);
    const shares = await pool.query(`SELECT COUNT(*) AS count FROM share_events`);
    const stars = await pool.query(`SELECT COALESCE(SUM(delta),0) AS total FROM star_transactions`);
    const bd = await pool.query(`SELECT COALESCE(SUM(delta),0) AS total FROM bd_transactions`);

    // 🌍 Platform breakdown
    const platformBreakdown = await pool.query(`
      SELECT 
        LOWER(share_platform) AS platform,
        COUNT(*)::int AS count
      FROM share_events
      GROUP BY share_platform
      ORDER BY count DESC;
    `);

    // 👥 Top active members (by shares + activity)
    const topMembers = await pool.query(`
      SELECT 
        m.member_id,
        m.display_name,
        m.email,
        COUNT(s.*)::int AS shares_count
      FROM members m
      LEFT JOIN share_events s ON m.member_id = s.member_id
      GROUP BY m.member_id, m.display_name, m.email
      ORDER BY shares_count DESC
      LIMIT 10;
    `);

    // 🪶 Recent activity (shares + reviews combined)
    const recentActivity = await pool.query(`
      SELECT * FROM (
        SELECT 
          s.member_id,
          m.display_name,
          'share' AS category,
          s.share_platform AS context,
          s.share_url AS link,
          s.created_at
        FROM share_events s
        JOIN members m ON m.member_id = s.member_id

        UNION ALL

        SELECT 
          v.member_id,
          m.display_name,
          'review' AS category,
          v.business_name AS context,
          v.video_url AS link,
          v.created_at
        FROM video_reviews v
        JOIN members m ON m.member_id = v.member_id
      ) AS combined
      ORDER BY created_at DESC
      LIMIT 25;
    `);

    // 🧮 Compose response
    res.json({
      ok: true,
      stats: {
        members_total: parseInt(members.rows[0]?.count || 0),
        shares_total: parseInt(shares.rows[0]?.count || 0),
        stars_total: parseInt(stars.rows[0]?.total || 0),
        bd_total: parseInt(bd.rows[0]?.total || 0),
      },
      topMembers: topMembers.rows,
      platformBreakdown: platformBreakdown.rows,
      recentActivity: recentActivity.rows,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /admin/overview error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧾 GET /admin/members — list all members
router.get("/members", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        member_id,
        display_name,
        email,
        role,
        created_at,
        last_active
      FROM members
      ORDER BY created_at DESC;
    `);

    res.json({ ok: true, members: result.rows });
  } catch (err) {
    console.error("❌ /admin/members error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧾 GET /admin/activity — latest system actions
router.get("/activity", async (_req, res) => {
  try {
    const log = await pool.query(`
      SELECT 
        a.id,
        a.category,
        a.details,
        m.display_name,
        a.created_at
      FROM activity_log a
      JOIN members m ON m.member_id = a.member_id
      ORDER BY a.created_at DESC
      LIMIT 50;
    `);

    res.json({ ok: true, activity: log.rows });
  } catch (err) {
    console.error("❌ /admin/activity error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
