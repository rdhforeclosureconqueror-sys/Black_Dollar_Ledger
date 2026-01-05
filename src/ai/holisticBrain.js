// ✅ src/ai/holisticBrain.js
import { pool } from "../server.js";
import { notifyAI } from "../utils/aiNotifier.js";

export async function runHolisticBrain() {
  console.log("🧠 Running Simba Holistic Health Brain...");

  // Get all users with data across systems
  const members = await pool.query(`SELECT member_id FROM members`);

  for (const { member_id } of members.rows) {
    // Pull metrics from movement, journaling, voice, and study
    const motion = await pool.query(
      `SELECT AVG(accuracy) AS avg FROM ai_movement_sessions WHERE member_id=$1 AND created_at > NOW() - INTERVAL '7 days'`,
      [member_id]
    );
    const journal = await pool.query(
      `SELECT AVG(score) AS avg FROM ai_metrics WHERE member_id=$1 AND metric_type='journal' AND created_at > NOW() - INTERVAL '7 days'`,
      [member_id]
    );
    const voice = await pool.query(
      `SELECT AVG(score) AS avg FROM ai_metrics WHERE member_id=$1 AND metric_type='voice' AND created_at > NOW() - INTERVAL '7 days'`,
      [member_id]
    );
    const culture = await pool.query(
      `SELECT COUNT(*) AS count FROM share_events WHERE member_id=$1 AND created_at > NOW() - INTERVAL '7 days'`,
      [member_id]
    );

    const physical = Number(motion.rows[0].avg ?? 0);
    const mental = Number(journal.rows[0].avg ?? 0);
    const linguistic = Number(voice.rows[0].avg ?? 0);
    const cultural = Number(culture.rows[0].count ?? 0) * 10;

    const overall = Math.round((physical + mental + linguistic + cultural) / 4);

    await pool.query(
      `
      INSERT INTO ai_holistic_state
        (member_id, physical_score, mental_score, linguistic_score, cultural_score, overall_health, last_sync)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT (member_id)
      DO UPDATE SET
        physical_score=EXCLUDED.physical_score,
        mental_score=EXCLUDED.mental_score,
        linguistic_score=EXCLUDED.linguistic_score,
        cultural_score=EXCLUDED.cultural_score,
        overall_health=EXCLUDED.overall_health,
        last_sync=NOW();
      `,
      [member_id, physical, mental, linguistic, cultural, overall]
    );

    // Send live feedback
    notifyAI(member_id, {
      type: "holistic_update",
      message: `🌍 Your Holistic Health score is ${overall}% — balance in progress.`,
      scores: { physical, mental, linguistic, cultural },
    });
  }

  console.log("✅ Holistic Brain update complete.");
}
