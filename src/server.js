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

// Routes + Jobs
import { awardStarsFromSharesJob } from "./jobs/awardStarsFromShares.js";
import authRoutes from "./authRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationsRoutes from "./routes/notifications.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// 🧠 Environment Setup
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

if (!APP_BASE_URL || !DATABASE_URL || !SESSION_SECRET)
  throw new Error("Missing required environment variables");

app.use(express.json({ limit: "10mb" }));

// 🌐 CORS
const allowedOrigins = [APP_BASE_URL];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

// 🧩 Database + Session Store
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

// 🔐 Passport
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

// ✅ Middleware
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  res.status(403).json({ ok: false, error: "ACCESS_DENIED" });
}

// 🩺 Health
app.get("/health", (_req, res) => res.json({ ok: true, message: "🦁 Simba Ledger API healthy" }));

// 🛣️ Routes
app.use("/auth", authRoutes);
app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/ledger/notifications", requireAuth, notificationsRoutes);
app.use("/pagt", requireAuth, pagtRoutes);
app.use("/admin", requireAuth, requireAdmin, adminRoutes);

// 🕸️ WebSocket Setup
const server = app.listen(PORT, () => console.log(`🦁 API + WS running on port ${PORT}`));
const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("🟢 WebSocket client connected");
  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg);

      if (parsed.type === "register" && parsed.member_id) {
        clients.set(parsed.member_id, ws);
        ws.send(JSON.stringify({ type: "ack", message: "Registered for updates" }));
      }

      if (parsed.type === "admin_register" && parsed.role === "admin") {
        clients.set(`admin:${parsed.member_id}`, ws);
        ws.send(JSON.stringify({ type: "ack", message: "Admin dashboard connected" }));
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });
  ws.on("close", () => console.log("🔴 WS client disconnected"));
});

// 🚀 Helper: Broadcast to admins
function notifyAdmins(payload) {
  for (const [key, ws] of clients.entries()) {
    if (key.startsWith("admin:") && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}

// 🕒 CRON: STAR Award Job
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running STAR award job...");
  const newAwards = await awardStarsFromSharesJob(pool);
  newAwards.forEach((award) => {
    const ws = clients.get(award.member_id);
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "star_award",
          message: `⭐ You earned ${award.delta} STAR!`,
        })
      );
    }
    notifyAdmins({
      type: "star_award_event",
      member_id: award.member_id,
      delta: award.delta,
      timestamp: new Date().toISOString(),
    });
  });
});

// 🔔 CRON: Share Reminder
cron.schedule("*/10 * * * *", async () => {
  console.log("🔔 Checking for share reminders...");
  const pending = await pool.query(`
    SELECT member_id, COUNT(*) AS count
    FROM share_events
    WHERE awarded IS FALSE OR awarded IS NULL
    GROUP BY member_id;
  `);
  pending.rows.forEach((row) => {
    const { member_id, count } = row;
    const remaining = 3 - (count % 3);
    if (remaining > 0 && remaining < 3) {
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

// 🧱 404 Fallback
app.use((req, res) =>
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.originalUrl })
);

