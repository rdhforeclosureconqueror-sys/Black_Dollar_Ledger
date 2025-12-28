import { query } from "../db.js";

export async function monthlyFreeVotes() {
  const monthKeyRes = await query(`SELECT to_char(now(),'YYYY-MM') AS mk`);
  const month_key = monthKeyRes.rows[0].mk;

  const members = await query(`SELECT member_id FROM members`);

  for (const m of members.rows) {
    await query(
      `INSERT INTO monthly_free_votes (member_id, month_key, free_votes_remaining)
       VALUES ($1,$2,1)
       ON CONFLICT (member_id, month_key) DO NOTHING`,
      [m.member_id, month_key]
    );
  }

  return { ok: true, month_key };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  monthlyFreeVotes()
    .then((r) => {
      console.log("✅ monthlyFreeVotes complete", r);
      process.exit(0);
    })
    .catch((e) => {
      console.error("❌ monthlyFreeVotes failed", e);
      process.exit(1);
    });
}
