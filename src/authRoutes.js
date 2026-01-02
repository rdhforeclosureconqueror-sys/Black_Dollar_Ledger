// ✅ src/authRoutes.js
import { Router } from "express";
import passport from "passport";
import { pool } from "./server.js";

const r = Router();

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "https://simbawaujamaa.com";
}

// ----------------------------------------------------
// 1️⃣ Google OAuth Login
// ----------------------------------------------------
r.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// ----------------------------------------------------
// 2️⃣ Google Callback
// ----------------------------------------------------
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

      // Default role
      let role = result.rows[0]?.role || "user";

      // ✅ Automatically promote approved emails
      const adminEmails = [
        "rdhforeclosureconqueror@gmail.com",
        "rashad@simbawaujamaa.com",
        "admin@simbawaujamaa.com",
      ];
      if (adminEmails.includes(req.user.email)) {
        role = "admin";
      }

      req.user.role = role;

      // ✅ Persist user + role in the session
      req.session.passport.user = req.user;
      await new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      res.redirect(`${getAppBaseUrl()}/`);
    } catch (err) {
      console.error("❌ Error setting user role:", err);
      res.redirect(`${getAppBaseUrl()}/`);
    }
  }
);

// ----------------------------------------------------
// 3️⃣ /me (get current logged-in user)
// ----------------------------------------------------
r.get("/me", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, auth: false });
  }

  try {
    const roleCheck = await pool.query(
      "SELECT role FROM members WHERE member_id=$1",
      [req.user.id]
    );

    let role = roleCheck.rows[0]?.role || "user";

    // ✅ Enforce admin status from email
    const adminEmails = [
      "rdhforeclosureconqueror@gmail.com",
      "rashad@simbawaujamaa.com",
      "admin@simbawaujamaa.com",
    ];
    if (adminEmails.includes(req.user.email)) {
      role = "admin";
    }

    res.json({
      ok: true,
      auth: true,
      user: { ...req.user, role },
    });
  } catch (err) {
    console.error("❌ Error in /auth/me:", err);
    res.json({ ok: true, auth: true, user: req.user });
  }
});

// ----------------------------------------------------
// 4️⃣ Status
// ----------------------------------------------------
r.get("/status", (req, res) =>
  res.json({ ok: true, auth: !!req.user })
);

// ----------------------------------------------------
// 5️⃣ Logout
// ----------------------------------------------------
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

// ----------------------------------------------------
// 6️⃣ Fail
// ----------------------------------------------------
r.get("/fail", (_req, res) =>
  res.status(401).send("Google login failed")
);

export default r;
