import { z } from "zod";
import { randomUUID, createHash } from "crypto";
import { protectedProcedure, router } from "../trpc";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { getQuote } from "../services/prices";
import { getFundamentals, hasFmpKey } from "../services/fundamentals";
import {
  runDCF,
  runSensitivity,
  suggestAssumptions,
  computeHistoricalFCFF,
  computeHistoricalGrowthRate,
} from "../services/dcf";
import { db } from "@pip/db/db";
import { dcfValuations } from "@pip/db/schema";
import { eq, and } from "drizzle-orm";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface FcffRowDTO {
  fiscalYear:          number;
  // Income statement
  revenue:             number;
  grossProfit:         number;
  ebitda:              number;
  ebit:                number;
  netIncome:           number;
  eps:                 number;
  interestExpense:     number;
  // Cash flow
  depreciation:        number;
  operatingCashFlow:   number;
  capitalExpenditures: number;
  freeCashFlow:        number;
  // FCF bridge
  nopat:               number;   // EBIT × (1 − taxRate)
  fcff:                number;   // NOPAT + D&A − CapEx
  // Balance sheet
  totalDebt:           number;
  cashAndEquivalents:  number;
  totalEquity:         number;
  taxRate:             number;
  // Computed metrics (null if revenue = 0)
  grossMargin:         number | null;   // %
  ebitMargin:          number | null;   // %
  netMargin:           number | null;   // %
  revenueGrowth:       number | null;   // YoY %
}

export interface DcfResultDTO {
  ticker:           string;
  intrinsicValue:   number;
  currentPrice:     number | null;
  upDownside:       number | null;
  enterpriseValue:  number;
  equityValue:      number;
  pvOfProjected:    number;
  pvOfTerminal:     number;
  terminalValue:    number;
  baseFcff:         number;
  netDebt:          number;
  sharesOutstanding: number;
  mostRecentYear:   number;
  projectedFcff:    Array<{ year: number; fcff: number; pv: number }>;
  assumptions:      { wacc: number; terminalGrowth: number; projectionYears: number; fcffGrowthRate: number };
  historicalFcff:   FcffRowDTO[];
  suggestedAssumptions: { wacc: number; terminalGrowth: number; projectionYears: number; fcffGrowthRate: number };
  // EV trading multiples (based on most recent year)
  evToEbitda:       number | null;
  evToRevenue:      number | null;
  priceToEarnings:  number | null;
  evToFcf:          number | null;
  hasFmpKey:        boolean;
  dataSource:       "fmp" | "none";
}

export interface SensitivityDTO {
  ticker: string;
  cells: Array<{
    wacc:           number;
    terminalGrowth: number;
    intrinsicValue: number;
    upDownside:     number | null;
  }>;
  waccValues:         number[];
  terminalGrowthValues: number[];
}

export interface PortfolioValuationSummaryDTO {
  ticker:         string;
  name:           string;
  marketValue:    number;
  portfolioWeight: number;
  intrinsicValue: number | null;
  currentPrice:   number | null;
  upDownside:     number | null;
  status:         "valued" | "no_data" | "no_key";
}

// ─── Assumption input schema ──────────────────────────────────────────────────

const AssumptionsInput = z.object({
  wacc:            z.number().min(0.01).max(0.5).default(0.10),
  terminalGrowth:  z.number().min(0).max(0.15).default(0.025),
  projectionYears: z.number().int().min(1).max(10).default(5),
  fcffGrowthRate:  z.number().min(-0.2).max(0.4).default(0.07),
});

// ─── Cache helpers ────────────────────────────────────────────────────────────

function assumptionHash(ticker: string, a: z.infer<typeof AssumptionsInput>): string {
  return createHash("sha1")
    .update(`${ticker}:${a.wacc}:${a.terminalGrowth}:${a.projectionYears}:${a.fcffGrowthRate}`)
    .digest("hex")
    .slice(0, 16);
}

async function getCachedDcf(ticker: string, hash: string) {
  const rows = await db
    .select()
    .from(dcfValuations)
    .where(and(eq(dcfValuations.ticker, ticker), eq(dcfValuations.assumptionHash, hash)))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertDcf(
  ticker:    string,
  securityId: string,
  hash:      string,
  a:         z.infer<typeof AssumptionsInput>,
  result:    ReturnType<typeof runDCF>,
  currentPrice: number | null,
): Promise<void> {
  await db
    .insert(dcfValuations)
    .values({
      id:             randomUUID(),
      securityId,
      ticker,
      wacc:           String(a.wacc),
      terminalGrowth: String(a.terminalGrowth),
      projectionYears: String(a.projectionYears),
      fcffGrowthRate: String(a.fcffGrowthRate),
      intrinsicValue: String(result.intrinsicValue),
      currentPrice:   currentPrice ? String(currentPrice) : null,
      upDownside:     result.upDownside != null ? String(result.upDownside) : null,
      enterpriseValue: String(result.enterpriseValue),
      equityValue:    String(result.equityValue),
      projectedFcff:  JSON.stringify(result.projectedFcff),
      assumptionHash: hash,
      computedAt:     new Date(),
    })
    .onConflictDoUpdate({
      target: [dcfValuations.ticker, dcfValuations.assumptionHash],
      set: {
        intrinsicValue: String(result.intrinsicValue),
        currentPrice:   currentPrice ? String(currentPrice) : null,
        upDownside:     result.upDownside != null ? String(result.upDownside) : null,
        enterpriseValue: String(result.enterpriseValue),
        equityValue:    String(result.equityValue),
        projectedFcff:  JSON.stringify(result.projectedFcff),
        computedAt:     new Date(),
      },
    });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const valuationRouter = router({
  /** Full DCF for a single ticker with custom or default assumptions. */
  dcf: protectedProcedure
    .input(
      z.object({
        ticker:      z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        assumptions: AssumptionsInput.optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<DcfResultDTO> => {
      const { ticker } = input;

      const [history, quote] = await Promise.all([
        getFundamentals(ticker, 5),
        getQuote(ticker),
      ]);

      const currentPrice = quote?.price ?? null;

      const suggested = suggestAssumptions(history);
      const assumptions = input.assumptions ?? suggested;

      const empty: DcfResultDTO = {
        ticker,
        intrinsicValue:   0,
        currentPrice,
        upDownside:       null,
        enterpriseValue:  0,
        equityValue:      0,
        pvOfProjected:    0,
        pvOfTerminal:     0,
        terminalValue:    0,
        baseFcff:         0,
        netDebt:          0,
        sharesOutstanding: 0,
        mostRecentYear:   0,
        projectedFcff:    [],
        assumptions,
        historicalFcff:   [],
        suggestedAssumptions: suggested,
        evToEbitda:       null,
        evToRevenue:      null,
        priceToEarnings:  null,
        evToFcf:          null,
        hasFmpKey:        hasFmpKey(),
        dataSource:       "none",
      };

      if (history.length === 0) return empty;

      const sorted     = history.slice().sort((a, b) => b.fiscalYear - a.fiscalYear);
      const mostRecent = sorted[0]!;

      const result = runDCF(mostRecent, history, assumptions, currentPrice);

      const historicalFcff: FcffRowDTO[] = sorted.map((row, i) => {
        const prevRow     = sorted[i + 1]; // sorted most-recent-first, so i+1 is older
        const nopat       = row.ebit * (1 - row.taxRate);
        const fcff        = computeHistoricalFCFF(row);
        const grossMargin = row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : null;
        const ebitMargin  = row.revenue > 0 ? (row.ebit        / row.revenue) * 100 : null;
        const netMargin   = row.revenue > 0 ? (row.netIncome   / row.revenue) * 100 : null;
        const revenueGrowth =
          prevRow && prevRow.revenue > 0
            ? ((row.revenue - prevRow.revenue) / prevRow.revenue) * 100
            : null;
        return {
          fiscalYear:          row.fiscalYear,
          revenue:             row.revenue,
          grossProfit:         row.grossProfit,
          ebitda:              row.ebitda,
          ebit:                row.ebit,
          netIncome:           row.netIncome,
          eps:                 row.eps,
          interestExpense:     row.interestExpense,
          depreciation:        row.depreciation,
          operatingCashFlow:   row.operatingCashFlow,
          capitalExpenditures: row.capitalExpenditures,
          freeCashFlow:        row.freeCashFlow,
          nopat,
          fcff,
          totalDebt:           row.totalDebt,
          cashAndEquivalents:  row.cashAndEquivalents,
          totalEquity:         row.totalEquity,
          taxRate:             row.taxRate,
          grossMargin,
          ebitMargin,
          netMargin,
          revenueGrowth,
        };
      });

      // EV multiples vs. most recent year
      const evToEbitda     = mostRecent.ebitda > 0 ? result.enterpriseValue / mostRecent.ebitda : null;
      const evToRevenue    = mostRecent.revenue > 0 ? result.enterpriseValue / mostRecent.revenue : null;
      const priceToEarnings =
        mostRecent.eps > 0 && currentPrice ? currentPrice / mostRecent.eps : null;
      const evToFcf        = result.baseFcff > 0 ? result.enterpriseValue / result.baseFcff : null;

      // Fire-and-forget cache persist
      import("@pip/db/schema")
        .then(({ securities: sec }) =>
          db.select({ id: sec.id }).from(sec).where(eq(sec.ticker, ticker)).limit(1),
        )
        .then((rows) => {
          if (rows[0]) {
            const hash = assumptionHash(ticker, assumptions as z.infer<typeof AssumptionsInput>);
            return upsertDcf(ticker, rows[0].id, hash, assumptions as z.infer<typeof AssumptionsInput>, result, currentPrice);
          }
        })
        .catch((err) => console.warn("[dcf] cache persist failed:", err));

      return {
        ticker,
        intrinsicValue:   result.intrinsicValue,
        currentPrice,
        upDownside:       result.upDownside,
        enterpriseValue:  result.enterpriseValue,
        equityValue:      result.equityValue,
        pvOfProjected:    result.pvOfProjected,
        pvOfTerminal:     result.pvOfTerminal,
        terminalValue:    result.terminalValue,
        baseFcff:         result.baseFcff,
        netDebt:          result.netDebt,
        sharesOutstanding: result.sharesOutstanding,
        mostRecentYear:   mostRecent.fiscalYear,
        projectedFcff:    result.projectedFcff,
        assumptions,
        historicalFcff,
        suggestedAssumptions: suggested,
        evToEbitda,
        evToRevenue,
        priceToEarnings,
        evToFcf,
        hasFmpKey:        hasFmpKey(),
        dataSource:       "fmp",
      };
    }),

  /** 5×5 sensitivity grid for a ticker. */
  sensitivity: protectedProcedure
    .input(
      z.object({
        ticker:      z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        assumptions: AssumptionsInput,
      }),
    )
    .query(async ({ input }): Promise<SensitivityDTO> => {
      const { ticker, assumptions } = input;

      const [history, quote] = await Promise.all([
        getFundamentals(ticker, 5),
        getQuote(ticker),
      ]);

      const currentPrice = quote?.price ?? null;

      if (history.length === 0) {
        return { ticker, cells: [], waccValues: [], terminalGrowthValues: [] };
      }

      const sorted     = history.slice().sort((a, b) => b.fiscalYear - a.fiscalYear);
      const mostRecent = sorted[0]!;

      const cells = runSensitivity(mostRecent, history, assumptions, currentPrice);

      const waccValues          = [...new Set(cells.map((c) => c.wacc))].sort((a, b) => a - b);
      const terminalGrowthValues = [...new Set(cells.map((c) => c.terminalGrowth))].sort((a, b) => a - b);

      return { ticker, cells, waccValues, terminalGrowthValues };
    }),

  /** Portfolio-wide summary: intrinsic value vs. current price for each holding. */
  compareToPortfolio: protectedProcedure
    .query(async ({ ctx }): Promise<PortfolioValuationSummaryDTO[]> => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];

      const holdings = await getHoldings(portfolio.id);
      if (holdings.length === 0) return [];

      const results = await Promise.allSettled(
        holdings.map(async (h) => {
          const [history, quote] = await Promise.all([
            getFundamentals(h.ticker, 5),
            getQuote(h.ticker),
          ]);

          const currentPrice = quote?.price ?? h.currentPrice;

          if (history.length === 0) {
            return {
              ticker:          h.ticker,
              name:            h.name,
              marketValue:     h.marketValue,
              portfolioWeight: h.portfolioWeight,
              intrinsicValue:  null,
              currentPrice,
              upDownside:      null,
              status:          (hasFmpKey() ? "no_data" : "no_key") as "no_data" | "no_key",
            };
          }

          const sorted     = history.slice().sort((a, b) => b.fiscalYear - a.fiscalYear);
          const mostRecent = sorted[0]!;
          const assumptions = suggestAssumptions(history);
          const result      = runDCF(mostRecent, history, assumptions, currentPrice);

          return {
            ticker:          h.ticker,
            name:            h.name,
            marketValue:     h.marketValue,
            portfolioWeight: h.portfolioWeight,
            intrinsicValue:  result.intrinsicValue,
            currentPrice,
            upDownside:      result.upDownside,
            status:          "valued" as const,
          };
        }),
      );

      return results.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        const h = holdings[i]!;
        return {
          ticker:          h.ticker,
          name:            h.name,
          marketValue:     h.marketValue,
          portfolioWeight: h.portfolioWeight,
          intrinsicValue:  null,
          currentPrice:    h.currentPrice,
          upDownside:      null,
          status:          "no_data" as const,
        };
      });
    }),
});
