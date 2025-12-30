// src/auth/authRoutes.js
import { Router } from "express";
import passport from "passport";

const r = Router();

const APP_BASE_URL = process.env.APP_BASE_URL || "https://simbawaujamaa.com";

/**
 * Start Google login
 * GET /auth/google
 */
r.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/**
 * Google callback
 * GET /auth/google/callback
 */
r.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (req, res) => {
    // ✅ After successful login, return to the FRONTEND root (not /me)
    // Your LoginGate will immediately call API /auth/me to verify session.
    res.redirect(`${APP_BASE_URL}/`);
  }
);

/**
 * Who am I?
 * GET /auth/me
 */
r.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, auth: false });
  res.json({ ok: true, auth: true, user: req.user });
});

/**
 * Logout
 * POST /auth/logout
 */
r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session?.destroy(() => {
      // Clear cookie with the same cookie name.
      res.clearCookie("bd.sid", {
        path: "/",
      });
      res.json({ ok: true });
    });
  });
});

/**
 * Fail
 * GET /auth/fail
 */
r.get("/fail", (_req, res) => {
  res.status(401).send("Google login failed");
});

export default r;
