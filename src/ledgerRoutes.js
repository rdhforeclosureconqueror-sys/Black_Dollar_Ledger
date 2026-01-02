import { Router } from "express";
import { query } from "./db.js";
import { EarnShareSchema, ReviewVideoSchema } from "./utils/validation.js";

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

// --------------------------------------
// 1) Track a Share Event
// POST /ledger/share
// --------------------------------------
r.post("/share", async (req, res) => {
  const parsed = EarnShareSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  try {
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
      message: "Share logged. Stars are awarded by the share job (3 shares = 1 STAR).",
    });
  } catch (err) {
    console.error("Error in /ledger/share:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 2) Submit Review Video
// POST /ledger/review-video
// --------------------------------------
r.post("/review-video", async (req, res) => {
  const parsed = ReviewVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  try {
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
  } catch (err) {
    console.error("Error in /ledger/review-video:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 3) Get Balance (Preferred)
// GET /ledger/balance
// --------------------------------------
r.get("/balance", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error in /ledger/balance:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 4) Back-compat route (optional)
// GET /ledger/balance/:id
// --------------------------------------
r.get("/balance/:id", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error in /ledger/balance/:id:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------------------------
// 5) Unified Activity Feed
// GET /ledger/activity
// --------------------------------------
r.get("/activity", async (req, res) => {
  try {
    const memberId = await upsertMemberFromUser(req.user);

    const stars = await query(
      `
      SELECT
        id,
        member_id,
        delta,
        reason,
        created_at,
        'STAR' AS type
      FROM star_transactions
      WHERE member_id=$1
      ORDER BY created_at DESC
      LIMIT 25
      `,
      [memberId]
    );

    const bd = await query(
      `
      SELECT
        id,
        member_id,
        delta,
        reason,
        created_at,
        'BD' AS type
      FROM bd_transactions
      WHERE member_id=$1
      ORDER BY created_at DESC
      LIMIT 25
      `,
      [memberId]
    );

    const merged = [...stars.rows, ...bd.rows]
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 50)
      .map((tx) => ({
        id: `${tx.type}_${tx.id}`,
        type: tx.type,
        delta: Number(tx.delta),
        desc:
          tx.reason ||
          (tx.type === "STAR"
            ? "STAR earned through community contribution"
            : "Black Dollar transaction"),
        status: tx.delta >= 0 ? "EARNED" : "SPENT",
        created_at: tx.created_at,
      }));

    res.json({ ok: true, items: merged });
  } catch (err) {
    console.error("Error in /ledger/activity:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to load activity feed",
      details: err.message,
    });
  }
});

export default r;
