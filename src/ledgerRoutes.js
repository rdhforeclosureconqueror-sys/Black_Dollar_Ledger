import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";
import { broadcastToAdmins } from "./utils/wsBroadcast.js"; // ✅ add this util

const r = Router();

/**
 * ✅ DB schema reference:
 * members.member_id (TEXT PK)
 * star_transactions.member_id -> members(member_id)
 * bd_transactions.member_id -> members(member_id)
 *
 * All auth must come from req.user (session cookie).
 */

// --------------------------------------
// Utility: ensure member exists
// --------------------------------------
async function upsertMemberFromUser(user) {
  const id = user?.id || user?.googleId || user?.email;
  const provider = user?.provider || "google";
  if (!id) throw new Error("Missing user.id (cannot upsert member).");

  await query(
    `
    INSERT INTO members (member_id, provider, display_name, email, photo)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (member_id) DO UPDATE SET
      provider = EXCLUDED.provider,
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

    const insert = await query(
      `
      INSERT INTO share_events (member_id, share_platform, share_url, proof_url, awarded)
      VALUES ($1,$2,$3,$4,false)
      RETURNING id, created_at
      `,
      [memberId, share_platform, share_url || null, proof_url || null]
    );

    // 🔔 Notify admin dashboard
    broadcastToAdmins({
      type: "share_event",
      member_id: memberId,
      share_platform,
      share_url,
      created_at: insert.rows[0].created_at,
    });

    res.json({
      ok: true,
      member_id: memberId,
      message: "✅ Share logged. Stars are awarded automatically (3 shares = 1 STAR).",
    });
  } catch (err) {
    console.error("Error in /ledger/share:", err);
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

    const insert = await query(
      `
      INSERT INTO video_reviews
        (member_id, business_name, business_address, service_type, what_makes_special,
         video_url, self_score, checklist_json, status)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
      RETURNING id, created_at
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

    // 🔔 Notify admin dashboard
    broadcastToAdmins({
      type: "review_submitted",
      member_id: memberId,
      business_name: d.business_name,
      video_url: d.video_url,
      score,
      created_at: insert.rows[0].created_at,
    });

    res.json({
      ok: true,
      member_id: memberId,
      status: "pending",
      message: "Review submitted and pending approval.",
    });
  } catch (err) {
    console.error("Error in /ledger/review-video:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 3️⃣ Balance + 4️⃣ Backcompat
// --------------------------------------
// (keep as-is from your current version, they’re perfect)

// --------------------------------------
// 5️⃣ Activity Feed (same as before)
// --------------------------------------

export default r;
