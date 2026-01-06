// ✅ src/ai/movementModel.js
import { pool } from "../server.js";
import { notifyAI } from "../utils/aiNotifier.js";

/**
 * Receives pre-processed motion data (accuracy, reps, etc.)
 * from the client (browser-side MoveNet or BlazePose).
 * Stores session results and handles rewards + notifications.
 */
export async function analyzeMovement({
  member_id,
  session_id,
  movement_type,
  accuracy,
  reps,
}) {
  try {
    // 🔹 Validate and normalize input
    const safeAccuracy = Math.min(Math.max(Number(accuracy) || 0, 0), 100);
    const safeReps = Math.max(Number(reps) || 0, 0);

    // 🔹 Save session results
    await pool.query(
      `INSERT INTO ai_movement_sessions
        (member_id, session_id, movement_type, reps, accuracy)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id) DO UPDATE
       SET reps = EXCLUDED.reps, accuracy = EXCLUDED.accuracy;`,
      [member_id, session_id, movement_type, safeReps, safeAccuracy]
    );

    // 🔹 Award stars if thresholds met
    if (safeAccuracy >= 80 && safeReps >= 5) {
      await pool.query(
        `INSERT INTO star_transactions (member_id, delta, reason)
         VALUES ($1, 1, 'High-Accuracy Movement Session');`,
        [member_id]
      );
    }

    // 🔹 Real-time feedback (WebSocket broadcast)
    notifyAI(member_id, {
      type: "movement_feedback",
      category: movement_type,
      message: `🏋️ ${safeReps} reps • ${safeAccuracy}% accuracy (+${
        safeAccuracy >= 80 ? "1⭐" : "0⭐"
      })`,
      score: safeAccuracy,
      reps: safeReps,
    });

    return { ok: true, accuracy: safeAccuracy, reps: safeReps };
  } catch (err) {
    console.error("❌ Movement analysis error:", err);
    return { ok: false, error: err.message };
  }
}
