/**
 * Backtesting engine — pure simulation functions, no I/O.
 *
 * Strategies implemented:
 *   buy_hold      — equal-weight buy on day 1, never trade again
 *   sma_cross     — golden/death cross on fast/slow SMA per ticker
 *   momentum      — monthly rebalance into top-N tickers by N-day return
 *   mean_reversion — buy when price drops below SMA × (1−threshold), sell on recovery
 *
 * All positions are long-only, no leverage, no short-selling.
 * Commissions: 0 (realistic for modern zero-commission brokers).
 * Prices used: adjusted close (or close if adj_close is unavailable).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyType = "buy_hold" | "sma_cross" | "momentum" | "mean_reversion";

export interface BacktestConfig {
  strategy:       StrategyType;
  tickers:        string[];
  initialCapital: number;
  // SMA crossover
  fastSma?:       number;   // default 20
  slowSma?:       number;   // default 50
  // Momentum rotation
  momentumLookback?: number; // default 63 (≈3 months)
  topN?:           number;   // default 3
  rebalanceFreq?:  "weekly" | "monthly";  // default monthly
  // Mean reversion
  smaPeriod?:      number;   // default 20
  entryThreshold?: number;   // default 0.05 (5% below SMA)
  exitThreshold?:  number;   // default 0.02 (2% above SMA)
}

export interface EquityPoint {
  date:           string;
  portfolioValue: number;
  benchmarkValue: number;
}

export interface Trade {
  date:   string;
  ticker: string;
  action: "buy" | "sell";
  shares: number;
  price:  number;
  value:  number;
}

export interface PerformanceMetrics {
  totalReturn:     number;   // total % return
  cagr:            number;   // annualised compounded return
  sharpe:          number;   // annualised Sharpe (0% risk-free)
  sortino:         number;   // annualised Sortino
  maxDrawdown:     number;   // most negative peak-to-trough (negative number)
  calmar:          number;   // CAGR / |max drawdown|
  winRate:         number;   // % of trades closed at a profit
  numTrades:       number;
  avgTradePnlPct:  number;   // average closed-trade return %
  volatility:      number;   // annualised daily return stddev
  benchmarkReturn: number;   // SPY buy-and-hold total return
  alpha:           number;   // excess return vs benchmark
  daysSimulated:   number;
}

export interface BacktestResult {
  equity:     EquityPoint[];
  trades:     Trade[];
  metrics:    PerformanceMetrics;
  config:     BacktestConfig;
  tickers:    string[];
  startDate:  string;
  endDate:    string;
  dataGaps:   string[];  // tickers with insufficient price history
}

// ─── Price series helpers ─────────────────────────────────────────────────────

type PriceSeries = Array<{ date: string; close: number }>;

/** Compute SMA over a window. Returns NaN when fewer than `period` data points. */
function sma(prices: number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += prices[i - j]!;
    result[i] = sum / period;
  }
  return result;
}

/** Returns for a price series. */
function dailyReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    r.push(prev > 0 ? (prices[i]! - prev) / prev : 0);
  }
  return r;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ─── Performance metrics ─────────────────────────────────────────────────────

function computeMetrics(
  equity:   EquityPoint[],
  trades:   Trade[],
  initial:  number,
): Omit<PerformanceMetrics, "benchmarkReturn" | "alpha"> {
  if (equity.length < 2) {
    return { totalReturn: 0, cagr: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, calmar: 0, winRate: 0, numTrades: 0, avgTradePnlPct: 0, volatility: 0, daysSimulated: 0 };
  }

  const values = equity.map((e) => e.portfolioValue);
  const first  = values[0]!;
  const last   = values[values.length - 1]!;
  const days   = equity.length;
  const years  = days / 252;

  const totalReturn = (last - first) / first;
  const cagr        = Math.pow(last / first, 1 / years) - 1;

  // Daily returns
  const rets     = dailyReturns(values);
  const avgRet   = mean(rets);
  const std      = stddev(rets, avgRet);
  const sharpe   = std > 0 ? (avgRet / std) * Math.sqrt(252) : 0;

  // Sortino (downside deviation)
  const downside  = rets.filter((r) => r < 0);
  const downStd   = stddev(downside, 0);
  const sortino   = downStd > 0 ? (avgRet / downStd) * Math.sqrt(252) : 0;

  // Max drawdown
  let peak = values[0]!;
  let maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const calmar = maxDD !== 0 ? cagr / Math.abs(maxDD) : 0;
  const vol    = std * Math.sqrt(252);

  // Trade stats — pair buys and sells by ticker (FIFO)
  const openTrades = new Map<string, { price: number; shares: number }[]>();
  let closedCount = 0;
  let closedWins  = 0;
  let closedPnlSum = 0;

  for (const t of trades) {
    if (t.action === "buy") {
      if (!openTrades.has(t.ticker)) openTrades.set(t.ticker, []);
      openTrades.get(t.ticker)!.push({ price: t.price, shares: t.shares });
    } else {
      const opens = openTrades.get(t.ticker) ?? [];
      let remaining = t.shares;
      while (remaining > 0 && opens.length > 0) {
        const open = opens[0]!;
        const matched = Math.min(open.shares, remaining);
        const pnlPct = (t.price - open.price) / open.price;
        closedPnlSum += pnlPct;
        if (pnlPct > 0) closedWins++;
        closedCount++;
        open.shares -= matched;
        remaining   -= matched;
        if (open.shares <= 0) opens.shift();
      }
    }
  }

  const winRate = closedCount > 0 ? closedWins / closedCount : 0;
  const avgTradePnlPct = closedCount > 0 ? closedPnlSum / closedCount : 0;

  return {
    totalReturn,
    cagr,
    sharpe,
    sortino,
    maxDrawdown: maxDD,
    calmar,
    winRate,
    numTrades:   trades.length,
    avgTradePnlPct,
    volatility:  vol,
    daysSimulated: days,
  };
}

// ─── Common date union ────────────────────────────────────────────────────────

function buildCommonDates(
  priceMap: Map<string, PriceSeries>,
  tickers:  string[],
): string[] {
  if (tickers.length === 0) return [];
  const sets = tickers.map((t) => new Set((priceMap.get(t) ?? []).map((r) => r.date)));
  const first = sets[0]!;
  const common = [...first].filter((d) => sets.every((s) => s.has(d)));
  return common.sort();
}

// ─── Strategy: Buy & Hold ─────────────────────────────────────────────────────

function runBuyAndHold(
  config:   BacktestConfig,
  priceMap: Map<string, PriceSeries>,
  spySeries: PriceSeries,
): BacktestResult {
  const tickers = config.tickers;
  const dates   = buildCommonDates(priceMap, tickers);
  const gaps: string[] = tickers.filter((t) => (priceMap.get(t) ?? []).length < 10);

  if (dates.length < 2) {
    return emptyResult(config, tickers, gaps);
  }

  // Build price lookup
  const priceLookup = new Map<string, Map<string, number>>();
  for (const ticker of tickers) {
    const lookup = new Map<string, number>();
    for (const { date, close } of priceMap.get(ticker) ?? []) lookup.set(date, close);
    priceLookup.set(ticker, lookup);
  }

  const capital = config.initialCapital;
  const perTicker = capital / tickers.length;
  const trades: Trade[] = [];

  // Buy on day 0
  const day0 = dates[0]!;
  const shares: Record<string, number> = {};
  let cash = capital;

  for (const ticker of tickers) {
    const price = priceLookup.get(ticker)?.get(day0) ?? 0;
    if (price > 0) {
      const n = Math.floor(perTicker / price);
      if (n > 0) {
        shares[ticker] = n;
        cash -= n * price;
        trades.push({ date: day0, ticker, action: "buy", shares: n, price, value: n * price });
      }
    }
  }

  // Build equity curve
  const spy0 = spySeries.find((r) => r.date >= day0)?.close ?? 1;
  const spyShares = capital / spy0;

  const equity: EquityPoint[] = dates.map((date) => {
    const portfolioValue =
      cash +
      tickers.reduce((sum, t) => {
        const price = priceLookup.get(t)?.get(date) ?? 0;
        return sum + (shares[t] ?? 0) * price;
      }, 0);
    const spyClose = spySeries.find((r) => r.date === date)?.close ?? spy0;
    return { date, portfolioValue, benchmarkValue: spyShares * spyClose };
  });

  const metrics = buildFinalMetrics(equity, trades, config.initialCapital);
  return {
    equity, trades, metrics, config,
    tickers, startDate: dates[0]!, endDate: dates[dates.length - 1]!,
    dataGaps: gaps,
  };
}

// ─── Strategy: SMA Crossover ──────────────────────────────────────────────────

function runSmaCross(
  config:    BacktestConfig,
  priceMap:  Map<string, PriceSeries>,
  spySeries: PriceSeries,
): BacktestResult {
  const tickers  = config.tickers;
  const fastPer  = config.fastSma ?? 20;
  const slowPer  = config.slowSma ?? 50;
  const dates    = buildCommonDates(priceMap, tickers);
  const gaps: string[] = tickers.filter((t) => (priceMap.get(t) ?? []).length < slowPer + 5);

  if (dates.length < slowPer + 5) return emptyResult(config, tickers, gaps);

  const capital = config.initialCapital;
  const perTicker = capital / tickers.length;
  const cash = { value: capital };
  const positions: Record<string, { shares: number; avgCost: number }> = {};
  const trades: Trade[] = [];

  // Pre-compute SMAs per ticker
  const fastSmas: Record<string, number[]> = {};
  const slowSmas: Record<string, number[]> = {};
  for (const ticker of tickers) {
    const prices = (priceMap.get(ticker) ?? [])
      .filter((r) => dates.includes(r.date))
      .map((r) => r.close);
    fastSmas[ticker] = sma(prices, fastPer);
    slowSmas[ticker] = sma(prices, slowPer);
  }

  const priceLookup = new Map<string, Map<string, number>>();
  for (const ticker of tickers) {
    const lookup = new Map<string, number>();
    for (const { date, close } of priceMap.get(ticker) ?? []) lookup.set(date, close);
    priceLookup.set(ticker, lookup);
  }

  // Equity curve
  const spy0 = spySeries.find((r) => r.date >= dates[0]!)?.close ?? 1;
  const spyShares = capital / spy0;
  const equity: EquityPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;

    for (const ticker of tickers) {
      const fast = fastSmas[ticker]?.[i];
      const slow = slowSmas[ticker]?.[i];
      const prevFast = fastSmas[ticker]?.[i - 1];
      const prevSlow = slowSmas[ticker]?.[i - 1];
      const price = priceLookup.get(ticker)?.get(date) ?? 0;
      if (!fast || !slow || !prevFast || !prevSlow || price <= 0) continue;

      const inPosition = (positions[ticker]?.shares ?? 0) > 0;
      const goldenCross = fast > slow && prevFast <= prevSlow;
      const deathCross  = fast < slow && prevFast >= prevSlow;

      if (goldenCross && !inPosition) {
        const budget = perTicker;
        const n = Math.floor(budget / price);
        if (n > 0 && cash.value >= n * price) {
          cash.value -= n * price;
          positions[ticker] = { shares: n, avgCost: price };
          trades.push({ date, ticker, action: "buy", shares: n, price, value: n * price });
        }
      } else if (deathCross && inPosition) {
        const { shares } = positions[ticker]!;
        cash.value += shares * price;
        delete positions[ticker];
        trades.push({ date, ticker, action: "sell", shares, price, value: shares * price });
      }
    }

    const portfolioValue =
      cash.value +
      Object.entries(positions).reduce((sum, [t, pos]) => {
        return sum + pos.shares * (priceLookup.get(t)?.get(date) ?? 0);
      }, 0);

    const spyClose = spySeries.find((r) => r.date === date)?.close ?? spy0;
    equity.push({ date, portfolioValue, benchmarkValue: spyShares * spyClose });
  }

  const metrics = buildFinalMetrics(equity, trades, config.initialCapital);
  return {
    equity, trades, metrics, config,
    tickers, startDate: dates[0]!, endDate: dates[dates.length - 1]!,
    dataGaps: gaps,
  };
}

// ─── Strategy: Momentum Rotation ─────────────────────────────────────────────

function runMomentum(
  config:    BacktestConfig,
  priceMap:  Map<string, PriceSeries>,
  spySeries: PriceSeries,
): BacktestResult {
  const tickers     = config.tickers;
  const lookback    = config.momentumLookback ?? 63;
  const topN        = Math.min(config.topN ?? 3, tickers.length);
  const rebalFreq   = config.rebalanceFreq ?? "monthly";
  const dates       = buildCommonDates(priceMap, tickers);
  const gaps: string[] = tickers.filter((t) => (priceMap.get(t) ?? []).length < lookback + 5);

  if (dates.length < lookback + 5) return emptyResult(config, tickers, gaps);

  const capital = config.initialCapital;
  const cash    = { value: capital };
  const positions: Record<string, number> = {}; // ticker → shares
  const trades: Trade[] = [];

  const priceLookup = new Map<string, Map<string, number>>();
  for (const ticker of tickers) {
    const lookup = new Map<string, number>();
    for (const { date, close } of priceMap.get(ticker) ?? []) lookup.set(date, close);
    priceLookup.set(ticker, lookup);
  }

  const spy0 = spySeries.find((r) => r.date >= dates[0]!)?.close ?? 1;
  const spyShares = capital / spy0;
  const equity: EquityPoint[] = [];

  let lastRebalMonth = "";
  let lastRebalWeek  = "";

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const [yyyy, mm, dd] = date.split("-");
    const week = `${yyyy}-W${Math.floor(parseInt(dd!) / 7)}`;

    const shouldRebalance =
      (rebalFreq === "monthly" && mm !== lastRebalMonth && i >= lookback) ||
      (rebalFreq === "weekly"  && week !== lastRebalWeek && i >= lookback);

    if (shouldRebalance) {
      if (rebalFreq === "monthly") lastRebalMonth = mm!;
      else lastRebalWeek = week;

      // Rank tickers by lookback return
      const ranked = tickers
        .map((t) => {
          const priceNow  = priceLookup.get(t)?.get(date) ?? 0;
          const priceBack = priceMap.get(t)?.[i - lookback]?.close ?? 0;
          const ret = priceBack > 0 && priceNow > 0 ? (priceNow - priceBack) / priceBack : -Infinity;
          return { ticker: t, ret };
        })
        .sort((a, b) => b.ret - a.ret);

      const wanted = new Set(ranked.slice(0, topN).map((r) => r.ticker));

      // Liquidate positions not in wanted set
      for (const [t, shares] of Object.entries(positions)) {
        if (!wanted.has(t) && shares > 0) {
          const price = priceLookup.get(t)?.get(date) ?? 0;
          if (price > 0) {
            cash.value += shares * price;
            trades.push({ date, ticker: t, action: "sell", shares, price, value: shares * price });
            delete positions[t];
          }
        }
      }

      // Buy wanted tickers not already held
      const totalValue = cash.value + Object.entries(positions).reduce((s, [t, sh]) =>
        s + sh * (priceLookup.get(t)?.get(date) ?? 0), 0);
      const perPos = totalValue / topN;

      for (const { ticker } of ranked.slice(0, topN)) {
        const price = priceLookup.get(ticker)?.get(date) ?? 0;
        if (price <= 0) continue;
        const currentShares = positions[ticker] ?? 0;
        const targetShares  = Math.floor(perPos / price);
        const delta         = targetShares - currentShares;
        if (delta > 0 && cash.value >= delta * price) {
          cash.value -= delta * price;
          positions[ticker] = (positions[ticker] ?? 0) + delta;
          trades.push({ date, ticker, action: "buy", shares: delta, price, value: delta * price });
        } else if (delta < 0) {
          const sell = Math.abs(delta);
          cash.value += sell * price;
          positions[ticker] = (positions[ticker] ?? 0) - sell;
          trades.push({ date, ticker, action: "sell", shares: sell, price, value: sell * price });
        }
      }
    }

    const portfolioValue =
      cash.value +
      Object.entries(positions).reduce((sum, [t, sh]) =>
        sum + sh * (priceLookup.get(t)?.get(date) ?? 0), 0);

    const spyClose = spySeries.find((r) => r.date === date)?.close ?? spy0;
    equity.push({ date, portfolioValue, benchmarkValue: spyShares * spyClose });
  }

  const metrics = buildFinalMetrics(equity, trades, config.initialCapital);
  return {
    equity, trades, metrics, config,
    tickers, startDate: dates[0]!, endDate: dates[dates.length - 1]!,
    dataGaps: gaps,
  };
}

// ─── Strategy: Mean Reversion ─────────────────────────────────────────────────

function runMeanReversion(
  config:    BacktestConfig,
  priceMap:  Map<string, PriceSeries>,
  spySeries: PriceSeries,
): BacktestResult {
  const tickers   = config.tickers;
  const smaPer    = config.smaPeriod ?? 20;
  const entryPct  = config.entryThreshold ?? 0.05;
  const exitPct   = config.exitThreshold  ?? 0.02;
  const dates     = buildCommonDates(priceMap, tickers);
  const gaps: string[] = tickers.filter((t) => (priceMap.get(t) ?? []).length < smaPer + 5);

  if (dates.length < smaPer + 5) return emptyResult(config, tickers, gaps);

  const capital  = config.initialCapital;
  const perTicker = capital / tickers.length;
  const cash     = { value: capital };
  const positions: Record<string, { shares: number; avgCost: number }> = {};
  const trades: Trade[] = [];

  const priceLookup = new Map<string, Map<string, number>>();
  const smaMaps: Record<string, number[]> = {};

  for (const ticker of tickers) {
    const lookup = new Map<string, number>();
    const filtered = (priceMap.get(ticker) ?? []).filter((r) => dates.includes(r.date));
    for (const { date, close } of filtered) lookup.set(date, close);
    priceLookup.set(ticker, lookup);
    smaMaps[ticker] = sma(filtered.map((r) => r.close), smaPer);
  }

  const spy0 = spySeries.find((r) => r.date >= dates[0]!)?.close ?? 1;
  const spyShares = capital / spy0;
  const equity: EquityPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;

    for (const ticker of tickers) {
      const price = priceLookup.get(ticker)?.get(date) ?? 0;
      const ma    = smaMaps[ticker]?.[i];
      if (!ma || price <= 0) continue;

      const inPos = (positions[ticker]?.shares ?? 0) > 0;

      if (!inPos && price < ma * (1 - entryPct)) {
        const n = Math.floor(perTicker / price);
        if (n > 0 && cash.value >= n * price) {
          cash.value -= n * price;
          positions[ticker] = { shares: n, avgCost: price };
          trades.push({ date, ticker, action: "buy", shares: n, price, value: n * price });
        }
      } else if (inPos && price > ma * (1 + exitPct)) {
        const { shares } = positions[ticker]!;
        cash.value += shares * price;
        delete positions[ticker];
        trades.push({ date, ticker, action: "sell", shares, price, value: shares * price });
      }
    }

    const portfolioValue =
      cash.value +
      Object.entries(positions).reduce((sum, [t, pos]) =>
        sum + pos.shares * (priceLookup.get(t)?.get(date) ?? 0), 0);

    const spyClose = spySeries.find((r) => r.date === date)?.close ?? spy0;
    equity.push({ date, portfolioValue, benchmarkValue: spyShares * spyClose });
  }

  const metrics = buildFinalMetrics(equity, trades, config.initialCapital);
  return {
    equity, trades, metrics, config,
    tickers, startDate: dates[0]!, endDate: dates[dates.length - 1]!,
    dataGaps: gaps,
  };
}

// ─── Shared metric builder ────────────────────────────────────────────────────

function buildFinalMetrics(equity: EquityPoint[], trades: Trade[], initial: number): PerformanceMetrics {
  const base = computeMetrics(equity, trades, initial);

  const benchValues = equity.map((e) => e.benchmarkValue);
  const benchFirst  = benchValues[0] ?? initial;
  const benchLast   = benchValues[benchValues.length - 1] ?? initial;
  const benchReturn = (benchLast - benchFirst) / benchFirst;
  const alpha       = base.totalReturn - benchReturn;

  return { ...base, benchmarkReturn: benchReturn, alpha };
}

// ─── Empty result ─────────────────────────────────────────────────────────────

function emptyResult(config: BacktestConfig, tickers: string[], dataGaps: string[]): BacktestResult {
  const emptyMetrics: PerformanceMetrics = {
    totalReturn: 0, cagr: 0, sharpe: 0, sortino: 0,
    maxDrawdown: 0, calmar: 0, winRate: 0, numTrades: 0,
    avgTradePnlPct: 0, volatility: 0, benchmarkReturn: 0,
    alpha: 0, daysSimulated: 0,
  };
  return { equity: [], trades: [], metrics: emptyMetrics, config, tickers, startDate: "", endDate: "", dataGaps };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run a backtest against the supplied price maps.
 *
 * @param config    — strategy configuration
 * @param priceMap  — ticker → chronological price series
 * @param spySeries — SPY price series (benchmark)
 */
export function runBacktest(
  config:    BacktestConfig,
  priceMap:  Map<string, PriceSeries>,
  spySeries: PriceSeries,
): BacktestResult {
  switch (config.strategy) {
    case "buy_hold":       return runBuyAndHold(config, priceMap, spySeries);
    case "sma_cross":      return runSmaCross(config, priceMap, spySeries);
    case "momentum":       return runMomentum(config, priceMap, spySeries);
    case "mean_reversion": return runMeanReversion(config, priceMap, spySeries);
  }
}
