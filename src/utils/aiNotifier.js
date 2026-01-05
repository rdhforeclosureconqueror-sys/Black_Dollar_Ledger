// ✅ src/utils/aiNotifier.js
import { clients } from "../server.js";

/**
 * Broadcast real-time AI feedback to a single user or admins
 */
export function notifyAI(member_id, payload) {
  const ws = clients.get(member_id);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }

  // also send to all admin sockets
  for (const [key, socket] of clients.entries()) {
    if (key.startsWith("admin:") && socket.readyState === 1) {
      socket.send(
        JSON.stringify({
          type: "ai_feedback_event",
          member_id,
          ...payload,
        })
      );
    }
  }
}
