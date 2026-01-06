// ✅ src/server.js — Simba Backend Core (Stable + Render Compatible)
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
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 🧠 Internal Modules
import { awardStarsFromSharesJob } from "./routes/jobs/awardStarsFromShares.js";
import { processReward } from "./utils/rewardEngine.js";
import { broadcastToClients } from "./utils/wsBroadcast.js";

// Route Imports
import authRoutes from "./authRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationsRoutes from "./routes/notifications.js";
import fitnessRoutes from "./routes/fitnessRoutes.js";
import studyRoutes from "./routes/studyRoutes.js";
import languageRoutes from "./routes/languageRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

dotenv.config();

// ----------------------------------------------------
// 1️⃣ Core Setup
// ----------------------------------------------------
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
  throw new Error("❌ Missing required environment variables");
}

app.use(express.json({ limit: "10mb" }));

// ----------------------------------------------------
// 2️⃣ CORS
// ----------------------------------------------------
const allowedOrigins = [
  "https://simbawaujamaa.com",
  "https://www.simbawaujamaa.com",
  ...(NODE_ENV !== "production"
    ? ["http://localhost:5173", "http://127.0.0.1:5173"]
    : []),
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("🚫 CORS Blocked:", origin);
      callback(new Error(`CORS denied for origin: ${origin}`));
    },
    credentials: true,
  })
);

// ----------------------------------------------------
// 3️⃣ Session + Database Pool
// ----------------------------------------------------
const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ✅ Backward Compatibility Export (pool + db)
export { pool, pool as db };

// ----------------------------------------------------
// 🔁 AUTO MIGRATION LOADER (Runs on Startup)
// ----------------------------------------------------
(async function runMigrations() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.join(__dirname, "migrations");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const applied = new Set(
      (await pool.query("SELECT filename FROM schema_migrations")).rows.map(r => r.filename)
    );

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (!applied.has(file)) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        console.log(`🚀 Applying migration: ${file}`);
        try {
          await pool.query(sql);
          await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
          console.log(`✅ Migration applied: ${file}`);
        } catch (err) {
          if (/duplicate|exists/i.test(err.message)) {
            console.warn(`⚠️ Skipping duplicate in ${file}: ${err.message}`);
          } else {
            console.error(`❌ Migration failed (${file}):`, err.message);
          }
        }
      } else {
        console.log(`⏩ Migration already applied: ${file}`);
      }
    }
  } catch (err) {
    console.error("❌ Migration runner failed:", err.message);
  }
})();

// ----------------------------------------------------
// Continue your existing setup (sessions, routes, etc.)
// ----------------------------------------------------

const PgSession = connectPgSimple(session);

app.use(
  session({
    name: "simba.sid",
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
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      domain: NODE_ENV === "production" ? ".simbawaujamaa.com" : undefined,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// (keep all existing Google OAuth, routes, websocket, and cron logic below — unchanged)
