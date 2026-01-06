// src/jobs/awardStarsFromShares.js
import { query } from "../db.js";
import { notifyMember, broadcastToAdmins } from "../../utils/wsBroadcast.js";

/**
 * 🏆 Award 1 STAR for every 3 unawarded shares
 */
export async function awardStarsFromSharesJob(pool) {
  try {
    const pending = await query(`
      SELECT member_id, COUNT(*) AS share_count
      FROM share_events
      WHERE awarded IS FALSE OR awarded IS NULL
      GROUP BY member_id;
    `);

    const newAwards = [];

    for (const row of pending.rows) {
      const count = Number(row.share_count);
      const starsToAward = Math.floor(count / 3);
      if (starsToAward <= 0) continue;

      // Award stars
      await query(
        `INSERT INTO star_transactions (member_id, delta, reason)
         VALUES ($1, $2, $3)`,
        [row.member_id, starsToAward, "3 verified shares = 1 STAR"]
      );

      // Mark shares as awarded
      await query(
        `UPDATE share_events
         SET awarded = TRUE
         WHERE member_id = $1
         AND awarded IS FALSE
         LIMIT $2`,
        [row.member_id, starsToAward * 3]
      );

      newAwards.push({ member_id: row.member_id, delta: starsToAward });

      // 📨 Notify the member
      notifyMember(row.member_id, {
        type: "star_award",
        message: `⭐ Congrats! You earned ${starsToAward} STAR for your shares!`,
      });

      // 🦁 Notify admins
      broadcastToAdmins({
        type: "star_award_event",
        member_id: row.member_id,
        delta: starsToAward,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`🏁 STAR share job complete (${newAwards.length} awarded)`);
    return newAwards;
  } catch (err) {
    console.error("Error in awardStarsFromSharesJob:", err);
    return [];
  }
}
