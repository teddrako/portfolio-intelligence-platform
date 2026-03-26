import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context";
import { posthog } from "./lib/posthog";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Requires an authenticated userId in context — throws UNAUTHORIZED otherwise. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  const result = await next({ ctx: { ...ctx, userId: ctx.userId } });
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    posthog.captureException(
      result.error.cause instanceof Error ? result.error.cause : new Error(result.error.message),
      ctx.userId,
    );
  }
  return result;
});
