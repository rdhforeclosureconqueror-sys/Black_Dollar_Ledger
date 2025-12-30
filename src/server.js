// src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";

import authRoutes from "./authRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
// import adminRoutes from "./adminRoutes.js"; // ONLY if you actually have this file

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const {
  NODE_ENV = "production",
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

app.use(express.json({ limit: "10mb" }));

// CORS: allow simba + www, and allow cookies
const allowedOrigins = new Set([
  APP_BASE_URL,
  APP_BASE_URL.includes("://www.")
    ? APP_BASE_URL.replace("://www.", "://")
    : APP_BASE_URL.replace("://", "://www."),
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

// Postgres pool + session store
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
      secure: NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/", // IMPORTANT
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Google OAuth
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

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Route list helper (so you KNOW what exists)
app.get("/routes", (_req, res) => {
  res.json({
    ok: true,
    routes: [
      "GET /health",
      "GET /routes",
      "GET /auth/google",
      "GET /auth/google/callback",
      "GET /auth/me",
      "POST /auth/logout",
      "ledger routes under /ledger/* (auth required)",
      "pagt routes under /pagt/* (auth required)",
    ],
  });
});

// Mount routers (THIS is the key)
app.use("/auth", authRoutes);

function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/pagt", requireAuth, pagtRoutes);

// app.use("/admin", requireAuth, adminRoutes); // only if file exists + you want it

const port = PORT || 3000;
app.listen(port, () => console.log("API running on", port));
