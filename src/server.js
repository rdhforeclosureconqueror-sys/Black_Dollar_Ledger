// ✅ src/server.js — Simba API Core
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
// 5️⃣ Middleware + Routes
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

// ✅ Health check route
app.get("/health", (_req, res) =>
  res.json({ ok: true, message: "🦁 Simba API healthy" })
);

// ✅ Mount routes
app.use("/auth", authRoutes);
app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/ledger/notifications", requireAuth, notificationsRoutes);
app.use("/pagt", requireAuth, pagtRoutes);
app.use("/admin", requireAuth, requireAdmin, adminRoutes);

// ----------------------------------------------------
// 6️⃣ WebSocket Setup
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
      if (parsed.type === "register" && parsed.member_id) {
        clients.set(parsed.member_id, ws);
      } else if (parsed.type === "admin_register" && parsed.role === "admin") {
        clients.set(`admin:${parsed.member_id}`, ws);
      }
    } catch (err) {
      console.error("⚠️ WS message error:", err);
    }
  });

  ws.on("close", () => console.log("🔴 WebSocket disconnected"));
});

// ----------------------------------------------------
// 7️⃣ CRON Jobs (STAR awarding + reminders)
// ----------------------------------------------------
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running STAR award job...");
  const newAwards = await awardStarsFromSharesJob(pool);

  for (const award of newAwards) {
    const ws = clients.get(award.member_id);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "star_award",
        message: `⭐ You earned ${award.delta} STAR!`,
      }));
    }

    // Notify admins
    for (const [key, socket] of clients.entries()) {
      if (key.startsWith("admin:") && socket.readyState === 1) {
        socket.send(JSON.stringify({
          type: "star_award_event",
          member_id: award.member_id,
          delta: award.delta,
          timestamp: new Date().toISOString(),
        }));
      }
    }
  }
});

cron.schedule("*/10 * * * *", async () => {
  console.log("🔔 Checking share reminders...");
  const pending = await pool.query(`
    SELECT member_id, COUNT(*) AS count
    FROM share_events
    WHERE awarded IS FALSE OR awarded IS NULL
    GROUP BY member_id;
  `);

  pending.rows.forEach((row) => {
    const remaining = 3 - (row.count % 3);
    if (remaining > 0 && remaining < 3) {
      const ws = clients.get(row.member_id);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: "reminder",
          message: `🔸 ${remaining} more shares to your next STAR!`,
        }));
      }
    }
  });
});

// ----------------------------------------------------
// 8️⃣ Error + 404 Handling
// ----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error("💥 Server error:", err);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});
