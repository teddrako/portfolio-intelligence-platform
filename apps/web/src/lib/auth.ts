import { auth } from "@pip/auth/server";
import { headers } from "next/headers";

/**
 * Server-side session helper for Server Components and Route Handlers.
 * Returns null when no session exists.
 */
export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
