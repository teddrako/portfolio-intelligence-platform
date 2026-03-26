/**
 * MockCalendarProvider — realistic macro + earnings calendar for 2026 Q2.
 *
 * TODO: Replace with a real provider:
 *   - Polygon.io (CALENDAR_PROVIDER=polygon, POLYGON_API_KEY)
 *   - Alpha Vantage (CALENDAR_PROVIDER=alphavantage, ALPHAVANTAGE_KEY)
 *   - Earnings Whispers / Benzinga for earnings
 *   - Trading Economics for macro events
 */

import type { ICalendarProvider } from "./interface";
import type { MacroEvent, EarningsEvent } from "../types";

// ─── Macro events (2026-03-26 → 2026-05-15) ──────────────────────────────────
// TODO: fetch from Trading Economics or FRED API

const MACRO_EVENTS: MacroEvent[] = [
  {
    title:       "ISM Manufacturing PMI",
    date:        "2026-04-01",
    time:        "10:00",
    country:     "US",
    category:    "manufacturing",
    importance:  "medium",
    forecast:    "50.4",
    previous:    "50.3",
    description: "Institute for Supply Management manufacturing index. Above 50 signals expansion.",
  },
  {
    title:       "Initial Jobless Claims",
    date:        "2026-04-03",
    time:        "08:30",
    country:     "US",
    category:    "employment",
    importance:  "low",
    forecast:    "215K",
    previous:    "221K",
  },
  {
    title:       "Nonfarm Payrolls (NFP)",
    date:        "2026-04-04",
    time:        "08:30",
    country:     "US",
    category:    "employment",
    importance:  "high",
    forecast:    "200K",
    previous:    "247K",
    description: "Monthly change in employment from non-farm businesses. Primary US labour market indicator.",
  },
  {
    title:       "Unemployment Rate",
    date:        "2026-04-04",
    time:        "08:30",
    country:     "US",
    category:    "employment",
    importance:  "high",
    forecast:    "3.8%",
    previous:    "3.7%",
  },
  {
    title:       "CPI MoM",
    date:        "2026-04-10",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "high",
    forecast:    "0.2%",
    previous:    "0.3%",
    description: "Consumer Price Index, month-over-month change. Key Fed inflation gauge.",
  },
  {
    title:       "CPI YoY",
    date:        "2026-04-10",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "high",
    forecast:    "2.8%",
    previous:    "2.9%",
  },
  {
    title:       "Core CPI YoY",
    date:        "2026-04-10",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "high",
    forecast:    "3.0%",
    previous:    "3.2%",
    description: "CPI excluding food and energy. Most closely watched by the Federal Reserve.",
  },
  {
    title:       "PPI MoM",
    date:        "2026-04-11",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "medium",
    forecast:    "0.1%",
    previous:    "0.2%",
    description: "Producer Price Index. Leads consumer inflation by 1-2 months.",
  },
  {
    title:       "Retail Sales MoM",
    date:        "2026-04-15",
    time:        "08:30",
    country:     "US",
    category:    "consumer",
    importance:  "high",
    forecast:    "0.4%",
    previous:    "-0.1%",
    description: "Monthly change in total retail sales. Proxy for consumer spending strength.",
  },
  {
    title:       "Housing Starts",
    date:        "2026-04-16",
    time:        "08:30",
    country:     "US",
    category:    "housing",
    importance:  "low",
    forecast:    "1.40M",
    previous:    "1.38M",
  },
  {
    title:       "Existing Home Sales",
    date:        "2026-04-22",
    time:        "10:00",
    country:     "US",
    category:    "housing",
    importance:  "low",
    forecast:    "4.05M",
    previous:    "3.98M",
  },
  {
    title:       "Durable Goods Orders MoM",
    date:        "2026-04-24",
    time:        "08:30",
    country:     "US",
    category:    "manufacturing",
    importance:  "medium",
    forecast:    "0.8%",
    previous:    "-1.1%",
  },
  {
    title:       "GDP Q1 2026 Advance Estimate (QoQ Annualised)",
    date:        "2026-04-30",
    time:        "08:30",
    country:     "US",
    category:    "gdp",
    importance:  "high",
    forecast:    "2.3%",
    previous:    "2.6%",
    description: "First estimate of Q1 2026 real GDP growth. Subject to two subsequent revisions.",
  },
  {
    title:       "FOMC Meeting — Day 1",
    date:        "2026-04-28",
    time:        "09:00",
    country:     "US",
    category:    "rates",
    importance:  "high",
    description: "First day of the Federal Open Market Committee two-day policy meeting.",
  },
  {
    title:       "FOMC Rate Decision & Press Conference",
    date:        "2026-04-29",
    time:        "14:00",
    country:     "US",
    category:    "rates",
    importance:  "high",
    forecast:    "4.25-4.50%",
    previous:    "4.25-4.50%",
    description: "FOMC announces rate decision at 14:00 ET; press conference follows at 14:30 ET. Markets pricing 85% probability of hold.",
  },
  {
    title:       "Nonfarm Payrolls (NFP) — May",
    date:        "2026-05-02",
    time:        "08:30",
    country:     "US",
    category:    "employment",
    importance:  "high",
    forecast:    "195K",
    previous:    "200K",
  },
  {
    title:       "CPI MoM — April",
    date:        "2026-05-13",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "high",
    forecast:    "0.2%",
    previous:    "0.2%",
  },
  {
    title:       "PPI MoM — April",
    date:        "2026-05-14",
    time:        "08:30",
    country:     "US",
    category:    "inflation",
    importance:  "medium",
    forecast:    "0.1%",
    previous:    "0.1%",
  },
];

// ─── Earnings events (Q1 2026 season, reporting April-May) ───────────────────
// Dates are standard Q1 reporting windows; confirm with actual IR calendars.
// TODO: fetch from Polygon.io /v3/reference/dividends or Earnings Whispers

const EARNINGS_EVENTS: EarningsEvent[] = [
  {
    ticker:          "JPM",
    securityName:    "JPMorgan Chase",
    date:            "2026-04-15",
    time:            "before_market",
    epsEstimate:     4.35,
    revenueEstimate: 45_200_000_000,
    isConfirmed:     true,
  },
  {
    ticker:          "GOOGL",
    securityName:    "Alphabet Inc.",
    date:            "2026-04-28",
    time:            "after_market",
    epsEstimate:     2.18,
    revenueEstimate: 96_400_000_000,
    isConfirmed:     true,
  },
  {
    ticker:          "MSFT",
    securityName:    "Microsoft Corp.",
    date:            "2026-04-29",
    time:            "after_market",
    epsEstimate:     3.47,
    revenueEstimate: 72_800_000_000,
    isConfirmed:     true,
  },
  {
    ticker:          "META",
    securityName:    "Meta Platforms",
    date:            "2026-04-29",
    time:            "after_market",
    epsEstimate:     5.52,
    revenueEstimate: 50_100_000_000,
    isConfirmed:     true,
  },
  {
    ticker:          "AMZN",
    securityName:    "Amazon.com",
    date:            "2026-05-01",
    time:            "after_market",
    epsEstimate:     1.42,
    revenueEstimate: 187_300_000_000,
    isConfirmed:     false,
  },
  {
    ticker:          "AAPL",
    securityName:    "Apple Inc.",
    date:            "2026-05-01",
    time:            "after_market",
    epsEstimate:     1.58,
    revenueEstimate: 98_600_000_000,
    isConfirmed:     false,
  },
  {
    ticker:          "NVDA",
    securityName:    "NVIDIA Corp.",
    date:            "2026-05-28",
    time:            "after_market",
    epsEstimate:     5.78,
    revenueEstimate: 43_200_000_000,
    isConfirmed:     false,
  },
];

// ─── Provider implementation ──────────────────────────────────────────────────

function dateInRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  return d >= from && d <= to;
}

export class MockCalendarProvider implements ICalendarProvider {
  readonly name = "Mock (built-in calendar)";

  async getMacroEvents(from: Date, to: Date): Promise<MacroEvent[]> {
    return MACRO_EVENTS
      .filter((e) => dateInRange(e.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getEarningsEvents(tickers: string[], from: Date, to: Date): Promise<EarningsEvent[]> {
    const upper = new Set(tickers.map((t) => t.toUpperCase()));
    return EARNINGS_EVENTS
      .filter((e) => dateInRange(e.date, from, to) && (upper.size === 0 || upper.has(e.ticker)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAllEarningsEvents(from: Date, to: Date): Promise<EarningsEvent[]> {
    return EARNINGS_EVENTS
      .filter((e) => dateInRange(e.date, from, to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
