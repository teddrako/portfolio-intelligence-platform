import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@pip/db/db";
import { aiReports, reportTypes } from "@pip/db/schema";
import { checkRateLimit, acquireJobLock, releaseJobLock, withCache, invalidateCache } from "../lib/redis";
import { toReportDTO } from "../dto/reports";
import { callAI, buildPrompt, AI_MODEL } from "../lib/ai";
import { getDefaultPortfolio, getHoldings, getCashBalance, getPortfolioSummary } from "../services/portfolio";

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
          model: AI_MODEL,
          status: "pending",
          content: "",
        });

        // ── ④ Fetch portfolio context & generate with Gemini ─────────────────
        const portfolio = input.portfolioId
          ? null // caller passed explicit portfolioId; resolved below
          : await getDefaultPortfolio(ctx.userId);

        const resolvedPortfolioId = input.portfolioId ?? portfolio?.id ?? null;

        const [holdings, summary] = resolvedPortfolioId
          ? await Promise.all([
              getHoldings(resolvedPortfolioId),
              getPortfolioSummary(resolvedPortfolioId, ctx.userId),
            ])
          : [[], null];

        const prompt = buildPrompt({
          type: input.type,
          ticker: input.ticker,
          customPrompt: input.prompt,
          holdings,
          summary,
          dateStr,
        });

        let content: string;
        let tokensUsed: number | null = null;

        try {
          const result = await callAI(prompt);
          content = result.content;
          tokensUsed = result.tokensUsed;
        } catch (aiErr) {
          await db
            .update(aiReports)
            .set({ status: "failed", content: `Generation failed: ${String(aiErr)}` })
            .where(eq(aiReports.id, reportId));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI generation failed." });
        }

        await db
          .update(aiReports)
          .set({ status: "completed", content, tokensUsed, model: AI_MODEL })
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
