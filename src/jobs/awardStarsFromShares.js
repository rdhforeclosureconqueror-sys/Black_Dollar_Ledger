import { pool } from "../db.js";

export async function awardStarsFromShares() {
  // We store progress in metadata to avoid double-awarding.
  // Simple approach: count all shares and compare to how many SHARE awards exist.

  const members = await pool.query("select member_id from members");

  for (const row of members.rows) {
    const member_id = row.member_id;

    const shareCountRes = await pool.query(
      "select count(*)::int as c from share_logs where member_id=$1",
      [member_id]
    );
    const shares = shareCountRes.rows[0].c;

    const awardedRes = await pool.query(
      `select coalesce(sum(stars_delta),0)::int as awarded
       from star_transactions
       where member_id=$1 and category_code='SHARE_3_TO_1_STAR' and type='EARN' and status='APPROVED'`,
      [member_id]
    );

    const starsFromShares = Math.floor(shares / 3);
    const alreadyAwarded = awardedRes.rows[0].awarded;

    const toAward = starsFromShares - alreadyAwarded;
    if (toAward <= 0) continue;

    await pool.query("begin");
    try {
      await pool.query(
        "update members set star_balance = star_balance + $1 where member_id=$2",
        [toAward, member_id]
      );

      await pool.query(
        `insert into star_transactions(member_id, type, category_code, stars_delta, status, metadata)
         values($1,'EARN','SHARE_3_TO_1_STAR',$2,'APPROVED',$3)`,
        [member_id, toAward, JSON.stringify({ shares, rule: "3_shares=1_star" })]
      );

      await pool.query("commit");
    } catch (e) {
      await pool.query("rollback");
      console.error("awardStarsFromShares failed:", e);
    }
  }
}
