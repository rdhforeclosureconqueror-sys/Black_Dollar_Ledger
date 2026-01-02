// src/ledgerRoutes.js
import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";
import { broadcastToAdmins } from "./utils/wsBroadcast.js";

const r = Router();

// --------------------------------------
// Utility: ensure member exists
// --------------------------------------
async function upsertMemberFromUser(user) {
  const id = user?.id || user?.googleId || user?.email;
  const provider = user?.provider || "google";
  if (!id) throw new Error("Missing user.id");

  await query(
    `
    INSERT INTO members (member_id, provider, display_name, email, photo)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (member_id) DO UPDATE
      SET provider = EXCLUDED.provider,
          display_name = COALESCE(EXCLUDED.display_name, members.display_name),
          email = COALESCE(EXCLUDED.email, members.email),
          photo = COALESCE(EXCLUDED.photo, members.photo)
  `,
    [id, provider, user?.displayName ?? null, user?.email ?? null, user?.photo ?? null]
  );
  return id;
}

// --------------------------------------
// 1️⃣ Log a Share Event
// --------------------------------------
r.post("/share", async (req, res) => {
  const parsed = EarnShareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  try {
    const memberId = await upsertMemberFromUser(req.user);
    const { share_platform, share_url, proof_url } = parsed.data;

    const result = await query(
      `INSERT INTO share_events (member_id, share_platform, share_url, proof_url, awarded)
       VALUES ($1,$2,$3,$4,false)
       RETURNING id, created_at;`,
      [memberId, share_platform, share_url || null, proof_url || null]
    );

    broadcastToAdmins({
      type: "share_event",
      member_id: memberId,
      share_platform,
      share_url,
      created_at: result.rows[0].created_at,
    });

    res.json({ ok: true, message: "✅ Share logged. (3 shares = 1 STAR)" });
  } catch (err) {
    console.error("Error /ledger/share:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 2️⃣ Submit Review Video
// --------------------------------------
r.post("/review-video", async (req, res) => {
  const parsed = ReviewVideoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  try {
    const memberId = await upsertMemberFromUser(req.user);
    const d = parsed.data;
    const score = Object.values(d.checklist || {}).filter(Boolean).length;

    const result = await query(
      `INSERT INTO video_reviews
        (member_id, business_name, business_address, service_type, what_makes_special,
         video_url, self_score, checklist_json, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING id, created_at;`,
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

    broadcastToAdmins({
      type: "review_submitted",
      member_id: memberId,
      business_name: d.business_name,
      video_url: d.video_url,
      score,
      created_at: result.rows[0].created_at,
    });

    res.json({ ok: true, message: "📹 Review submitted for approval." });
  } catch (err) {
    console.error("Error /ledger/review-video:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 3️⃣ Get Balance
// --------------------------------------
r.get("/balance", async (req, res) => {
  try {
    const memberId = await upsertMemberFromUser(req.user);

    const stars = await query(
      `SELECT COALESCE(SUM(delta),0) AS stars FROM star_transactions WHERE member_id=$1`,
      [memberId]
    );

    const bd = await query(
      `SELECT COALESCE(SUM(delta),0) AS bd FROM bd_transactions WHERE member_id=$1`,
      [memberId]
    );

    res.json({
      ok: true,
      member_id: memberId,
      stars: Number(stars.rows[0].stars),
      bd: Number(bd.rows[0].bd),
    });
  } catch (err) {
    console.error("Error /ledger/balance:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default r;
