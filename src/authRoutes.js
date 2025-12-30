// src/authRoutes.js
import { Router } from "express";
import passport from "passport";

const r = Router();

r.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

r.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (_req, res) => {
    const appBaseUrl = process.env.APP_BASE_URL || "https://simbawaujamaa.com";
    // ✅ send them to the frontend root; LoginGate will call /auth/me
    res.redirect(`${appBaseUrl}/`);
  }
);

r.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, auth: false });
  res.json({ ok: true, auth: true, user: req.user });
});

r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session?.destroy(() => {
      res.clearCookie("bd.sid", { path: "/" });
      res.json({ ok: true });
    });
  });
});

r.get("/fail", (_req, res) => res.status(401).send("Google login failed"));

export default r;
