import { Router } from "express";
import { query } from "./db.js";
import { VoteSchema } from "./utils/validation.js";

const r = Router();

async function ensureMember(member_id) {
  await query(
    `INSERT INTO members (member_id) VALUES ($1)
     ON CONFLICT (member_id) DO NOTHING`,
    [member_id]
  );
}

r.post("/vote", async (req, res) => {
  const parsed = VoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { member_id, contest_id, contestant_id, votes, pay_with } = parsed.data;
  await ensureMember(member_id);

  // check free vote availability (1 per month)
  if (pay_with === "free") {
    const free = await query(
      `SELECT free_votes_remaining
       FROM monthly_free_votes
       WHERE member_id=$1 AND month_key=to_char(now(),'YYYY-MM')
       LIMIT 1`,
      [member_id]
    );

    const remaining = free.rows[0]?.free_votes_remaining ?? 0;
    if (remaining < votes) {
      return res.status(400).json({
        ok: false,
        error: `Not enough free votes. Remaining: ${remaining}`
      });
    }

    await query(
      `UPDATE monthly_free_votes
       SET free_votes_remaining = free_votes_remaining - $1
       WHERE member_id=$2 AND month_key=to_char(now(),'YYYY-MM')`,
      [votes, member_id]
    );
  }

  // stars payment (3 stars per vote)
  if (pay_with === "stars") {
    const cost = votes * 3;

    const stars = await query(
      `SELECT COALESCE(SUM(delta),0) AS stars
       FROM star_transactions WHERE member_id=$1`,
      [member_id]
    );

    const current = Number(stars.rows[0].stars);
    if (current < cost) {
      return res.status(400).json({ ok: false, error: `Not enough STARs. Need ${cost}, have ${current}.` });
    }

    await query(
      `INSERT INTO star_transactions (member_id, delta, reason)
       VALUES ($1,$2,$3)`,
      [member_id, -cost, `PAGT vote purchase (${votes} votes @ 3 STAR each)`]
    );
  }

  await query(
    `INSERT INTO votes (member_id, contest_id, contestant_id, votes, pay_with)
     VALUES ($1,$2,$3,$4,$5)`,
    [member_id, contest_id, contestant_id, votes, pay_with]
  );

  res.json({ ok: true, message: "Vote recorded.", member_id, contest_id, contestant_id, votes, pay_with });
});

export default r;

