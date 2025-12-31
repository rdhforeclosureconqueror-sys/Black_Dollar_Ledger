// src/authRoutes.js
import { Router } from "express";
import passport from "passport";

const r = Router();

function getAppBaseUrl() {
  // Frontend base (example: https://simbawaujamaa.com)
  return process.env.APP_BASE_URL || "https://simbawaujamaa.com";
}

/**
 * Start Google login
 * GET /auth/google
 */
r.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", // helps avoid weird cached-account issues
  })
);

/**
 * Google callback
 * GET /auth/google/callback
 *
 * NOTE: The callback URL MUST match GOOGLE_CALLBACK_URL in your env
 * Example: https://api.simbawaujamaa.com/auth/google/callback
 */
r.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/fail",
    session: true,
  }),
  (req, res) => {
    // Successful login -> send to FRONTEND root (LoginGate will call /auth/me)
    res.redirect(`${getAppBaseUrl()}/`);
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
 * Quick check
 * GET /auth/status
 */
r.get("/status", (req, res) => {
  res.json({ ok: true, auth: !!req.user });
});

/**
 * Logout (Passport 0.6+ requires callback)
 * POST /auth/logout
 */
r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session?.destroy(() => {
      // IMPORTANT: these options should match your session cookie config
      // (secure + sameSite especially)
      res.clearCookie("bd.sid", {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

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
