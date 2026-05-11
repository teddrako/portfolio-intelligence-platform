/**
 * Pure risk analytics — no DB or external calls.
 *
 * All functions operate on plain arrays of numbers or typed date-return pairs.
 * The tRPC risk router is responsible for fetching price series and feeding
 * them into these functions.
 */

// ─── Internal math helpers ────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Sample covariance (n-1 denominator). */
function covariance(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i]! - my), 0) / (n - 1);
}

function variance(arr: number[]): number {
  return covariance(arr, arr);
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

// ─── Sector normalization ─────────────────────────────────────────────────────

const SECTOR_ALIAS: Record<string, string> = {
  "Consumer Cyclical":      "Consumer Discretionary",
  "Financial Services":     "Financials",
  "Basic Materials":        "Materials",
  "Consumer Defensive":     "Consumer Staples",
};

export function normalizeSector(sector: string | null): string {
  if (!sector) return "Other";
  return SECTOR_ALIAS[sector] ?? sector;
}

// ─── SPY sector weights (approximate, 2024) ────────────────────────────────────

export const SPY_SECTOR_WEIGHTS: Record<string, number> = {
  "Technology":               0.318,
  "Financials":               0.131,
  "Healthcare":               0.117,
  "Consumer Discretionary":   0.100,
  "Communication Services":   0.086,
  "Industrials":              0.083,
  "Consumer Staples":         0.064,
  "Energy":                   0.037,
  "Utilities":                0.026,
  "Real Estate":              0.023,
  "Materials":                0.023,
};

// ─── Beta ─────────────────────────────────────────────────────────────────────

/**
 * Computes the portfolio beta relative to a benchmark.
 * beta = cov(portfolio, benchmark) / var(benchmark)
 *
 * Returns 1 if the benchmark has zero variance (degenerate input).
 */
export function computeBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[],
): number {
  const benchVar = variance(benchmarkReturns);
  if (benchVar === 0) return 1;
  return covariance(portfolioReturns, benchmarkReturns) / benchVar;
}

// ─── Rolling beta ─────────────────────────────────────────────────────────────

/**
 * Computes beta over a rolling window.
 * Both input arrays must be pre-aligned by date (same indices = same date).
 * The output starts at index (window - 1) — there are no estimates before that.
 */
export function computeRollingBeta(
  portfolioReturnsByDate: Array<{ date: string; return: number }>,
  benchmarkReturnsByDate: Array<{ date: string; return: number }>,
  window = 60,
): Array<{ date: string; beta: number }> {
  const n = Math.min(portfolioReturnsByDate.length, benchmarkReturnsByDate.length);
  const result: Array<{ date: string; beta: number }> = [];
  for (let i = window - 1; i < n; i++) {
    const pSlice = portfolioReturnsByDate.slice(i - window + 1, i + 1).map((r) => r.return);
    const bSlice = benchmarkReturnsByDate.slice(i - window + 1, i + 1).map((r) => r.return);
    result.push({
      date: portfolioReturnsByDate[i]!.date,
      beta: computeBeta(pSlice, bSlice),
    });
  }
  return result;
}

// ─── Sector exposure ─────────────────────────────────────────────────────────

export interface SectorExposureRow {
  sector:     string;
  weight:     number;   // portfolio weight (0–1)
  marketValue: number;
  spyWeight:  number;   // SPY benchmark weight (0–1)
  overUnder:  number;   // weight − spyWeight
}

export function computeSectorExposure(
  holdings: Array<{ sector: string | null; marketValue: number }>,
): SectorExposureRow[] {
  const total = holdings.reduce((s, h) => s + h.marketValue, 0);
  if (total === 0) return [];

  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = normalizeSector(h.sector);
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }

  return [...sectorMap.entries()]
    .map(([sector, marketValue]) => {
      const weight     = marketValue / total;
      const spyWeight  = SPY_SECTOR_WEIGHTS[sector] ?? 0;
      return { sector, weight, marketValue, spyWeight, overUnder: weight - spyWeight };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
}

// ─── Herfindahl-Hirschman Index ───────────────────────────────────────────────

/**
 * HHI = Σ wᵢ², where wᵢ are portfolio weights (fractions summing to 1).
 * Range: 1/n (perfectly equal) → 1 (single position).
 */
export function computeHerfindahl(weights: number[]): number {
  return weights.reduce((s, w) => s + w * w, 0);
}

// ─── Pearson correlation matrix ───────────────────────────────────────────────

/**
 * Computes an N×N Pearson correlation matrix.
 * Each element of `returnSeries` is the daily return sequence for one ticker.
 * All inner arrays should be the same length (date-aligned before calling).
 */
export function computeCorrelationMatrix(returnSeries: number[][]): number[][] {
  const n = returnSeries.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1;
    for (let j = i + 1; j < n; j++) {
      const si = stddev(returnSeries[i]!);
      const sj = stddev(returnSeries[j]!);
      const corr = si > 0 && sj > 0
        ? covariance(returnSeries[i]!, returnSeries[j]!) / (si * sj)
        : 0;
      matrix[i]![j] = corr;
      matrix[j]![i] = corr;
    }
  }
  return matrix;
}

// ─── Drawdown ─────────────────────────────────────────────────────────────────

export interface DrawdownPoint {
  date:     string;
  value:    number;   // cumulative portfolio value, starting from 1.0
  peak:     number;   // running maximum of value
  drawdown: number;   // (value − peak) / peak — always ≤ 0
}

/**
 * Computes the running drawdown from a sequence of daily returns.
 * Value starts at 1.0; drawdown is the fractional loss from the running peak.
 */
export function computeDrawdown(
  returnsWithDates: Array<{ date: string; return: number }>,
): DrawdownPoint[] {
  let value = 1.0;
  let peak  = 1.0;
  return returnsWithDates.map(({ date, return: r }) => {
    value *= 1 + r;
    if (value > peak) peak = value;
    return { date, value, peak, drawdown: peak > 0 ? (value - peak) / peak : 0 };
  });
}

// ─── Portfolio value-weighted returns ─────────────────────────────────────────

/**
 * Computes daily portfolio-level returns from individual holding price series.
 *
 * Only dates present in ALL holdings' price series are included (inner join).
 * The portfolio value is Σ(shares_i × price_i(date)), so weights drift
 * naturally as prices move — no rebalancing is assumed.
 */
export function computePortfolioReturns(
  holdings: Array<{ ticker: string; shares: number }>,
  priceSeries: Map<string, Array<{ date: string; close: number }>>,
): Array<{ date: string; return: number }> {
  if (holdings.length === 0) return [];

  // Build ticker → (date → price) lookup
  const tickerPriceByDate = new Map<string, Map<string, number>>();
  for (const { ticker } of holdings) {
    const series  = priceSeries.get(ticker) ?? [];
    const byDate  = new Map<string, number>(series.map((b) => [b.date, b.close]));
    tickerPriceByDate.set(ticker, byDate);
  }

  // Inner-join: keep only dates where ALL holdings have a price
  const firstSeries = priceSeries.get(holdings[0]!.ticker) ?? [];
  const commonDates = firstSeries
    .map((b) => b.date)
    .filter((date) => holdings.every((h) => tickerPriceByDate.get(h.ticker)?.has(date)));

  if (commonDates.length < 2) return [];

  // Portfolio value series on common dates
  const valueSeries = commonDates.map((date) => ({
    date,
    value: holdings.reduce((s, h) => {
      return s + h.shares * (tickerPriceByDate.get(h.ticker)?.get(date) ?? 0);
    }, 0),
  }));

  // Daily percentage returns
  const returns: Array<{ date: string; return: number }> = [];
  for (let i = 1; i < valueSeries.length; i++) {
    const cur  = valueSeries[i]!;
    const prev = valueSeries[i - 1]!;
    if (prev.value > 0) {
      returns.push({ date: cur.date, return: (cur.value - prev.value) / prev.value });
    }
  }
  return returns;
}

// ─── Annualised volatility ────────────────────────────────────────────────────

/**
 * Annualised standard deviation of daily returns (252 trading days).
 * Returns null for fewer than 5 observations.
 */
export function computeAnnualizedVol(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 5) return null;
  return stddev(dailyReturns) * Math.sqrt(252);
}
