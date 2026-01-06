// ✅ src/utils/wsBroadcast.js
import { clients } from "../server.js";

/**
 * 🦁 Broadcast a payload to all connected admins (real-time dashboard updates)
 */
export function broadcastToAdmins(payload) {
  for (const [key, ws] of clients.entries()) {
    if (key.startsWith("admin:") && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}

/**
 * 🦁 Notify a specific member (if currently online)
 */
export function notifyMember(member_id, payload) {
  const ws = clients.get(member_id);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * 🦁 Broadcast a payload to *all* connected clients (admins + members)
 * — Used by server.js for global events like star awards or announcements.
 */
export function broadcastToClients(payload) {
  for (const [, ws] of clients.entries()) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}
