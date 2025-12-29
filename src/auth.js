import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// Serialize user into the session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export function initAuth() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in env");
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        // For now: return the Google profile.
        // Next step: upsert into Postgres users table.
        return done(null, {
          google_id: profile.id,
          email: profile.emails?.[0]?.value || null,
          name: profile.displayName || null,
          picture: profile.photos?.[0]?.value || null,
        });
      }
    )
  );

  return passport;
}
