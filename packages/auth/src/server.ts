import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { PostHog } from "posthog-node";
import { db } from "@pip/db/db";
import { users, accounts, sessions, verifications } from "@pip/db/schema";

// ─── Base URL ─────────────────────────────────────────────────────────────────
//
// Priority:
//   1. BETTER_AUTH_URL          — explicit override, set this in Vercel env vars
//                                 for production: https://yourdomain.com
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel system var, stable across deploys
//                                 (avoids per-preview-deployment URL churn that
//                                  would break registered Google OAuth callbacks)
//   3. localhost fallback       — local dev only
//
// NOTE: We intentionally skip VERCEL_URL because it changes every deployment
// and Google Console requires a static list of authorised redirect URIs.
function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// ─── PostHog (optional) ───────────────────────────────────────────────────────
//
// Guard against missing key — PostHog throws synchronously at construction if
// the key is absent, which would crash the module on import.
const _phKey = process.env.POSTHOG_KEY;
const posthog = _phKey
  ? new PostHog(_phKey, {
      host: process.env.POSTHOG_HOST,
      enableExceptionAutocapture: true,
    })
  : null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = betterAuth({
  baseURL: resolveBaseUrl(),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache session in cookie for 5 min to reduce DB reads
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!posthog) return;
          posthog.identify({
            distinctId: user.id,
            properties: {
              email: user.email,
              name: user.name,
              $set: { email: user.email, name: user.name },
            },
          });
          posthog.capture({
            distinctId: user.id,
            event: "user_signed_up",
            properties: { email: user.email, name: user.name },
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
