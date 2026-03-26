/**
 * Calendar service — caching layer over ICalendarProvider.
 *
 * All results are cached in Redis (fail-open).
 * Swap the underlying vendor via the CALENDAR_PROVIDER env var.
 */

import { getCalendarProvider } from "../providers/calendar";
import { withCache } from "../lib/redis";
import type { MacroEvent, EarningsEvent } from "../providers/types";

export type { MacroEvent, EarningsEvent };

const provider = getCalendarProvider();

/**
 * Macro events in the next N days, cached 1 h.
 * @param days  Window from today (default 60)
 */
export async function getMacroEvents(days = 60): Promise<MacroEvent[]> {
  const from = new Date();
  const to   = new Date();
  to.setDate(to.getDate() + days);

  return withCache(`calendar:macro:${days}d`, 3600, () =>
    provider.getMacroEvents(from, to),
  );
}

/**
 * Earnings events for the specified tickers in the next N days, cached 15 min.
 * Pass an empty array to get all upcoming earnings.
 */
export async function getEarningsEvents(tickers: string[] = [], days = 90): Promise<EarningsEvent[]> {
  const upper = tickers.map((t) => t.toUpperCase()).sort();
  const from  = new Date();
  const to    = new Date();
  to.setDate(to.getDate() + days);

  const key = upper.length > 0
    ? `calendar:earnings:${upper.join("-")}:${days}d`
    : `calendar:earnings:all:${days}d`;

  return withCache(key, 900, () =>
    upper.length > 0
      ? provider.getEarningsEvents(upper, from, to)
      : provider.getAllEarningsEvents(from, to),
  );
}

/**
 * Earnings events specifically for a user's open positions.
 * Fetches holdings tickers and filters earnings to those companies.
 */
export async function getEarningsForPortfolio(
  portfolioTickers: string[],
  days = 90,
): Promise<EarningsEvent[]> {
  return getEarningsEvents(portfolioTickers, days);
}
