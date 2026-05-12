import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { getPriceSeriesFromDB } from "../services/prices";
import { runBacktest } from "../services/backtest";
import type { BacktestResult, BacktestConfig } from "../services/backtest";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type BacktestResultDTO = BacktestResult;

// ─── Input schema ─────────────────────────────────────────────────────────────

const StrategySchema = z.discriminatedUnion("strategy", [
  z.object({
    strategy:       z.literal("buy_hold"),
    tickers:        z.array(z.string().min(1).max(10)).min(1).max(20),
    lookbackDays:   z.number().int().min(60).max(730).default(365),
    initialCapital: z.number().positive().default(100_000),
  }),
  z.object({
    strategy:       z.literal("sma_cross"),
    tickers:        z.array(z.string().min(1).max(10)).min(1).max(20),
    lookbackDays:   z.number().int().min(60).max(730).default(365),
    initialCapital: z.number().positive().default(100_000),
    fastSma:        z.number().int().min(5).max(50).default(20),
    slowSma:        z.number().int().min(20).max(200).default(50),
  }),
  z.object({
    strategy:          z.literal("momentum"),
    tickers:           z.array(z.string().min(1).max(10)).min(2).max(20),
    lookbackDays:      z.number().int().min(60).max(730).default(365),
    initialCapital:    z.number().positive().default(100_000),
    momentumLookback:  z.number().int().min(10).max(252).default(63),
    topN:              z.number().int().min(1).max(10).default(3),
    rebalanceFreq:     z.enum(["weekly", "monthly"]).default("monthly"),
  }),
  z.object({
    strategy:        z.literal("mean_reversion"),
    tickers:         z.array(z.string().min(1).max(10)).min(1).max(20),
    lookbackDays:    z.number().int().min(60).max(730).default(365),
    initialCapital:  z.number().positive().default(100_000),
    smaPeriod:       z.number().int().min(5).max(100).default(20),
    entryThreshold:  z.number().min(0.01).max(0.3).default(0.05),
    exitThreshold:   z.number().min(0.005).max(0.2).default(0.02),
  }),
]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const backtestRouter = router({
  /** Tickers available for backtesting (user's holdings). */
  availableTickers: protectedProcedure
    .query(async ({ ctx }): Promise<string[]> => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];
      const holdings = await getHoldings(portfolio.id);
      return holdings.map((h) => h.ticker);
    }),

  /** Run a backtest against historical price data. */
  run: protectedProcedure
    .input(StrategySchema)
    .query(async ({ input }): Promise<BacktestResultDTO> => {
      const { lookbackDays, initialCapital } = input;
      const tickers = input.tickers.map((t) => t.toUpperCase());

      // Fetch price data — extra buffer for SMA warm-up periods
      const maxWarmup = input.strategy === "sma_cross"
        ? (input.slowSma ?? 50)
        : input.strategy === "momentum"
        ? (input.momentumLookback ?? 63)
        : input.strategy === "mean_reversion"
        ? (input.smaPeriod ?? 20)
        : 0;

      const allTickers = [...new Set([...tickers, "SPY"])];
      const priceMap = await getPriceSeriesFromDB(allTickers, lookbackDays + maxWarmup + 20);

      const spySeries = priceMap.get("SPY") ?? [];

      // Remove SPY from portfolio tickers if not explicitly requested
      const portfolioMap = new Map<string, typeof spySeries>();
      for (const ticker of tickers) {
        portfolioMap.set(ticker, priceMap.get(ticker) ?? []);
      }

      const config: BacktestConfig = {
        ...input,
        tickers,
        initialCapital,
      };

      return runBacktest(config, portfolioMap, spySeries);
    }),

  /** Run the same config on a second strategy for comparison. */
  compare: protectedProcedure
    .input(
      z.object({
        primary:  StrategySchema,
        baseline: StrategySchema,
      }),
    )
    .query(async ({ input }): Promise<{ primary: BacktestResultDTO; baseline: BacktestResultDTO }> => {
      const primaryTickers  = input.primary.tickers.map((t) => t.toUpperCase());
      const baselineTickers = input.baseline.tickers.map((t) => t.toUpperCase());
      const allTickers      = [...new Set([...primaryTickers, ...baselineTickers, "SPY"])];
      const days = Math.max(input.primary.lookbackDays, input.baseline.lookbackDays) + 100;

      const priceMap = await getPriceSeriesFromDB(allTickers, days);
      const spySeries = priceMap.get("SPY") ?? [];

      const pMap1 = new Map(primaryTickers.map((t) => [t, priceMap.get(t) ?? []]));
      const pMap2 = new Map(baselineTickers.map((t) => [t, priceMap.get(t) ?? []]));

      const [primary, baseline] = await Promise.all([
        runBacktest({ ...input.primary,  tickers: primaryTickers },  pMap1, spySeries),
        runBacktest({ ...input.baseline, tickers: baselineTickers }, pMap2, spySeries),
      ]);

      return { primary, baseline };
    }),
});
