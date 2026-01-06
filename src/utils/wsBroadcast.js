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
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ----------------------------------------------------
// 4️⃣ Google OAuth Setup
// ----------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

const ADMIN_EMAILS = [
  "rdhforeclosureconqueror@gmail.com",
  "rashad@simbawaujamaa.com",
  "admin@simbawaujamaa.com",
];

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

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
        done(null, {
          id: memberId,
          email,
          displayName: profile.displayName,
          photo: profile.photos?.[0]?.value,
          role,
        });
      } catch (err) {
        console.error("❌ OAuth DB error:", err);
        done(err, null);
      }
    }
  )
);

// ----------------------------------------------------
// 5️⃣ Middleware
// ----------------------------------------------------
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
}

function requireAdmin(req, res, next) {
  if (req.user && ADMIN_EMAILS.includes(req.user.email)) return next();
  res.status(403).json({ ok: false, error: "ACCESS_DENIED" });
}

// ----------------------------------------------------
// 6️⃣ Routes
// ----------------------------------------------------
app.get("/health", (_req, res) =>
  res.json({ ok: true, message: "🦁 Simba API Healthy" })
);
app.use("/auth", authRoutes);
app.use("/ledger", requireAuth, ledgerRoutes);
app.use("/ledger/notifications", requireAuth, notificationsRoutes);
app.use("/pagt", requireAuth, pagtRoutes);
app.use("/admin", requireAuth, requireAdmin, adminRoutes);
app.use("/fitness", requireAuth, fitnessRoutes);
app.use("/study", requireAuth, studyRoutes);
app.use("/language", requireAuth, languageRoutes);
app.use("/ai", requireAuth, aiRoutes);

// ----------------------------------------------------
// 7️⃣ WebSocket Integration
// ----------------------------------------------------
export const clients = new Map();
const server = app.listen(PORT, () =>
  console.log(`🦁 Simba API running on port ${PORT}`)
);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🟢 WebSocket connected");
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "register" && data.member_id)
        clients.set(data.member_id, ws);
      if (data.type === "admin_register" && data.role === "admin")
        clients.set(`admin:${data.member_id}`, ws);
    } catch (e) {
      console.error("⚠️ WebSocket error:", e);
    }
  });
  ws.on("close", () => console.log("🔴 WebSocket disconnected"));
});

// ----------------------------------------------------
// 8️⃣ Cron Jobs
// ----------------------------------------------------
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running STAR share job...");
  try {
    const results = await awardStarsFromSharesJob(pool);
    results.forEach((r) =>
      broadcastToClients(r.member_id, {
        type: "star_award",
        message: `⭐ ${r.delta} STAR earned!`,
      })
    );
  } catch (err) {
    console.error("❌ Cron job failed:", err);
  }
});

cron.schedule("*/10 * * * *", async () => {
  console.log("🧠 Checking adaptive XP rewards...");
  try {
    await processReward(pool, clients);
  } catch (err) {
    console.error("❌ Reward process failed:", err);
  }
});

// ----------------------------------------------------
// 9️⃣ Error Handling
// ----------------------------------------------------
app.use((req, res) =>
  res
    .status(404)
    .json({ ok: false, error: "NOT_FOUND", path: req.originalUrl })
);
app.use((err, _req, res, _next) => {
  console.error("💥 Server Error:", err);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});
