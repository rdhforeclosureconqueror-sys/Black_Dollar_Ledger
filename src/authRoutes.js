import { Router } from "express";
import passport from "passport";
import { pool } from "./server.js";

const r = Router();

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "https://simbawaujamaa.com";
}

// 1️⃣ Start Google OAuth
r.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// 2️⃣ Callback
r.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/fail",
    session: true,
  }),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const result = await pool.query(
        "SELECT role FROM members WHERE member_id=$1",
        [userId]
      );
      req.user.role = result.rows[0]?.role || "user";

      // ✅ Explicitly persist updated user into session
      req.session.passport.user = req.user;
      await new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      res.redirect(`${getAppBaseUrl()}/`);
    } catch (err) {
      console.error("Error setting user role:", err);
      res.redirect(`${getAppBaseUrl()}/`);
    }
  }
);

// 3️⃣ /me
r.get("/me", async (req, res) => {
  if (!req.user)
    return res.status(401).json({ ok: false, auth: false });

  try {
    const roleCheck = await pool.query(
      "SELECT role FROM members WHERE member_id=$1",
      [req.user.id]
    );
    const role = roleCheck.rows[0]?.role || "user";

    // ✅ Always include latest role
    res.json({
      ok: true,
      auth: true,
      user: { ...req.user, role },
    });
  } catch (err) {
    console.error("Error /auth/me:", err);
    res.json({ ok: true, auth: true, user: req.user });
  }
});

// 4️⃣ Status
r.get("/status", (req, res) =>
  res.json({ ok: true, auth: !!req.user })
);

// 5️⃣ Logout
r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session?.destroy(() => {
      res.clearCookie("bd.sid", {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      res.json({ ok: true, message: "Logged out" });
    });
  });
});

// 6️⃣ Fail
r.get("/fail", (_req, res) =>
  res.status(401).send("Google login failed")
);

export default r;
