import express from "express";
import { pool } from "./db.js";

export const ledgerRoutes = express.Router();

// helper: safe member lookup (for now by email; later use auth uid)
async function getOrCreateMember({ email, display_name }) {
  const existing = await pool.query(
    "select * from members where email = $1 limit 1",
    [email]
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await pool.query(
    "insert into members(email, display_name) values($1,$2) returning *",
    [email, display_name || email?.split("@")[0] || "Member"]
  );
  return created.rows[0];
}

// GET balances + rank
ledgerRoutes.get("/me", async (req, res) => {
  // TEMP: pass email in header while you build (replace with auth later)
  const email = req.header("x-member-email");
  if (!email) return res.status(400).json({ error: "Missing x-member-email" });

  const member = await getOrCreateMember({ email });
  res.json({
    member_id: member.member_id,
    email: member.email,
    display_name: member.display_name,
    star_balance: member.star_balance,
    bd_balance: member.bd_balance,
    rank: member.rank,
  });
});

// Log a share (counts toward 3=1 STAR)
ledgerRoutes.post("/share", async (req, res) => {
  const email = req.header("x-member-email");
  if (!email) return res.status(400).json({ error: "Missing x-member-email" });

  const { platform, post_type, post_id } = req.body;
  if (!platform || !post_type || !post_id)
    return res.status(400).json({ error: "platform, post_type, post_id required" });

  const member = await getOrCreateMember({ email });

  await pool.query(
    "insert into share_logs(member_id, platform, post_type, post_id) values($1,$2,$3,$4)",
    [member.member_id, platform, post_type, post_id]
  );

  res.json({ ok: true });
});

// Submit video review for manual scoring (1-5 stars)
ledgerRoutes.post("/video-review/submit", async (req, res) => {
  const email = req.header("x-member-email");
  if (!email) return res.status(400).json({ error: "Missing x-member-email" });

  const member = await getOrCreateMember({ email });

  const { business_name, address, service_type, video_url, checklist } = req.body;

  // store as PENDING; admin will approve and set stars
  const tx = await pool.query(
    `insert into star_transactions(member_id, type, category_code, stars_delta, status, proof_url, metadata)
     values($1,'EARN','VIDEO_REVIEW',0,'PENDING',$2,$3)
     returning *`,
    [
      member.member_id,
      video_url || null,
      JSON.stringify({ business_name, address, service_type, checklist }),
    ]
  );

  res.json({ ok: true, tx: tx.rows[0] });
});
