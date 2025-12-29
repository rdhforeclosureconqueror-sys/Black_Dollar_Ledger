import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";

import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
import "./auth/google.js"; // auth setup (we’ll create this next)

const app = express();

/* ---------- Core Middleware ---------- */
app.use(cors({
  origin: process.env.APP_BASE_URL,
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

/* ---------- Session (REQUIRED) ---------- */
app.use(
  session({
    name: "simba.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

/* ---------- Passport ---------- */
app.use(passport.initialize());
app.use(passport.session());

/* ---------- Health ---------- */
app.get("/health", (_, res) => res.json({ ok: true }));

/* ---------- Auth Routes ---------- */
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/failure",
    successRedirect: "/auth/success"
  })
);

app.get("/auth/success", (req, res) => {
  res.redirect(process.env.APP_BASE_URL);
});

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.redirect(process.env.APP_BASE_URL);
  });
});

/* ---------- Protected API ---------- */
app.use("/ledger", ledgerRoutes);
app.use("/pagt", pagtRoutes);

/* ---------- Server ---------- */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API running on", port));
