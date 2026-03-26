import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@pip/api";
import { auth } from "@pip/auth/server";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // Dev bypass: middleware injects x-dev-user-id header when DEV_USER_ID is set
      const devUserId = req.headers.get("x-dev-user-id");
      if (devUserId) return createContext({ userId: devUserId });

      const session = await auth.api.getSession({ headers: req.headers });
      return createContext({ userId: session?.user?.id ?? null });
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? "<no-path>"}:`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
