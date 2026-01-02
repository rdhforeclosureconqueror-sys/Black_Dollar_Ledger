// src/routes/adminRoutes.js (BACKEND)
import { Router } from "express";
import { query } from "../db.js"; // or adjust if your query function is in another file

const r = Router();

// Middleware already applied in server.js: requireAuth + requireAdmin
// So this file assumes the user is admin.

// ---------------------------------------------
// 1️⃣ Admin Overview Stats
// ---------------------------------------------
r.get("/overview", async (_req, res) => {
  try {
    const members = await query("SELECT COUNT(*) FROM members");
    const shares = await query("SELECT COUNT(*) FROM share_events");
    const stars = await query("SELECT COALESCE(SUM(delta),0) FROM star_transactions");
    const bd = await query("SELECT COALESCE(SUM(delta),0) FROM bd_transactions");

    const platformBreakdown = await query(`
      SELECT share_platform AS platform, COUNT(*) AS count
      FROM share_events
      GROUP BY share_platform
      ORDER BY count DESC;
    `);

    const recentActivity = await query(`
      SELECT m.display_name, 'Share' AS category, s.created_at
      FROM share_events s
      JOIN members m ON s.member_id = m.member_id
      UNION ALL
      SELECT m.display_name, 'Review Video' AS category, v.created_at
      FROM video_reviews v
      JOIN members m ON v.member_id = m.member_id
      ORDER BY created_at DESC
      LIMIT 20;
    `);

    res.json({
      ok: true,
      stats: {
        members_total: Number(members.rows[0].count),
        shares_total: Number(shares.rows[0].count),
        stars_total: Number(stars.rows[0].coalesce),
        bd_total: Number(bd.rows[0].coalesce),
      },
      platformBreakdown: platformBreakdown.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error("Error /admin/overview:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------
// 2️⃣ Members List
// ---------------------------------------------
r.get("/members", async (_req, res) => {
  try {
    const members = await query(`
      SELECT 
        m.member_id,
        m.display_name,
        m.email,
        m.role,
        m.created_at,
        COALESCE(SUM(s.delta), 0) AS stars,
        COALESCE(SUM(b.delta), 0) AS bd
      FROM members m
      LEFT JOIN star_transactions s ON s.member_id = m.member_id
      LEFT JOIN bd_transactions b ON b.member_id = m.member_id
      GROUP BY m.member_id, m.display_name, m.email, m.role, m.created_at
      ORDER BY m.created_at DESC;
    `);
    res.json({ ok: true, members: members.rows });
  } catch (err) {
    console.error("Error /admin/members:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------
// 3️⃣ Review Management
// ---------------------------------------------
r.get("/reviews", async (_req, res) => {
  try {
    const reviews = await query(`
      SELECT 
        v.id,
        v.member_id,
        m.display_name,
        v.business_name,
        v.service_type,
        v.video_url,
        v.status,
        v.created_at
      FROM video_reviews v
      JOIN members m ON m.member_id = v.member_id
      ORDER BY v.created_at DESC;
    `);
    res.json({ ok: true, reviews: reviews.rows });
  } catch (err) {
    console.error("Error /admin/reviews:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

r.post("/approve-video/:id", async (req, res) => {
  const { id } = req.params;
  const { stars = 3 } = req.body;

  try {
    const review = await query("SELECT member_id FROM video_reviews WHERE id=$1", [id]);
    if (!review.rows.length)
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const memberId = review.rows[0].member_id;

    await query("UPDATE video_reviews SET status='approved' WHERE id=$1", [id]);
    await query(
      "INSERT INTO star_transactions (member_id, delta, reason) VALUES ($1,$2,$3)",
      [memberId, stars, "Review video approved by admin"]
    );

    res.json({ ok: true, message: `✅ Approved review ${id}, awarded ${stars} STARs` });
  } catch (err) {
    console.error("Error approving review:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------
// 4️⃣ Issue BD (Black Dollars)
// ---------------------------------------------
r.post("/issue-bd", async (req, res) => {
  const { member_id, amount, reason } = req.body;
  if (!member_id || !amount)
    return res.status(400).json({ ok: false, error: "Missing required fields" });

  try {
    await query(
      "INSERT INTO bd_transactions (member_id, delta, reason) VALUES ($1,$2,$3)",
      [member_id, amount, reason || "Admin grant"]
    );
    res.json({ ok: true, message: `💰 Issued ${amount} BD to ${member_id}` });
  } catch (err) {
    console.error("Error issuing BD:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
