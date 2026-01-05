// ✅ src/ai/adaptiveEngine.js
import { pool } from "../server.js";
import { notifyAI } from "../utils/aiNotifier.js";

export async function runAdaptiveEngine() {
  console.log("🧠 Running Simba Adaptive AI Engine...");

  const users = await pool.query(`SELECT DISTINCT member_id FROM ai_metrics`);
  for (const u of users.rows) {
    const { member_id } = u;

    // analyze averages
    const stats = await pool.query(`
      SELECT
        ROUND(AVG(score)::numeric, 2) AS avg_score,
        metric_type
      FROM ai_metrics
      WHERE member_id = $1
      GROUP BY metric_type;
    `, [member_id]);

    const profile = {
      motion_avg: 0,
      voice_avg: 0,
      journal_avg: 0,
    };

    for (const s of stats.rows) {
      if (s.metric_type === "motion") profile.motion_avg = s.avg_score;
      if (s.metric_type === "voice") profile.voice_avg = s.avg_score;
      if (s.metric_type === "journal") profile.journal_avg = s.avg_score;
    }

    // compute consistency based on number of events this week
    const consistency = await pool.query(`
      SELECT COUNT(*) AS events
      FROM ai_metrics
      WHERE member_id=$1
      AND created_at > NOW() - INTERVAL '7 days'
    `, [member_id]);

    const consistencyScore = Math.min(100, consistency.rows[0].events * 10);

    // decide difficulty
    let difficulty = 1;
    if (profile.motion_avg > 80 && consistencyScore > 60) difficulty = 2;
    if (profile.motion_avg > 90 && consistencyScore > 80) difficulty = 3;

    // write or update adaptive profile
    await pool.query(`
      INSERT INTO ai_adaptive_profiles (member_id, motion_avg, voice_avg, journal_avg, consistency_score, current_difficulty, last_adapted)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (member_id)
      DO UPDATE SET
        motion_avg=EXCLUDED.motion_avg,
        voice_avg=EXCLUDED.voice_avg,
        journal_avg=EXCLUDED.journal_avg,
        consistency_score=EXCLUDED.consistency_score,
        current_difficulty=EXCLUDED.current_difficulty,
        last_adapted=NOW();
    `, [member_id, profile.motion_avg, profile.voice_avg, profile.journal_avg, consistencyScore, difficulty]);

    // create recommendation
    let rec = "";
    let impact = "";

    if (difficulty === 1 && profile.motion_avg < 50)
      rec = "Start with lighter sessions and focus on form.";
    else if (difficulty === 2)
      rec = "Increase your reps or practice duration — Simba believes you’re ready!";
    else if (difficulty === 3)
      rec = "Elite tier! Maintain precision and start recording advanced movements.";

    if (profile.voice_avg < 60)
      rec += " Practice pronunciation slowly and clearly using your language drills.";

    if (profile.journal_avg < 40)
      rec += " Try to write more positive reflections today.";

    impact = `Next session difficulty: ${difficulty}`;

    await pool.query(`
      INSERT INTO ai_recommendations (member_id, category, recommendation, impact)
      VALUES ($1, 'motion', $2, $3)
    `, [member_id, rec, impact]);

    notifyAI(member_id, {
      type: "ai_recommendation",
      message: rec,
      difficulty,
    });
  }

  console.log("✅ Simba Adaptive AI Engine completed.");
}
