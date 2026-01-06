// ✅ src/ai/aiPipeline.js (Backend)
import { pool } from "../server.js";
import { notifyAI } from "../utils/aiNotifier.js";

export const aiPipeline = {
  async processWorkoutMotion({ member_id, accuracy, intensity }) {
    try {
      await pool.query(
        `INSERT INTO ai_metrics (member_id, metric_type, score, metadata)
         VALUES ($1, 'motion', $2, $3)`,
        [member_id, accuracy, JSON.stringify({ intensity })]
      );

      if (accuracy >= 75) {
        await pool.query(
          `INSERT INTO star_transactions (member_id, delta, reason)
           VALUES ($1, 1, 'AI Workout Accuracy ≥75%')`,
          [member_id]
        );
      }

      notifyAI(member_id, {
        type: "ai_feedback",
        category: "motion",
        message:
          accuracy >= 75
            ? `🔥 Excellent form! ${Math.round(accuracy)}% accuracy (+1⭐)`
            : `💪 Keep practicing — accuracy ${Math.round(accuracy)}%`,
        score: accuracy,
      });

      return { ok: true, score: accuracy };
    } catch (err) {
      console.error("❌ AI Motion processing error:", err);
      return { ok: false, error: err.message };
    }
  },

  async analyzeLanguageVoice({ member_id, clarity }) {
    try {
      await pool.query(
        `INSERT INTO ai_metrics (member_id, metric_type, score, metadata)
         VALUES ($1, 'voice', $2, '{}')`,
        [member_id, clarity]
      );

      if (clarity >= 70) {
        await pool.query(
          `INSERT INTO star_transactions (member_id, delta, reason)
           VALUES ($1, 1, 'AI Language Practice Clarity ≥70%')`,
          [member_id]
        );
      }

      notifyAI(member_id, {
        type: "ai_feedback",
        category: "voice",
        message:
          clarity >= 70
            ? `🎤 Crystal clear! ${Math.round(clarity)}% clarity (+1⭐)`
            : `🎧 Work on pronunciation — ${Math.round(clarity)}% clarity`,
        score: clarity,
      });

      return { ok: true, score: clarity };
    } catch (err) {
      console.error("❌ AI Voice error:", err);
      return { ok: false, error: err.message };
    }
  },

  async analyzeJournal({ member_id, positivity }) {
    try {
      await pool.query(
        `INSERT INTO ai_metrics (member_id, metric_type, score, metadata)
         VALUES ($1, 'journal', $2, '{}')`,
        [member_id, positivity]
      );

      if (positivity >= 30) {
        await pool.query(
          `INSERT INTO star_transactions (member_id, delta, reason)
           VALUES ($1, 1, 'Reflective Journal Positivity ≥30')`,
          [member_id]
        );
      }

      notifyAI(member_id, {
        type: "ai_feedback",
        category: "journal",
        message:
          positivity >= 30
            ? `🧘 Beautiful reflection — positivity score ${positivity} (+1⭐)`
            : `📝 Keep journaling — positivity ${positivity}`,
        score: positivity,
      });

      return { ok: true, score: positivity };
    } catch (err) {
      console.error("❌ AI Journal error:", err);
      return { ok: false, error: err.message };
    }
  },
};
