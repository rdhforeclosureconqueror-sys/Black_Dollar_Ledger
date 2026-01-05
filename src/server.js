// ✅ src/server.js — Simba API Core (Upgraded for Fitness / Study / Language / AI Integration)
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

// 🧩 Jobs + Routes
import { awardStarsFromSharesJob } from "./jobs/awardStarsFromShares.js";
import authRoutes from "./authRoutes.js";
import ledgerRoutes from "./ledgerRoutes.js";
import pagtRoutes from "./pagtRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationsRoutes from "./routes/notifications.js";

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
// 3️⃣ Database + Session Store
// ----------------------------------------------------
const { Pool } = pg;
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const PgSession = connectPgSimple(session);

const cookieDomain = NODE_ENV === "production" ? ".simbawaujamaa.com" : undefined;

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
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      domain: cookieDomain,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ----------------------------------------------------
// 4️⃣ Passport Google OAuth
// ----------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const ADMIN_EMAILS = [
  "rdhforeclosureconqueror@gmail.com",
  "rashad@simbawaujamaa.com",
  "admin@simbawaujamaa.com",
];

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_access, _refresh, profile, done) => {
      const email = profile.emails?.[0]?.value ?? null;
      const memberId = profile.id;

      try {
        const result = await pool.query(
          `
          INSERT INTO members (member_id, provider, display_name, email, photo)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (member_id)
          DO UPDATE SET 
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            photo = EXCLUDED.photo
          RETURNING role;
          `,
          [
            memberId,
            "google",
            profile.displayName,
            email,
            profile.photos?.[0]?.value ?? null,
          ]
        );

        const baseRole = result.rows[0]?.role || "user";
        const role = ADMIN_EMAILS.includes(email) ? "admin" : baseRole;

        const user = {
          id: memberId,
          displayName: profile.displayName,
          email,
          photo: profile.photos?.[0]?.value ?? null,
          role,
          provider: "google",
        };

        done(null, user);
      } catch (err) {
        console.error("❌ GoogleStrategy DB error:", err);
        done(err, null);
      }
    }
  )
);

// ----------------------------------------------------
// 5️⃣ Middleware + Helper Functions
// ----------------------------------------------------
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

function requireAdmin(req, res, next) {
  if (req.user && ADMIN_EMAILS.includes(req.user.email)) {
    req.user.role = "admin";
    return next();
  }
  res.status(403).json({ ok: false, error: "ACCESS_DENIED" });
}

// 🎁 Reward Engine (Embedded)
async function grantReward(memberId, category, trigger) {
  try {
    const rule = await pool.query(
      `SELECT xp_value, star_value FROM reward_rules WHERE category=$1 AND trigger=$2 LIMIT 1`,
      [category, trigger]
    );

    const xp = rule.rows[0]?.xp_value || 0;
    const stars = rule.rows[0]?.star_value || 0;

    if (xp !== 0)
      await pool.query(
        `INSERT INTO xp_transactions (member_id, delta, reason) VALUES ($1, $2, $3)`,
        [memberId, xp, `${category}:${trigger}`]
      );
    if (stars !== 0)
      await pool.query(
        `INSERT INTO star_transactions (member_id, delta, reason) VALUES ($1, $2, $3)`,
        [memberId, stars, `${category}:${trigger}`]
      );

    const ws = clients.get(memberId);
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "reward_update",
          category,
          xp,
          stars,
          message: `🏆 +${xp} XP • ⭐ +${stars} (${category}:${trigger})`,
        })
      );
    }

    for (const [key, socket] of clients.entries()) {
      if (key.startsWith("admin:") && socket.readyState === 1) {
        socket.send(
          JSON.stringify({
            type: "member_activity",
            member_id: memberId,
            category,
            trigger,
            xp,
            stars,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }

    return { ok: true, xp, stars };
  } catch (err) {
    console.error("❌ grantReward error:", err);
    return { ok: false, error: err.message };
  }
}

// ----------------------------------------------------
// 6️⃣ Routes
// ----------------------------------------------------
app.get("/health", (_req, res) =>
  res.json({ ok: true, message: "🦁 Simba API healthy" })
);

app.use("/auth", authRoutes);
app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/ledger/notifications", requireAuth, notificationsRoutes);
app.use("/pagt", requireAuth, pagtRoutes);
app.use("/admin", requireAuth, requireAdmin, adminRoutes);

// 🧠 New Phase 2 Systems
app.post("/fitness/log", requireAuth, async (req, res) => {
  const { type } = req.body; // workout | water
  try {
    await pool.query(
      `INSERT INTO fitness_events (member_id, event_type) VALUES ($1, $2)`,
      [req.user.id, type]
    );
    const trigger = type === "workout" ? "workout_complete" : "water_log";
    const reward = await grantReward(req.user.id, "fitness", trigger);
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/study/journal", requireAuth, async (req, res) => {
  const { title, content } = req.body;
  try {
    await pool.query(
      `INSERT INTO study_events (member_id, type, title, content) VALUES ($1, 'journal', $2, $3)`,
      [req.user.id, title, content]
    );
    const reward = await grantReward(req.user.id, "study", "journal_entry");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/study/share", requireAuth, async (req, res) => {
  const { topic } = req.body;
  try {
    await pool.query(
      `INSERT INTO study_events (member_id, type, title) VALUES ($1, 'share', $2)`,
      [req.user.id, topic]
    );
    const reward = await grantReward(req.user.id, "study", "share_completed");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/language/practice", requireAuth, async (req, res) => {
  const { language_key, practice_date, recordings } = req.body;
  try {
    await pool.query(
      `INSERT INTO language_events (member_id, language_key, practice_date, recordings_json)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, language_key, practice_date, JSON.stringify(recordings || [])]
    );
    const reward = await grantReward(req.user.id, "language", "daily_practice_complete");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/forms/submit", requireAuth, async (req, res) => {
  const { form_type, form_data } = req.body;
  try {
    await pool.query(
      `INSERT INTO form_submissions (member_id, form_type, form_json)
       VALUES ($1, $2, $3)`,
      [req.user.id, form_type, JSON.stringify(form_data)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/ai/session", requireAuth, async (req, res) => {
  const { session_id, summary } = req.body;
  try {
    await pool.query(
      `INSERT INTO ai_sessions (member_id, session_id, summary_json)
       VALUES ($1, $2, $3)`,
      [req.user.id, session_id, JSON.stringify(summary || {})]
    );
    const reward = await grantReward(req.user.id, "fitness", "workout_complete");
    res.json({ ok: true, reward });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 7️⃣ WebSocket + CRON Jobs
// ----------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`🦁 Simba API + WebSocket running on port ${PORT}`);
});

export const clients = new Map();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🟢 WebSocket connected");
  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === "register" && parsed.member_id)
        clients.set(parsed.member_id, ws);
      else if (parsed.type === "admin_register" && parsed.role === "admin")
        clients.set(`admin:${parsed.member_id}`, ws);
    } catch (err) {
      console.error("⚠️ WS message error:", err);
    }
  });
  ws.on("close", () => console.log("🔴 WebSocket disconnected"));
});

// ⭐ STAR Award Job
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running STAR award job...");
  const newAwards = await awardStarsFromSharesJob(pool);
  for (const award of newAwards) {
    const ws = clients.get(award.member_id);
    if (ws && ws.readyState === 1)
      ws.send(JSON.stringify({ type: "star_award", message: `⭐ You earned ${award.delta} STAR!` }));
  }
});

// 🔔 Share Reminder Job
cron.schedule("*/10 * * * *", async () => {
  console.log("🔔 Checking share reminders...");
  const pending = await pool.query(`
    SELECT member_id, COUNT(*) AS count FROM share_events
    WHERE awarded IS FALSE OR awarded IS NULL GROUP BY member_id;
  `);
  pending.rows.forEach((row) => {
    const remaining = 3 - (row.count % 3);
    if (remaining > 0 && remaining < 3) {
      const ws = clients.get(row.member_id);
      if (ws && ws.readyState === 1)
        ws.send(JSON.stringify({ type: "reminder", message: `🔸 ${remaining} more shares to your next STAR!` }));
    }
  });
});

// ----------------------------------------------------
// 8️⃣ Error Handling
// ----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error("💥 Server error:", err);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});
