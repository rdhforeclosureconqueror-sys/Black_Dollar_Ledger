// src/utils/wsBroadcast.js
import { clients } from "../server.js"; // make sure clients is exported

export function broadcastToAdmins(payload) {
  for (const [key, ws] of clients.entries()) {
    if (key.startsWith("admin:") && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}
