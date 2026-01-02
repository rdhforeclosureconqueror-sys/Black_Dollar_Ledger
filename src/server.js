// src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import cron from "node-cron";
import { WebSocketServer } from "ws";
import adminRoutes from "./routes/adminRoutes.js";
app.use("/admin", requireAuth, adminRoutes);

import { awardStarsFromSharesJob } from "./jobs/awardStarsFromShares.js";
import authRoutes from "./authRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
import adminRoutes from "./adminRoutes.js";
app.use("/admin", requireAuth, adminRoutes);

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const {
  NODE_ENV = "production",
  PORT = process.env.PORT || 3000,
  APP_BASE_URL,
  DATABASE_URL,
  SESSION_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
} = process.env;

if (!APP_BASE_URL || !DATABASE_URL || !SESSION_SECRET) {
  throw new Error("Missing required environment variables");
}

app.use(express.json({ limit: "10mb" }));

// -----------------------------------
// 1️⃣  CORS Configuration
// -----------------------------------
const allowedOrigins = [APP_BASE_URL];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

// -----------------------------------
// 2️⃣  Database + Session Store
// -----------------------------------
const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
const PgSession = connectPgSimple(session);

app.use(
  session({
    name: "bd.sid",
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// -----------------------------------
// 3️⃣  Passport (Google OAuth)
// -----------------------------------
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_a, _r, profile, done) => {
      const user = {
        provider: "google",
        id: profile.id,
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value ?? null,
        photo: profile.photos?.[0]?.value ?? null,
      };
      return done(null, user);
    }
  )
);

// -----------------------------------
// 4️⃣  Routes
// -----------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, message: "Simba Ledger API is healthy" }));
app.use("/auth", authRoutes);

function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/pagt", requireAuth, pagtRoutes);

// -----------------------------------
// 5️⃣  WebSocket Server
// -----------------------------------
const server = app.listen(PORT, () => {
  console.log(`🦁 API + WS running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("🟢 Client connected");
  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === "register" && parsed.member_id) {
        clients.set(parsed.member_id, ws);
        ws.send(JSON.stringify({ type: "ack", message: "Registered for updates" }));
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });
  ws.on("close", () => console.log("🔴 Client disconnected"));
});

// -----------------------------------
// 6️⃣  Cron Job — STAR Award Checker
// -----------------------------------
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running share-based STAR job...");
  const newAwards = await awardStarsFromSharesJob(pool);
  newAwards.forEach((award) => {
    const ws = clients.get(award.member_id);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "star_award", message: `⭐ You earned ${award.delta} STAR!` }));
    }
  });
});

// -----------------------------------
// 7️⃣  New Reminder Logic (Phase 2.5)
// -----------------------------------
cron.schedule("*/10 * * * *", async () => {
  console.log("🔔 Checking for STAR reminders...");
  const pending = await pool.query(`
    SELECT member_id, COUNT(*) AS count
    FROM share_events
    WHERE awarded IS FALSE OR awarded IS NULL
    GROUP BY member_id;
  `);
  pending.rows.forEach((row) => {
    const { member_id, count } = row;
    if (count % 3 !== 0) {
      const remaining = 3 - (count % 3);
      const ws = clients.get(member_id);
      if (ws && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "reminder",
            message: `🔸 ${count} shares logged — ${remaining} more for your next STAR!`,
          })
        );
      }
    }
  });
});

// -----------------------------------
// 8️⃣  404 Catch
// -----------------------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.originalUrl });
});
