import { query } from '../db.js';

/**
 * Run periodically (every 5 min or via cron).
 * Checks who has 3+ unawarded share_events and grants 1 STAR per group of 3.
 */
export async function awardStarsFromSharesJob() {
  const client = await query.connect?.() ?? query; // handle both pool/query exports
  try {
    await client.query('BEGIN');

    // Find eligible members
    const res = await client.query(`
      SELECT member_id, COUNT(*) AS share_count
      FROM share_events
      WHERE awarded = false
      GROUP BY member_id
      HAVING COUNT(*) >= 3
    `);

    for (const row of res.rows) {
      const { member_id, share_count } = row;
      const starsToAward = Math.floor(share_count / 3);
      const sharesToMark = starsToAward * 3;

      if (starsToAward > 0) {
        await client.query(
          `INSERT INTO star_transactions (member_id, delta, reason)
           VALUES ($1,$2,$3)`,
          [member_id, starsToAward, 'Automatic award: 3 shares = 1 STAR']
        );

        await client.query(
          `UPDATE share_events
             SET awarded = true
           WHERE member_id=$1
             AND awarded = false
           ORDER BY created_at
           LIMIT $2`,
          [member_id, sharesToMark]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ STAR award job completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ STAR award job failed:', err);
  } finally {
    if (client.release) client.release();
  }
}
