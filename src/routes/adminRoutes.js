import { Router } from "express";
import { query } from "../db.js";

const r = Router();

// ✅ Auth middleware: only admins can use this
r.use(async (req, res, next) => {
  if (!req.user) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });

  const result = await query("SELECT role FROM members WHERE member_id=$1", [req.user.id]);
  const role = result.rows[0]?.role || "user";

  if (role !== "admin") {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  next();
});

// 👥 View all members
r.get("/members", async (_req, res) => {
  const members = await query(`
    SELECT member_id, display_name, email, role, created_at, last_active
    FROM members ORDER BY created_at DESC
  `);
  res.json({ ok: true, members: members.rows });
});

// 📊 View system summary
r.get("/overview", async (_req, res) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM members) AS total_members,
      (SELECT COUNT(*) FROM share_events) AS total_shares,
      (SELECT COUNT(*) FROM video_reviews) AS total_reviews,
      (SELECT COALESCE(SUM(delta),0) FROM star_transactions) AS total_stars,
      (SELECT COALESCE(SUM(delta),0) FROM bd_transactions) AS total_bd
  `);
  res.json({ ok: true, overview: stats.rows[0] });
});

// 🧾 View recent activity
r.get("/activity", async (_req, res) => {
  const log = await query(`
    SELECT a.id, a.category, a.details, m.display_name, a.created_at
    FROM activity_log a
    JOIN members m ON m.member_id = a.member_id
    ORDER BY a.created_at DESC
    LIMIT 50
  `);
  res.json({ ok: true, activity: log.rows });
});

// 🗨️ View recent notifications
r.get("/notifications", async (_req, res) => {
  const n = await query(`
    SELECT n.*, m.display_name
    FROM notifications n
    JOIN members m ON m.member_id = n.member_id
    ORDER BY n.created_at DESC
    LIMIT 50
  `);
  res.json({ ok: true, notifications: n.rows });
});

export default r;
