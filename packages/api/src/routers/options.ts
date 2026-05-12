import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { getOptionsChain, getExpirationDates } from "../services/optionsData";
import { payoffAtExpiration } from "../services/blackScholes";
import type { OptionsChainResult, EnrichedContract } from "../services/optionsData";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type OptionsChainDTO = OptionsChainResult;
export type OptionContractDTO = EnrichedContract;

export interface PayoffDTO {
  points:     Array<{ price: number; payoff: number }>;
  breakeven:  number;
  maxProfit:  number | null;   // null = unlimited (for naked calls)
  maxLoss:    number;
  premium:    number;
  strike:     number;
  type:       "call" | "put";
  long:       boolean;
}

export interface HoldingTickerDTO {
  ticker: string;
  name:   string;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const optionsRouter = router({
  /** Tickers the user holds — shown as quick-pick tabs in the UI. */
  holdingTickers: protectedProcedure
    .query(async ({ ctx }): Promise<HoldingTickerDTO[]> => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];
      const holdings = await getHoldings(portfolio.id);
      return holdings.map((h) => ({ ticker: h.ticker, name: h.name }));
    }),

  /** Available expiration dates for a ticker. */
  expirations: protectedProcedure
    .input(z.object({ ticker: z.string().min(1).max(10).transform((s) => s.toUpperCase()) }))
    .query(async ({ input }): Promise<string[]> => {
      return getExpirationDates(input.ticker);
    }),

  /** Full enriched options chain — calls + puts with computed Greeks. */
  chain: protectedProcedure
    .input(
      z.object({
        ticker:     z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .query(async ({ input }): Promise<OptionsChainDTO> => {
      return getOptionsChain(input.ticker, input.expiration);
    }),

  /** Payoff at expiration for a single option leg. */
  payoff: protectedProcedure
    .input(
      z.object({
        type:    z.enum(["call", "put"]),
        strike:  z.number().positive(),
        premium: z.number().min(0),
        long:    z.boolean().default(true),
        spot:    z.number().positive(),
      }),
    )
    .query(({ input }): PayoffDTO => {
      const { type, strike, premium, long, spot } = input;

      // Span ±40% around spot, always including breakeven
      const lo = spot * 0.6;
      const hi = spot * 1.4;

      const points = payoffAtExpiration(type, strike, premium, long, [lo, hi]);

      const breakeven =
        type === "call"
          ? strike + premium
          : strike - premium;

      const maxLoss = long ? premium : Infinity;
      const maxProfit =
        type === "call" && long   ? null                    // unlimited upside
        : type === "call" && !long ? premium                // short call = premium
        : type === "put"  && long  ? strike - premium       // put, long: K - prem
        :                            premium;              // short put: premium

      return {
        points,
        breakeven,
        maxProfit: maxProfit === Infinity ? null : maxProfit,
        maxLoss,
        premium,
        strike,
        type,
        long,
      };
    }),
});
