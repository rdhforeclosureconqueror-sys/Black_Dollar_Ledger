import { Router } from "express";
import { query } from "./db.js";

const r = Router();

function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// Approve a pending video review and award stars (1–5)
r.post("/approve-video/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const award = Math.max(1, Math.min(Number(req.body.award ?? 0), 5)); // allow override 1..5

  const vr = await query(`SELECT * FROM video_reviews WHERE id=$1`, [id]);
  if (!vr.rows[0]) return res.status(404).json({ ok: false, error: "Not found" });

  const item = vr.rows[0];
  if (item.status !== "pending") {
    return res.status(400).json({ ok: false, error: `Already ${item.status}` });
  }

  await query(`UPDATE video_reviews SET status='approved', approved_stars=$1 WHERE id=$2`, [award, id]);

  await query(
    `INSERT INTO star_transactions (member_id, delta, reason)
     VALUES ($1,$2,$3)`,
    [item.member_id, award, `Approved Black Excellence video review: ${item.business_name}`]
  );

  res.json({ ok: true, id, awarded_stars: award });
});

// Create a payout code for a winner (you put $100 “somewhere”, code unlocks it)
r.post("/payout/create", requireAdmin, async (req, res) => {
  const { contest_id, member_id, amount_usd } = req.body;

  if (!contest_id || !member_id || !amount_usd) {
    return res.status(400).json({ ok: false, error: "contest_id, member_id, amount_usd required" });
  }

  // simple code
  const code = `SIMBA-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  await query(
    `INSERT INTO payouts (contest_id, member_id, amount_usd, payout_code, status)
     VALUES ($1,$2,$3,$4,'issued')`,
    [contest_id, member_id, amount_usd, code]
  );

  res.json({ ok: true, payout_code: code });
});

// Winner redeems code (you can later connect this to CashApp/Stripe/Gift card provider)
r.post("/payout/redeem", async (req, res) => {
  const { payout_code } = req.body;
  if (!payout_code) return res.status(400).json({ ok: false, error: "payout_code required" });

  const p = await query(`SELECT * FROM payouts WHERE payout_code=$1`, [payout_code]);
  if (!p.rows[0]) return res.status(404).json({ ok: false, error: "Invalid code" });

  if (p.rows[0].status !== "issued") {
    return res.status(400).json({ ok: false, error: "Code already redeemed or canceled" });
  }

  await query(`UPDATE payouts SET status='redeemed', redeemed_at=now() WHERE payout_code=$1`, [payout_code]);

  res.json({
    ok: true,
    message: "Redeemed. Admin completes payout delivery method (manual today; automation later).",
    amount_usd: p.rows[0].amount_usd
  });
});

export default r;
