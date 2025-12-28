import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";

const r = Router();

// Helper: ensure member exists
async function ensureMember(member_id) {
  await query(
    `INSERT INTO members (member_id) VALUES ($1)
     ON CONFLICT (member_id) DO NOTHING`,
    [member_id]
  );
}

// 1) Track a share click/event (3 shares = 1 STAR)
r.post("/share", async (req, res) => {
  const parsed = EarnShareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { member_id, share_platform, share_url, proof_url } = parsed.data;
  await ensureMember(member_id);

  await query(
    `INSERT INTO share_events (member_id, share_platform, share_url, proof_url)
     VALUES ($1,$2,$3,$4)`,
    [member_id, share_platform, share_url || null, proof_url || null]
  );

  res.json({ ok: true, message: "Share logged. Stars are awarded by the shares job (3 shares = 1 STAR)." });
});

// 2) Submit “review video” task (pending admin approval)
r.post("/review-video", async (req, res) => {
  const parsed = ReviewVideoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;
  await ensureMember(d.member_id);

  // self-score = number of true items (0–5)
  const score =
    Object.values(d.checklist).filter(Boolean).length;

  await query(
    `INSERT INTO video_reviews
     (member_id, business_name, business_address, service_type, what_makes_special, video_url, self_score, checklist_json, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
    [
      d.member_id,
      d.business_name,
      d.business_address,
      d.service_type,
      d.what_makes_special,
      d.video_url,
      score,
      JSON.stringify(d.checklist)
    ]
  );

  res.json({
    ok: true,
    status: "pending",
    self_score: score,
    message: "Submitted for approval. If approved, STAR award can match score (1–5) or be adjusted by admin."
  });
});

// 3) Balance
r.get("/balance/:member_id", async (req, res) => {
  const { member_id } = req.params;
  await ensureMember(member_id);

  const stars = await query(
    `SELECT COALESCE(SUM(delta),0) AS stars
     FROM star_transactions WHERE member_id=$1`,
    [member_id]
  );

  const bd = await query(
    `SELECT COALESCE(SUM(delta),0) AS bd
     FROM bd_transactions WHERE member_id=$1`,
    [member_id]
  );

  res.json({
    member_id,
    stars: Number(stars.rows[0].stars),
    bd: Number(bd.rows[0].bd)
  });
});

export default r;
