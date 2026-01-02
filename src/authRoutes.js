// src/authRoutes.js (BACKEND)
import { Router } from "express";
import passport from "passport";
import { pool } from "./server.js"; // ✅ ensure we can pull the role from DB

const r = Router();

// ✅ Helper: get frontend base URL
function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "https://simbawaujamaa.com";
}

// ---------------------------------------------
// 1️⃣ Start Google OAuth
// ---------------------------------------------
r.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// ---------------------------------------------
// 2️⃣ Google OAuth Callback
// ---------------------------------------------
r.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/fail",
    session: true,
  }),
  async (req, res) => {
    try {
      // Ensure user’s role is pulled from DB and stored in session
      const userId = req.user?.id;
      const result = await pool.query(
        "SELECT role FROM members WHERE member_id=$1",
        [userId]
      );

      req.user.role = result.rows[0]?.role || "user";

      // Persist updated user info into the session
      req.session.passport.user = req.user;

      res.redirect(`${getAppBaseUrl()}/`);
    } catch (err) {
      console.error("Error fetching user role:", err);
      res.redirect(`${getAppBaseUrl()}/`);
    }
  }
);

// ---------------------------------------------
// 3️⃣ Who am I? (Session check)
// ---------------------------------------------
r.get("/me", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, auth: false });
  }

  try {
    // Get the latest role from DB
    const dbRole = await pool.query(
      "SELECT role FROM members WHERE member_id=$1",
      [req.user.id]
    );
    const role = dbRole.rows[0]?.role || "user";

    res.json({
      ok: true,
      auth: true,
      user: { ...req.user, role },
    });
  } catch (err) {
    console.error("Error fetching /auth/me:", err);
    res.json({ ok: true, auth: true, user: req.user });
  }
});

// ---------------------------------------------
// 4️⃣ Quick Auth Status (no details)
// ---------------------------------------------
r.get("/status", (req, res) => {
  res.json({ ok: true, auth: !!req.user });
});

// ---------------------------------------------
// 5️⃣ Logout (Destroy Session + Cookie)
// ---------------------------------------------
r.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session?.destroy(() => {
      res.clearCookie("bd.sid", {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      res.json({ ok: true, message: "Logged out successfully" });
    });
  });
});

// ---------------------------------------------
// 6️⃣ Fail Safe
// ---------------------------------------------
r.get("/fail", (_req, res) => {
  res.status(401).send("Google login failed. Please try again.");
});

export default r;
