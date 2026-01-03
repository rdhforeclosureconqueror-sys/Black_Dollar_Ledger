// ✅ src/authRoutes.js
import { Router } from "express";
import passport from "passport";
import { pool } from "./server.js";

const router = Router();

// 🌍 Base app URL
function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "https://simbawaujamaa.com";
}

// 🦁 Define who the real admin(s) are
const ADMIN_EMAILS = [
  "rdhforeclosureconqueror@gmail.com",
  "rashad@simbawaujamaa.com",
  "admin@simbawaujamaa.com",
];

// ----------------------------------------------------
// 1️⃣ Start Google OAuth
// ----------------------------------------------------
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// ----------------------------------------------------
// 2️⃣ Google Callback (sets up session)
// ----------------------------------------------------
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/fail",
    session: true,
  }),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("No user ID returned from Google");

      // Get or create user in DB
      const result = await pool.query(
        "SELECT role FROM members WHERE member_id = $1",
        [userId]
      );

      let role = result.rows[0]?.role || "user";

      // 🔐 Promote admin automatically
      if (ADMIN_EMAILS.includes(req.user.email)) {
        role = "admin";
      }

      // Persist user info
      req.user.role = role;
      req.session.passport.user = req.user;

      await new Promise((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      console.log(`✅ ${req.user.email} logged in as ${role}`);
      res.redirect(`${getAppBaseUrl()}/`);
    } catch (err) {
      console.error("❌ Google callback error:", err);
      res.redirect(`${getAppBaseUrl()}/`);
    }
  }
);

// ----------------------------------------------------
// 3️⃣ /me — Return current logged-in user
// ----------------------------------------------------
router.get("/me", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, auth: false });
  }

  try {
    const roleCheck = await pool.query(
      "SELECT role FROM members WHERE member_id = $1",
      [req.user.id]
    );

    let role = roleCheck.rows[0]?.role || "user";

    // Reconfirm admin
    if (ADMIN_EMAILS.includes(req.user.email)) {
      role = "admin";
    }

    res.json({
      ok: true,
      auth: true,
      user: { ...req.user, role },
    });
  } catch (err) {
    console.error("❌ /auth/me error:", err);
    res.status(500).json({
      ok: false,
      auth: true,
      error: "Database lookup failed",
      user: req.user,
    });
  }
});

// ----------------------------------------------------
// 4️⃣ Auth Status (lightweight ping)
// ----------------------------------------------------
router.get("/status", (req, res) =>
  res.json({ ok: true, auth: !!req.user })
);

// ----------------------------------------------------
// 5️⃣ Logout and clear session
// ----------------------------------------------------
router.post("/logout", (req, res, next) => {
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
// 6️⃣ OAuth Failure Redirect
// ----------------------------------------------------
router.get("/fail", (_req, res) =>
  res.status(401).send("Google login failed")
);

export default router;
