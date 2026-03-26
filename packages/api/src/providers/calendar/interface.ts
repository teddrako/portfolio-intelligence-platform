import type { MacroEvent, EarningsEvent } from "../types";

/**
 * Swap vendors by implementing this interface and updating
 * packages/api/src/providers/calendar/index.ts.
 *
 * Real providers to plug in:
 *   - Polygon.io    → set CALENDAR_PROVIDER=polygon  + POLYGON_API_KEY
 *   - Alpha Vantage → set CALENDAR_PROVIDER=alphavantage + ALPHAVANTAGE_KEY
 *   - Earnings Whispers / Benzinga (earnings)
 *   - Trading Economics (macro)
 */
export interface ICalendarProvider {
  readonly name: string;

  /** Macro events (CPI, NFP, FOMC, GDP…) in the given date window. */
  getMacroEvents(from: Date, to: Date): Promise<MacroEvent[]>;

  /**
   * Earnings events for the given tickers in the date window.
   * Pass an empty array to get ALL upcoming earnings.
   */
  getEarningsEvents(tickers: string[], from: Date, to: Date): Promise<EarningsEvent[]>;

  /** All upcoming earnings regardless of ticker. */
  getAllEarningsEvents(from: Date, to: Date): Promise<EarningsEvent[]>;
}
