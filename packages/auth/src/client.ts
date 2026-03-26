import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_APP_URL must be set in Vercel env vars to your production domain.
// When unset in the browser, better-auth defaults to window.location.origin
// (same-origin), which is correct — no fallback needed.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession, getSession } = authClient;
