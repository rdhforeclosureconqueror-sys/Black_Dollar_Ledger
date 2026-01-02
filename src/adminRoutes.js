// src/adminRoutes.js
import { Router } from "express";
import { query } from "./db.js";

const r = Router();

// Restrict access to your email or set of admins
function requireAdmin(req, res, next) {
  const adminEmails = ["rashad@simbawaujamaa.com", "admin@simbawaujamaa.com"];
  if (req.user && adminEmails.includes(req.user.email)) return next();
  return res.status(403).json({ ok: false, error: "ADMIN_ONLY" });
}

// =====================
// Admin Overview Stats
// =====================
r.get("/overview", requireAdmin, async (_req, res) => {
  try {
    const members = await query("SELECT COUNT(*) FROM members");
    const shares = await query("SELECT COUNT(*) FROM share_events");
    const stars = await query("SELECT COALESCE(SUM(delta),0) FROM star_transactions");
    const bd = await query("SELECT COALESCE(SUM(delta),0) FROM bd_transactions");

    res.json({
      ok: true,
      member_count: Number(members.rows[0].count),
      total_shares: Number(shares.rows[0].count),
      total_stars: Number(stars.rows[0].coalesce),
      total_bd: Number(bd.rows[0].coalesce),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =====================
// Members List
// =====================
r.get("/members", requireAdmin, async (_req, res) => {
  const result = await query(`
    SELECT 
      m.member_id,
      m.display_name,
      m.email,
      m.created_at,
      COALESCE(SUM(s.delta), 0) AS stars,
      COALESCE(SUM(b.delta), 0) AS bd
    FROM members m
    LEFT JOIN star_transactions s ON s.member_id = m.member_id
    LEFT JOIN bd_transactions b ON b.member_id = m.member_id
    GROUP BY m.member_id, m.display_name, m.email, m.created_at
    ORDER BY stars DESC;
  `);
  res.json({ ok: true, members: result.rows });
});

// =====================
// Share Log
// =====================
r.get("/shares", requireAdmin, async (_req, res) => {
  const result = await query(`
    SELECT member_id, share_platform, share_url, proof_url, created_at
    FROM share_events
    ORDER BY created_at DESC
    LIMIT 100;
  `);
  res.json({ ok: true, shares: result.rows });
});

// =====================
// Review Videos
// =====================
r.get("/reviews", requireAdmin, async (_req, res) => {
  const result = await query(`
    SELECT id, member_id, business_name, service_type, video_url, status, created_at
    FROM video_reviews
    ORDER BY created_at DESC;
  `);
  res.json({ ok: true, reviews: result.rows });
});

// =====================
// Approve Video Review
// =====================
r.post("/approve-video/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { stars = 3 } = req.body;

  const review = await query("SELECT member_id FROM video_reviews WHERE id=$1", [id]);
  if (!review.rows.length) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  const memberId = review.rows[0].member_id;

  await query("UPDATE video_reviews SET status='approved' WHERE id=$1", [id]);
  await query(
    "INSERT INTO star_transactions (member_id, delta, reason) VALUES ($1,$2,$3)",
    [memberId, stars, "Review video approved"]
  );

  res.json({ ok: true, message: `Approved review ${id} and awarded ${stars} STARs` });
});

// =====================
// Issue Black Dollars
// =====================
r.post("/issue-bd", requireAdmin, async (req, res) => {
  const { member_id, amount, reason } = req.body;
  if (!member_id || !amount)
    return res.status(400).json({ ok: false, error: "Missing required fields" });

  await query(
    "INSERT INTO bd_transactions (member_id, delta, reason) VALUES ($1,$2,$3)",
    [member_id, amount, reason || "Admin grant"]
  );
  res.json({ ok: true, message: `Issued ${amount} BD to ${member_id}` });
});

// =====================
// Activity Stream
// =====================
r.get("/activity-stream", requireAdmin, async (_req, res) => {
  const result = await query(`
    SELECT 'STAR' AS type, member_id, delta, reason, created_at FROM star_transactions
    UNION ALL
    SELECT 'BD' AS type, member_id, delta, reason, created_at FROM bd_transactions
    ORDER BY created_at DESC
    LIMIT 100;
  `);
  res.json({ ok: true, items: result.rows });
});

export default r;
