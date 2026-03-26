/**
 * Calendar provider factory.
 *
 * Active provider is selected via the CALENDAR_PROVIDER env var:
 *   (unset or "mock")    → MockCalendarProvider  ← current default
 *   "polygon"            → PolygonCalendarProvider (not yet implemented)
 *                          requires: POLYGON_API_KEY
 *   "alphavantage"       → AlphaVantageCalendarProvider (not yet implemented)
 *                          requires: ALPHAVANTAGE_KEY
 */

import type { ICalendarProvider } from "./interface";
import { MockCalendarProvider } from "./mock";

let _instance: ICalendarProvider | null = null;

export function getCalendarProvider(): ICalendarProvider {
  if (_instance) return _instance;

  const vendor = (process.env.CALENDAR_PROVIDER ?? "mock").toLowerCase();

  switch (vendor) {
    // TODO: case "polygon":       _instance = new PolygonCalendarProvider(process.env.POLYGON_API_KEY!); break;
    // TODO: case "alphavantage":  _instance = new AlphaVantageCalendarProvider(process.env.ALPHAVANTAGE_KEY!); break;
    default:
      _instance = new MockCalendarProvider();
  }

  console.log(`[calendar] using provider: ${_instance.name}`);
  return _instance;
}

export type { ICalendarProvider } from "./interface";
