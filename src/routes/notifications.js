import { Router } from "express";
import { query } from "../db.js";

const r = Router();

// ✅ Fetch unread notifications for logged-in member
r.get("/", async (req, res) => {
  const memberId = req.user.id;
  const result = await query(`
    SELECT id, category, message, created_at, read
    FROM notifications
    WHERE member_id=$1
    ORDER BY created_at DESC
    LIMIT 10
  `, [memberId]);

  res.json({ ok: true, items: result.rows });
});

// ✅ Mark as read
r.post("/read/:id", async (req, res) => {
  await query("UPDATE notifications SET read=true WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

export default r;
