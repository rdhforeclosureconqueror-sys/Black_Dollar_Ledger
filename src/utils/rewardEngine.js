// ✅ src/utils/rewardEngine.js
import { pool } from "../server.js";
import { clients } from "../server.js";

export async function grantReward(memberId, category, trigger) {
  try {
    // Look up reward rule
    const rule = await pool.query(
      `SELECT xp_value, star_value
         FROM reward_rules
        WHERE category=$1 AND trigger=$2
        LIMIT 1`,
      [category, trigger]
    );

    const xp = rule.rows[0]?.xp_value || 0;
    const stars = rule.rows[0]?.star_value || 0;

    // Log into XP/STAR tables
    if (xp !== 0) {
      await pool.query(
        `INSERT INTO xp_transactions (member_id, delta, reason)
         VALUES ($1, $2, $3)`,
        [memberId, xp, `${category}:${trigger}`]
      );
    }
    if (stars !== 0) {
      await pool.query(
        `INSERT INTO star_transactions (member_id, delta, reason)
         VALUES ($1, $2, $3)`,
        [memberId, stars, `${category}:${trigger}`]
      );
    }

    // Send WebSocket event to user
    const ws = clients.get(memberId);
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "reward_update",
          member_id: memberId,
          category,
          delta_xp: xp,
          delta_stars: stars,
          message: `🏆 +${xp} XP • ⭐ +${stars} (${category}:${trigger})`,
        })
      );
    }

    // Notify admins
    for (const [key, socket] of clients.entries()) {
      if (key.startsWith("admin:") && socket.readyState === 1) {
        socket.send(
          JSON.stringify({
            type: "member_activity",
            member_id: memberId,
            activity: `${category}_${trigger}`,
            xp,
            stars,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }

    return { ok: true, xp, stars };
  } catch (err) {
    console.error("❌ grantReward error:", err);
    return { ok: false, error: err.message };
  }
}
