import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCallerFactory, createContext, appRouter } from "@pip/api";
import { auth } from "@pip/auth/server";

const createCaller = createCallerFactory(appRouter);

/**
 * tRPC server-side caller for React Server Components.
 * Automatically injects the authenticated user from the request session.
 * Redirects to /sign-in if no valid session is found (safety net for stale cookies).
 *
 * @example
 * const caller = await trpc()
 * const summary = await caller.portfolio.summary()
 */
export const trpc = cache(async () => {
  const headersList = await headers();
  const devUserId = headersList.get("x-dev-user-id");

  if (devUserId) {
    return createCaller(createContext({ userId: devUserId }));
  }

  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return createCaller(createContext({ userId: session.user.id }));
});
