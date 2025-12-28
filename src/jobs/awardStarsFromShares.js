import { query } from "../db.js";

export async function awardStarsFromShares() {
  // For each member, count how many shares since last award window
  // MVP approach:
  // - shares_awarded_count on members table
  // - total shares - awarded shares = new shares
  // - every 3 new shares => +1 star

  const members = await query(`SELECT member_id, shares_awarded_count FROM members`);

  for (const m of members.rows) {
    const totalSharesRes = await query(
      `SELECT COUNT(*)::int AS c FROM share_events WHERE member_id=$1`,
      [m.member_id]
    );
    const totalShares = totalSharesRes.rows[0].c;
    const alreadyCounted = m.shares_awarded_count || 0;

    const newShares = Math.max(0, totalShares - alreadyCounted);
    const starsToAward = Math.floor(newShares / 3);

    if (starsToAward > 0) {
      const sharesConsumed = starsToAward * 3;

      await query(
        `INSERT INTO star_transactions (member_id, delta, reason)
         VALUES ($1,$2,$3)`,
        [m.member_id, starsToAward, `Auto-award from shares: ${sharesConsumed} shares => ${starsToAward} STAR`]
      );

      await query(
        `UPDATE members
         SET shares_awarded_count = shares_awarded_count + $1
         WHERE member_id=$2`,
        [sharesConsumed, m.member_id]
      );
    }
  }

  return { ok: true };
}

// allow running directly: node src/jobs/awardStarsFromShares.js
if (import.meta.url === `file://${process.argv[1]}`) {
  awardStarsFromShares()
    .then(() => {
      console.log("✅ awardStarsFromShares complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error("❌ awardStarsFromShares failed", e);
      process.exit(1);
    });
}
