import { Router } from "express";
import passport from "passport";

const r = Router();

r.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

r.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (req, res) => {
    // Successful login → send them somewhere
    res.redirect("/auth/me");
  }
);

r.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, error: "NOT_LOGGED_IN" });
  res.json({ ok: true, user: req.user });
});

r.get("/logout", (req, res) => {
  req.logout?.(() => {});
  res.json({ ok: true });
});

r.get("/fail", (req, res) => {
  res.status(401).send("Google login failed");
});

export default r;
