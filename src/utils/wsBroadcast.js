// src/utils/wsBroadcast.js
import { clients } from "../server.js";

/**
 * Broadcast a payload to all connected admins (real-time dashboard)
 */
export function broadcastToAdmins(payload) {
  for (const [key, ws] of clients.entries()) {
    if (key.startsWith("admin:") && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}

/**
 * Broadcast a payload to a specific member (if online)
 */
export function notifyMember(member_id, payload) {
  const ws = clients.get(member_id);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}
