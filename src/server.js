// src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";

import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";

dotenv.config();

const app = express();

/**
 * Render sits behind a proxy/load balancer.
 * This is required so secure cookies work correctly in production.
 */
app.set("trust proxy", 1);

// If your frontend is on another domain later, we’ll tighten this.
// For now, keep it simple: same-origin + allow credentials.
app.use(
  cors({
    origin: process.env.APP_BASE_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

/**
 * Sessions (login cookie)
 */
if (!process.env.SESSION_SECRET) {
  throw new Error("Missing SESSION_SECRET env var");
}

app.use(
  session({
    name: "bd.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // must be true on https
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/**
 * Minimal session storage:
 * store user info we care about.
 */
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/**
 * Google OAuth Strategy
 */
if (!process.env.GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID");
if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error("Missing GOOGLE_CLIENT_SECRET");
if (!process.env.GOOGLE_CALLBACK_URL) throw new Error("Missing GOOGLE_CALLBACK_URL");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      // You can later upsert into Postgres here.
      const user = {
        provider: "google",
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value ?? null,
        photo: profile.photos?.[0]?.value ?? null,
      };
      return done(null, user);
    }
  )
);

/**
 * Health
 */
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Auth routes
 */
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (req, res) => {
    // success -> send them somewhere useful
    res.redirect(`${process.env.APP_BASE_URL}/me`);
  }
);

app.get("/auth/fail", (_req, res) =>
  res.status(401).send("Google login failed. Try again.")
);

app.post("/logout", (req, res) => {
  req.logout?.(() => {});
  req.session?.destroy(() => {});
  res.json({ ok: true });
});

app.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, auth: false });
  res.json({ ok: true, auth: true, user: req.user });
});

/**
 * Gatekeeper middleware
 */
function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

/**
 * Protected APIs
 */
app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/pagt", requireAuth, pagtRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API running on", port));
