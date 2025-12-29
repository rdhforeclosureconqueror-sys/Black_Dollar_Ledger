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
 * Required so secure cookies work correctly in production.
 */
app.set("trust proxy", 1);

/**
 * Required env vars
 */
const {
  NODE_ENV,
  PORT,
  APP_BASE_URL,
  DATABASE_URL,
  SESSION_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
} = process.env;

if (!APP_BASE_URL) throw new Error("Missing APP_BASE_URL");
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!SESSION_SECRET) throw new Error("Missing SESSION_SECRET");
if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID");
if (!GOOGLE_CLIENT_SECRET) throw new Error("Missing GOOGLE_CLIENT_SECRET");
if (!GOOGLE_CALLBACK_URL) throw new Error("Missing GOOGLE_CALLBACK_URL");

/**
 * Body parsing
 */
app.use(express.json({ limit: "10mb" }));

/**
 * CORS
 * IMPORTANT: credentials:true requires a specific origin (not "*").
 */
app.use(
  cors({
    origin: APP_BASE_URL,
    credentials: true,
  })
);

/**
 * Postgres session store (PRODUCTION SAFE)
 */
const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const PgSession = connectPgSimple(session);

app.use(
  session({
    name: "bd.sid",
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === "production", // must be true on https
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

/**
 * Passport init (must be AFTER session middleware)
 */
app.use(passport.initialize());
app.use(passport.session());

/**
 * Minimal session storage
 */
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/**
 * Google OAuth Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      // Later: upsert into Postgres + attach internal userId/role/membership.
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
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/fail" }),
  (_req, res) => {
    // After login, send them back to your frontend
    res.redirect(`${APP_BASE_URL}/me`);
  }
);

app.get("/auth/fail", (_req, res) => res.status(401).send("Google login failed. Try again."));

/**
 * Logout (Passport 0.6+ requires callback)
 */
app.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session?.destroy(() => {
      res.clearCookie("bd.sid");
      res.json({ ok: true });
    });
  });
});

/**
 * Who am I?
 */
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

/**
 * Start
 */
const port = PORT || 3000;
app.listen(port, () => console.log("API running on", port));
