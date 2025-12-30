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
  NODE_ENV = "development",
  PORT,
  APP_BASE_URL,        // e.g. https://simbawaujamaa.com
  DATABASE_URL,
  SESSION_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL, // e.g. https://api.simbawaujamaa.com/auth/google/callback
} = process.env;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing ${name}`);
}

requireEnv("APP_BASE_URL", APP_BASE_URL);
requireEnv("DATABASE_URL", DATABASE_URL);
requireEnv("SESSION_SECRET", SESSION_SECRET);
requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
requireEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
requireEnv("GOOGLE_CALLBACK_URL", GOOGLE_CALLBACK_URL);

/**
 * Body parsing
 */
app.use(express.json({ limit: "10mb" }));

/**
 * CORS
 * IMPORTANT: credentials:true requires a specific origin (not "*").
 * Allow ONLY your frontend origin(s).
 */
const allowedOrigins = new Set([
  APP_BASE_URL,
  // Optional: if you use www as well, add it:
  // "https://www.simbawaujamaa.com",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser calls (like curl/postman) with no origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
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

/**
 * Cookie rules:
 * - In production, because frontend and API are on different subdomains,
 *   you MUST use SameSite=None + Secure=true, or sessions won't persist.
 */
const isProd = NODE_ENV === "production";

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
    proxy: true, // helps behind proxies
    cookie: {
      httpOnly: true,
      secure: isProd,                 // MUST be true on https
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      // domain: ".simbawaujamaa.com", // optional; only use if you KNOW you want cookie shared across subdomains
    },
  })
);

/**
 * Passport init (must be AFTER session middleware)
 */
app.use(passport.initialize());
app.use(passport.session());

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
app.get("/health", (_req, res) => res.json({ ok: true, env: NODE_ENV }));

/**
 * Auth routes
 */
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${APP_BASE_URL}/login?error=google` }),
  (_req, res) => {
    // Send them back to frontend AFTER session cookie is set
    res.redirect(`${APP_BASE_URL}/me`);
  }
);

app.get("/auth/fail", (_req, res) =>
  res.status(401).send("Google login failed. Try again.")
);

/**
 * Logout
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
