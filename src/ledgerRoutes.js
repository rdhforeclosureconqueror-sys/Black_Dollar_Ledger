// src/ledgerRoutes.js
import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";

const r = Router();

/**
 * ✅ Your DB uses:
 * - members.id (text PK)  [NOT NULL]
 * - members.provider      [NOT NULL]
 * and all other tables use member_id as FK.
 */

// Upsert member (provider is REQUIRED by your schema)
async function upsertMemberFromUser(user) {
  const id = user?.id || user?.googleId || user?.email;
  const provider = user?.provider || "google";

  if (!id) throw new Error("Missing user.id (cannot upsert member).");

  await query(
    `
    INSERT INTO members (id, provider, display_name, email, photo)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET
      provider = EXCLUDED.provider,
      display_name = COALESCE(EXCLUDED.display_name, members.display_name),
      email = COALESCE(EXCLUDED.email, members.email),
      photo = COALESCE(EXCLUDED.photo, members.photo)
    `,
    [
      id,
      provider,
      user?.displayName ?? null,
      user?.email ?? null,
      user?.photo ?? null,
    ]
  );

  return id;
}

// -------------------------
// 1) Track a share event
// -------------------------
r.post("/share", async (req, res) => {
  const parsed = EarnShareSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  // ✅ use authenticated user as the member (prevents spoofing)
  const memberId = await upsertMemberFromUser(req.user);

  const { share_platform, share_url, proof_url } = parsed.data;

  await query(
    `
    INSERT INTO share_events (member_id, share_platform, share_url, proof_url)
    VALUES ($1,$2,$3,$4)
    `,
    [memberId, share_platform, share_url || null, proof_url || null]
  );

  res.json({
    ok: true,
    member_id: memberId,
    message: "Share logged. Stars are awarded by the shares job (3 shares = 1 STAR).",
  });
});

// -------------------------
// 2) Submit “review video”
// -------------------------
r.post("/review-video", async (req, res) => {
  const parsed = ReviewVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const memberId = await upsertMemberFromUser(req.user);
  const d = parsed.data;

  const score = Object.values(d.checklist || {}).filter(Boolean).length;

  await query(
    `
    INSERT INTO video_reviews
      (member_id, business_name, business_address, service_type, what_makes_special,
       video_url, self_score, checklist_json, status)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
    `,
    [
      memberId,
      d.business_name,
      d.business_address,
      d.service_type,
      d.what_makes_special,
      d.video_url,
      score,
      JSON.stringify(d.checklist || {}),
    ]
  );

  res.json({
    ok: true,
    member_id: memberId,
    status: "pending",
    self_score: score,
    message:
      "Submitted for approval. If approved, STAR award can match score (1–5) or be adjusted by admin.",
  });
});

// -------------------------
// 3) Balance (RECOMMENDED)
// GET /ledger/balance
// -------------------------
r.get("/balance", async (req, res) => {
  const memberId = await upsertMemberFromUser(req.user);

  const stars = await query(
    `SELECT COALESCE(SUM(delta),0) AS stars
     FROM star_transactions
     WHERE member_id=$1`,
    [memberId]
  );

  const bd = await query(
    `SELECT COALESCE(SUM(delta),0) AS bd
     FROM bd_transactions
     WHERE member_id=$1`,
    [memberId]
  );

  res.json({
    ok: true,
    member_id: memberId,
    stars: Number(stars.rows[0].stars),
    bd: Number(bd.rows[0].bd),
  });
});

// -------------------------
// 4) Balance (BACKCOMPAT)
// GET /ledger/balance/:id
// -------------------------
r.get("/balance/:id", async (req, res) => {
  // Optional safety: only allow viewing own balance
  const meId = await upsertMemberFromUser(req.user);
  const { id } = req.params;

  if (id !== meId) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  const stars = await query(
    `SELECT COALESCE(SUM(delta),0) AS stars
     FROM star_transactions
     WHERE member_id=$1`,
    [id]
  );

  const bd = await query(
    `SELECT COALESCE(SUM(delta),0) AS bd
     FROM bd_transactions
     WHERE member_id=$1`,
    [id]
  );

  res.json({
    ok: true,
    member_id: id,
    stars: Number(stars.rows[0].stars),
    bd: Number(bd.rows[0].bd),
  });
});

export default r;
