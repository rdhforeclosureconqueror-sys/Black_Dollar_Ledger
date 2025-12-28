import { query } from "../db.js";
import { rankFromStars } from "../utils/rankRules.js";

export async function rankRecalculation() {
  const members = await query(`SELECT member_id FROM members`);

  for (const m of members.rows) {
    const stars = await query(
      `SELECT COALESCE(SUM(delta),0) AS stars
       FROM star_transactions WHERE member_id=$1`,
      [m.member_id]
    );

    const totalStars = Number(stars.rows[0].stars);
    const rank = rankFromStars(totalStars);

    await query(
      `UPDATE members SET star_rank=$1, star_total=$2 WHERE member_id=$3`,
      [rank, totalStars, m.member_id]
    );
  }

  return { ok: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rankRecalculation()
    .then(() => {
      console.log("✅ rankRecalculation complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error("❌ rankRecalculation failed", e);
      process.exit(1);
    });
}
