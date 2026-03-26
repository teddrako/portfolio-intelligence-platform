import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@pip/db/db";
import { aiReports, reportTypes } from "@pip/db/schema";
import { checkRateLimit, acquireJobLock, releaseJobLock, withCache, invalidateCache } from "../lib/redis";
import { toReportDTO } from "../dto/reports";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max AI report generations per user per hour */
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600;

/** How long a generation job lock is held before auto-expiring (crash safety) */
const LOCK_TTL_SECONDS = 90;

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily_close:       "Daily Close",
  morning_brief:     "Morning Brief",
  custom:            "Custom",
  security_analysis: "Security Analysis",
  risk_preview:      "Risk Preview",
  portfolio_summary: "Portfolio Summary",
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiReportsRouter = router({
  /**
   * List the authenticated user's AI reports.
   * Cached per-user for 30 s to absorb repeated page loads.
   * Cache is busted after a successful generate().
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = `cache:ai_reports:${ctx.userId}`;
    const rows = await withCache(cacheKey, 30, () =>
      db
        .select()
        .from(aiReports)
        .where(eq(aiReports.userId, ctx.userId))
        .orderBy(desc(aiReports.createdAt))
        .limit(20),
    );
    return rows.map(toReportDTO);
  }),

  /**
   * Trigger AI report generation.
   *
   * ① Rate limiting  — 10 reports per user per hour (fixed window via Redis INCR).
   * ② Job-lock dedup — only one in-flight report per (user × type) at a time
   *                    (Redis SET NX EX; released in finally block).
   */
  generate: protectedProcedure
    .input(
      z.object({
        type: z.enum(reportTypes),
        portfolioId: z.string().optional(),
        /** Required for security_analysis type */
        ticker: z.string().toUpperCase().optional(),
        /** Free-form prompt for custom reports */
        prompt: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ── ① Rate limit ────────────────────────────────────────────────────────
      const rlKey = `rl:ai_report:${ctx.userId}`;
      const rl = await checkRateLimit(rlKey, RATE_LIMIT, RATE_WINDOW_SECONDS);

      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            `AI report limit reached (${RATE_LIMIT}/hr). ` +
            `Resets in ${Math.ceil(rl.resetInSeconds / 60)} minute(s).`,
        });
      }

      // ── ② Job-lock dedup ────────────────────────────────────────────────────
      const lockKey = `lock:ai_report:${ctx.userId}:${input.type}`;
      const acquired = await acquireJobLock(lockKey, LOCK_TTL_SECONDS);

      if (!acquired) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            `A "${REPORT_TYPE_LABELS[input.type] ?? input.type}" report is already being generated. ` +
            `Please wait for it to finish.`,
        });
      }

      try {
        // ── ③ Persist a pending record ────────────────────────────────────────
        const reportId = newId("rep");
        const label = REPORT_TYPE_LABELS[input.type] ?? input.type;
        const dateStr = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        await db.insert(aiReports).values({
          id: reportId,
          userId: ctx.userId,
          portfolioId: input.portfolioId ?? null,
          type: input.type,
          title: `${label} — ${dateStr}`,
          prompt: input.prompt ?? null,
          model: "claude-opus-4-6",
          status: "pending",
          content: "",
        });

        // ── ④ Run generation (placeholder until AI integration) ───────────────
        //
        // In production, push a job onto a queue (Trigger.dev, Inngest, BullMQ…)
        // and return the reportId so the client can poll for completion.
        // The job-lock prevents the same report from being enqueued twice.
        //
        // For now we resolve synchronously with placeholder markdown.
        const lines = [
          `# ${label} — ${dateStr}`,
          "",
          "> _This is a placeholder. Wire up the Claude API in the generation job to produce real content._",
          "",
          `**Type:** ${label}`,
          input.ticker ? `**Ticker:** ${input.ticker}` : "",
          input.portfolioId ? `**Portfolio ID:** ${input.portfolioId}` : "",
          input.prompt ? `\n**Prompt:** ${input.prompt}` : "",
        ].filter(Boolean);

        await db
          .update(aiReports)
          .set({ status: "completed", content: lines.join("\n") })
          .where(eq(aiReports.id, reportId));

        // ── ⑤ Bust the user's cached list so it reflects the new report ───────
        await invalidateCache(`cache:ai_reports:${ctx.userId}`);

        return {
          reportId,
          remaining: rl.remaining,
          message: "Report generated.",
        };
      } finally {
        // Release the lock immediately rather than waiting for the TTL
        await releaseJobLock(lockKey);
      }
    }),

  /** Fetch a single report by ID (must belong to authenticated user). */
  get: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(aiReports)
        .where(eq(aiReports.id, input.reportId))
        .limit(1);

      const report = rows[0];
      if (!report || report.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return toReportDTO(report);
    }),
});
