// src/auth/authRoutes.js
import { Router } from "express";
import passport from "passport";

const r = Router();

/**
 * Start Google login
 * GET /auth/google
 */
r.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

/**
 * Google callback
 * GET /auth/google/callback
 */
r.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (req, res) => {
    // Send them back to the FRONTEND after login
    const appBaseUrl = process.env.APP_BASE_URL || "https://simbawaujamaa.com";
    res.redirect(`${appBaseUrl}/me`);
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
      res.clearCookie("bd.sid");
      res.json({ ok: true });
    });
  });
});

/**
 * Fail
 */
r.get("/fail", (_req, res) => {
  res.status(401).send("Google login failed");
});

export default r;
