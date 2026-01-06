// ✅ src/utils/rewardEngine.js
import { pool, clients } from "../server.js";

/**
 * 🏅 Grant a specific reward based on category and trigger.
 * Example: grantReward("member123", "fitness", "completed_workout");
 */
export async function grantReward(memberId, category, trigger) {
  try {
    const { rows } = await pool.query(
      `SELECT xp_value, star_value
         FROM reward_rules
        WHERE category=$1 AND trigger=$2
        LIMIT 1`,
      [category, trigger]
    );

    const xp = rows[0]?.xp_value || 0;
    const stars = rows[0]?.star_value || 0;

    // Log XP and STAR transactions
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

    // WebSocket push to user
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

    // Notify all connected admins
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

/**
 * 🧠 processReward — Handles adaptive rewards or periodic XP distribution.
 * Used in server.js by the cron scheduler.
 */
export async function processReward(poolRef = pool, clientsRef = clients) {
  try {
    // Example: automatically grant XP to members who completed recent activities
    const { rows: activeMembers } = await poolRef.query(`
      SELECT DISTINCT member_id
      FROM activity_log
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
    `);

    for (const { member_id } of activeMembers) {
      await grantReward(member_id, "engagement", "active_hour");
    }

    console.log(`✅ processReward: granted XP to ${activeMembers.length} active users`);
    return { ok: true, count: activeMembers.length };
  } catch (err) {
    console.error("❌ processReward error:", err);
    return { ok: false, error: err.message };
  }
}
