import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import {
  getDefaultPortfolio,
  getCashBalance,
  getHoldings,
  getPortfolioSummary,
  getRecentTransactions,
  getPositionByTicker,
  getPositionTransactions,
  getUserPortfolios,
} from "../services/portfolio";
import { getPriceHistory } from "../services/prices";
import { db } from "@pip/db/db";
import { portfolios } from "@pip/db/schema";
import { eq, and } from "drizzle-orm";
import type { HoldingDTO, PriceBarDTO, PortfolioSummaryDTO, HoldingsWithHistoryDTO } from "../dto/holdings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Aggregate each holding's daily close prices into a single portfolio value
 * series. For any date a holding has no bar, its contribution is 0 (e.g. it
 * wasn't yet in the portfolio). Dates are sorted oldest-first.
 */
function buildPortfolioHistory(holdings: HoldingDTO[]): PriceBarDTO[] {
  if (holdings.length === 0) return [];
  const dateSet = new Set<string>();
  for (const h of holdings) {
    for (const bar of h.priceHistory) dateSet.add(bar.date);
  }
  const dates = [...dateSet].sort();
  return dates.map((date) => {
    let value = 0;
    for (const h of holdings) {
      const bar = h.priceHistory.find((b) => b.date === date);
      if (bar) value += h.shares * bar.close;
    }
    return { date, value };
  });
}

export const portfolioRouter = router({
  /** User's portfolio list (for selects/switcher) */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserPortfolios(ctx.userId);
  }),

  /** Full summary metrics for the user's default portfolio */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const portfolio = await getDefaultPortfolio(ctx.userId);
    if (!portfolio) return null;
    return getPortfolioSummary(portfolio.id, ctx.userId);
  }),

  /** Holdings (open positions with price-enriched metrics) */
  holdings: protectedProcedure.query(async ({ ctx }) => {
    const portfolio = await getDefaultPortfolio(ctx.userId);
    if (!portfolio) return [];
    return getHoldings(portfolio.id);
  }),

  /**
   * Holdings page payload — holdings + 30-day price history + portfolio summary
   * in a single round-trip. Replaces the previous pattern of calling
   * portfolio.holdings + N × portfolio.priceHistory.
   */
  holdingsWithHistory: protectedProcedure.query(async ({ ctx }): Promise<HoldingsWithHistoryDTO> => {
    const portfolio = await getDefaultPortfolio(ctx.userId);
    if (!portfolio) return { holdings: [], portfolioHistory: [], summary: null };

    const [holdings, cash] = await Promise.all([
      getHoldings(portfolio.id),
      getCashBalance(portfolio.id, portfolio.currency),
    ]);

    const histories = await Promise.all(
      holdings.map((h) => getPriceHistory(h.ticker, 30)),
    );

    const holdingDTOs: HoldingDTO[] = holdings.map((h, i) => ({
      positionId:       h.positionId,
      securityId:       h.securityId,
      ticker:           h.ticker,
      name:             h.name,
      assetClass:       h.assetClass,
      sector:           h.sector,
      shares:           h.shares,
      avgCostBasis:     h.avgCostBasis,
      currentPrice:     h.currentPrice,
      previousClose:    h.previousClose,
      marketValue:      h.marketValue,
      totalCost:        h.totalCost,
      unrealizedPnl:    h.unrealizedPnl,
      unrealizedPnlPct: h.unrealizedPnlPct,
      dailyPnl:         h.dailyPnl,
      dailyChangePct:   h.dailyChangePct,
      portfolioWeight:  h.portfolioWeight,
      priceHistory:     (histories[i] ?? []).map((b) => ({ date: b.date, close: b.close })),
    }));

    const portfolioHistory = buildPortfolioHistory(holdingDTOs);

    const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
    const investedCapital  = holdings.reduce((s, h) => s + h.totalCost, 0);
    const totalValue       = totalMarketValue + cash;
    const unrealizedPnl    = totalMarketValue - investedCapital;
    const unrealizedPnlPct = investedCapital > 0 ? (unrealizedPnl / investedCapital) * 100 : 0;
    const dailyPnl         = holdings.reduce((s, h) => s + h.dailyPnl, 0);
    const prevMarketValue  = totalMarketValue - dailyPnl;
    const dailyPnlPct      = prevMarketValue > 0 ? (dailyPnl / prevMarketValue) * 100 : 0;

    const summary: PortfolioSummaryDTO = {
      portfolioId:      portfolio.id,
      portfolioName:    portfolio.name,
      currency:         portfolio.currency,
      positionCount:    holdings.length,
      totalValue,
      investedCapital,
      cashBalance:      cash,
      unrealizedPnl,
      unrealizedPnlPct,
      dailyPnl,
      dailyPnlPct,
      totalReturn:      unrealizedPnl,
      totalReturnPct:   unrealizedPnlPct,
    };

    return { holdings: holdingDTOs, portfolioHistory, summary };
  }),

  /** Recent transactions (default 20) */
  transactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];
      return getRecentTransactions(portfolio.id, input?.limit ?? 20);
    }),

  /** Basic portfolio record */
  detail: protectedProcedure.query(async ({ ctx }) => {
    return getDefaultPortfolio(ctx.userId);
  }),

  /** Single position + its transactions, by ticker */
  positionDetail: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) throw new TRPCError({ code: "NOT_FOUND", message: "No portfolio found." });

      const position = await getPositionByTicker(portfolio.id, input.ticker);
      if (!position) throw new TRPCError({ code: "NOT_FOUND", message: `No open position for ${input.ticker}.` });

      const txns = await getPositionTransactions(position.positionId);
      return { position, transactions: txns };
    }),

  /**
   * Daily OHLCV bars for a single ticker.
   * Used by the holdings sparklines and the position detail chart.
   */
  priceHistory: protectedProcedure
    .input(z.object({
      ticker: z.string().toUpperCase(),
      days:   z.number().min(7).max(365).default(30),
    }))
    .query(async ({ input }) => {
      return getPriceHistory(input.ticker, input.days);
    }),

  /** Create a new portfolio */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      currency: z.string().default("USD"),
      benchmarkTicker: z.string().default("SPY"),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `port_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await db.insert(portfolios).values({
        id,
        userId: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        currency: input.currency,
        benchmarkTicker: input.benchmarkTicker,
        isDefault: false,
      });
      return { id };
    }),

  /** Set a portfolio as the user's default (clears the flag on all others). */
  setDefault: protectedProcedure
    .input(z.object({ portfolioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const rows = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(and(eq(portfolios.id, input.portfolioId), eq(portfolios.userId, ctx.userId)))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // Clear then set in two statements (SQLite-safe; Neon handles this fine)
      await db
        .update(portfolios)
        .set({ isDefault: false })
        .where(eq(portfolios.userId, ctx.userId));
      await db
        .update(portfolios)
        .set({ isDefault: true })
        .where(eq(portfolios.id, input.portfolioId));
    }),

  /** Delete a portfolio the user owns. */
  delete: protectedProcedure
    .input(z.object({ portfolioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(and(eq(portfolios.id, input.portfolioId), eq(portfolios.userId, ctx.userId)))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(portfolios).where(eq(portfolios.id, input.portfolioId));
    }),
});
