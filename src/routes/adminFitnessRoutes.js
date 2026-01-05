// ✅ src/routes/adminFitnessRoutes.js
import { Router } from "express";
import { pool } from "../server.js";

const r = Router();

// 📊 /admin/fitness/overview — system-wide fitness + study summary
r.get("/overview", async (_req, res) => {
  try {
    const fitness = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type='workout') AS workouts,
        COUNT(*) FILTER (WHERE event_type='water') AS waters
      FROM fitness_events;
    `);

    const study = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE type='journal') AS journals,
        COUNT(*) FILTER (WHERE type='share') AS shares
      FROM study_events;
    `);

    const language = await pool.query(`
      SELECT COUNT(*) AS practices FROM language_events;
    `);

    const xp = await pool.query(`SELECT COALESCE(SUM(delta),0) AS xp_total FROM xp_transactions;`);
    const stars = await pool.query(`SELECT COALESCE(SUM(delta),0) AS stars_total FROM star_transactions;`);

    res.json({
      ok: true,
      data: {
        workouts: parseInt(fitness.rows[0].workouts),
        waters: parseInt(fitness.rows[0].waters),
        journals: parseInt(study.rows[0].journals),
        shares: parseInt(study.rows[0].shares),
        practices: parseInt(language.rows[0].practices),
        xp_total: parseInt(xp.rows[0].xp_total),
        stars_total: parseInt(stars.rows[0].stars_total),
      },
    });
  } catch (err) {
    console.error("❌ Admin fitness overview error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧍 Member-level breakdown
r.get("/members", async (_req, res) => {
  try {
    const rows = await pool.query(`
      SELECT
        m.member_id,
        m.display_name,
        m.email,
        COALESCE(SUM(x.delta), 0) AS xp,
        COALESCE(SUM(s.delta), 0) AS stars,
        COALESCE(f.workouts, 0) AS workouts,
        COALESCE(f.waters, 0) AS waters,
        COALESCE(st.journals, 0) AS journals,
        COALESCE(st.shares, 0) AS shares,
        COALESCE(l.practices, 0) AS practices
      FROM members m
      LEFT JOIN xp_transactions x ON x.member_id = m.member_id
      LEFT JOIN star_transactions s ON s.member_id = m.member_id
      LEFT JOIN (
        SELECT member_id,
          COUNT(*) FILTER (WHERE event_type='workout') AS workouts,
          COUNT(*) FILTER (WHERE event_type='water') AS waters
        FROM fitness_events GROUP BY member_id
      ) f ON f.member_id = m.member_id
      LEFT JOIN (
        SELECT member_id,
          COUNT(*) FILTER (WHERE type='journal') AS journals,
          COUNT(*) FILTER (WHERE type='share') AS shares
        FROM study_events GROUP BY member_id
      ) st ON st.member_id = m.member_id
      LEFT JOIN (
        SELECT member_id, COUNT(*) AS practices FROM language_events GROUP BY member_id
      ) l ON l.member_id = m.member_id
      GROUP BY m.member_id, m.display_name, m.email, f.workouts, f.waters, st.journals, st.shares, l.practices
      ORDER BY xp DESC, stars DESC;
    `);

    res.json({ ok: true, members: rows.rows });
  } catch (err) {
    console.error("❌ Admin fitness members error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
