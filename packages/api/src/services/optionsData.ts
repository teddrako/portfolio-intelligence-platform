/**
 * Options data service — fetches live options chains from Yahoo Finance
 * and enriches each contract with Black-Scholes Greeks.
 *
 * Cache strategy: 5-minute Redis TTL (options data is intraday).
 * Falls back gracefully: if Yahoo returns no data, returns empty chains.
 */

import YahooFinance from "yahoo-finance2";
import { withCache } from "../lib/redis";
import {
  computeGreeks,
  impliedVolatility,
  type Greeks,
} from "./blackScholes";

// ─── YF singleton (shared with marketData.ts) ─────────────────────────────────

declare global {
  var __yahooFinance: InstanceType<typeof YahooFinance> | undefined;
}
const yf =
  global.__yahooFinance ??
  (global.__yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] }));

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_FREE_RATE = 0.05; // 5 % — update when market rate changes materially

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichedContract {
  contractSymbol: string;
  strike:         number;
  bid:            number;
  ask:            number;
  lastPrice:      number;
  midpoint:       number;
  volume:         number;
  openInterest:   number;
  inTheMoney:     boolean;
  marketIV:       number;   // as reported by Yahoo (0‥1)
  calcIV:         number | null;  // our BS-derived IV from midpoint
  // Greeks from BS using calcIV (or marketIV as fallback)
  delta:  number;
  gamma:  number;
  theta:  number;
  vega:   number;
  rho:    number;
  // Theoretical price at current spot + IV
  theoPrice: number;
}

export interface OptionsChainResult {
  ticker:          string;
  underlyingPrice: number;
  expirationDates: string[];   // ISO date strings (YYYY-MM-DD)
  expiration:      string;     // the expiration we're returning
  dte:             number;     // calendar days to expiration
  calls:           EnrichedContract[];
  puts:            EnrichedContract[];
  riskFreeRate:    number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function daysToExpiry(expiration: Date): number {
  return Math.max(0, Math.round((expiration.getTime() - Date.now()) / 86_400_000));
}

function yearsToExpiry(dte: number): number {
  return dte / 365;
}

/** Enrich a single call-or-put contract with Greeks. */
function enrichContract(
  raw:  { contractSymbol: string; strike: number; bid?: number; ask?: number; lastPrice: number; volume?: number; openInterest?: number; inTheMoney: boolean; impliedVolatility: number },
  type: "call" | "put",
  S:    number,
  T:    number,
  r:    number,
): EnrichedContract {
  const bid      = raw.bid ?? 0;
  const ask      = raw.ask ?? 0;
  const midpoint = bid > 0 && ask > 0 ? (bid + ask) / 2 : raw.lastPrice;

  // Prefer computing IV from midpoint (cleaner than last-trade price)
  const calcIV = midpoint > 0
    ? impliedVolatility(midpoint, S, raw.strike, T, r, type)
    : null;

  // Fall back to Yahoo-reported IV if our solver didn't converge
  const sigmaForGreeks = calcIV ?? raw.impliedVolatility;

  const greeks: Greeks = computeGreeks(type, S, raw.strike, T, r, sigmaForGreeks);

  return {
    contractSymbol: raw.contractSymbol,
    strike:         raw.strike,
    bid,
    ask,
    lastPrice:      raw.lastPrice,
    midpoint,
    volume:         raw.volume ?? 0,
    openInterest:   raw.openInterest ?? 0,
    inTheMoney:     raw.inTheMoney,
    marketIV:       raw.impliedVolatility,
    calcIV,
    ...greeks,
    theoPrice: 0, // filled below once we have a sigma
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch available expiration dates for a ticker.
 * Cached 15 minutes (expirations change weekly, not intraday).
 */
export async function getExpirationDates(ticker: string): Promise<string[]> {
  const upper = ticker.toUpperCase();
  return withCache(`options:expirations:${upper}`, 900, async () => {
    try {
      const result = await yf.options(upper);
      return result.expirationDates.map(toIsoDate);
    } catch {
      return [];
    }
  });
}

/**
 * Fetch enriched options chain for `ticker` at `expirationIso` (YYYY-MM-DD).
 * If `expirationIso` is null, uses the nearest expiration.
 * Cached 5 minutes.
 */
export async function getOptionsChain(
  ticker:          string,
  expirationIso?:  string,
): Promise<OptionsChainResult> {
  const upper = ticker.toUpperCase();
  const cacheKey = `options:chain:${upper}:${expirationIso ?? "nearest"}`;

  return withCache(cacheKey, 300, async (): Promise<OptionsChainResult> => {
    const empty: OptionsChainResult = {
      ticker: upper,
      underlyingPrice: 0,
      expirationDates: [],
      expiration: expirationIso ?? "",
      dte: 0,
      calls: [],
      puts: [],
      riskFreeRate: RISK_FREE_RATE,
    };

    try {
      const queryOpts = expirationIso
        ? { date: new Date(expirationIso) }
        : undefined;

      const result = await yf.options(upper, queryOpts);

      const S = result.quote.regularMarketPrice ?? 0;
      if (S === 0) return empty;

      const allDates = result.expirationDates.map(toIsoDate);

      const firstOption = result.options[0];
      if (!firstOption) return { ...empty, underlyingPrice: S, expirationDates: allDates };

      const expDate  = firstOption.expirationDate;
      const dte      = daysToExpiry(expDate);
      const T        = yearsToExpiry(dte);
      const expIso   = toIsoDate(expDate);

      const calls = firstOption.calls.map((c) =>
        enrichContract(c, "call", S, T, RISK_FREE_RATE),
      );
      const puts = firstOption.puts.map((p) =>
        enrichContract(p, "put", S, T, RISK_FREE_RATE),
      );

      return {
        ticker:          upper,
        underlyingPrice: S,
        expirationDates: allDates,
        expiration:      expIso,
        dte,
        calls,
        puts,
        riskFreeRate:    RISK_FREE_RATE,
      };
    } catch (err) {
      console.warn(`[options] failed to fetch chain for ${upper}:`, err);
      return empty;
    }
  });
}
