import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";

const r = Router();

// Build a canonical member object from req.user (passport session)
function memberFromReq(req) {
  const u = req.user || {};
  return {
    id: u.googleId || u.id,              // primary identity key
    provider: u.provider || "google",    // should always be present
    display_name: u.displayName || null,
    email: u.email || null,
    photo: u.photo || null,
  };
}

// Ensure member exists AND keep profile fields fresh
async function ensureMember(member) {
  if (!member?.id) throw new Error("MISSING_MEMBER_ID");
  if (!member?.provider) throw new Error("MISSING_PROVIDER");

  await query(
    `INSERT INTO members (id, provider, display_name, email, photo)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       provider = EXCLUDED.provider,
       display_name = COALESCE(EXCLUDED.display_name, members.display_name),
       email = COALESCE(EXCLUDED.email, members.email),
       photo = COALESCE(EXCLUDED.photo, members.photo)`,
    [member.id, member.provider, member.display_name, member.email, member.photo]
  );
}

// 1) Track a share click/event (3 shares = 1 STAR)
r.post("/share", async (req, res) => {
  const parsed = EarnShareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const member = memberFromReq(req);
  await ensureMember(member);

  const { share_platform, share_url, proof_url } = parsed.data;

  await query(
    `INSERT INTO share_events (member_id, share_platform, share_url, proof_url)
     VALUES ($1, $2, $3, $4)`,
    [member.id, share_platform, share_url || null, proof_url || null]
  );

  res.json({
    ok: true,
    message: "Share logged. Stars are awarded by the shares job (3 shares = 1 STAR).",
  });
});

// 2) Submit “review video” task (pending admin approval)
r.post("/review-video", async (req, res) => {
  const parsed = ReviewVideoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const member = memberFromReq(req);
  await ensureMember(member);

  const d = parsed.data;

  const score = Object.values(d.checklist).filter(Boolean).length;

  await query(
    `INSERT INTO video_reviews
     (member_id, business_name, business_address, service_type, what_makes_special, video_url, self_score, checklist_json, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
    [
      member.id,
      d.business_name,
      d.business_address,
      d.service_type,
      d.what_makes_special,
      d.video_url,
      score,
      JSON.stringify(d.checklist),
    ]
  );

  res.json({
    ok: true,
    status: "pending",
    self_score: score,
    message:
      "Submitted for approval. If approved, STAR award can match score (1–5) or be adjusted by admin.",
  });
});

// 3) Balance (NO :id param — uses logged-in user)
r.get("/balance", async (req, res) => {
  const member = memberFromReq(req);
  await ensureMember(member);

  const stars = await query(
    `SELECT COALESCE(SUM(delta),0) AS stars
     FROM star_transactions WHERE member_id=$1`,
    [member.id]
  );

  const bd = await query(
    `SELECT COALESCE(SUM(delta),0) AS bd
     FROM bd_transactions WHERE member_id=$1`,
    [member.id]
  );

  res.json({
    ok: true,
    member_id: member.id,
    stars: Number(stars.rows[0].stars),
    bd: Number(bd.rows[0].bd),
  });
});

export default r;
