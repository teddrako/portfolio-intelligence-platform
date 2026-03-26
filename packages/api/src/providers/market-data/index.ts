/**
 * Market-data provider factory.
 *
 * Active provider is selected via the MARKET_DATA_PROVIDER env var:
 *   (unset or "mock")  → MockMarketDataProvider  ← current default
 *   "polygon"          → PolygonMarketDataProvider (not yet implemented)
 *                        requires: POLYGON_API_KEY
 *   "alpaca"           → AlpacaMarketDataProvider (not yet implemented)
 *                        requires: ALPACA_API_KEY, ALPACA_API_SECRET
 *
 * To add a new provider:
 *   1. Create packages/api/src/providers/market-data/<vendor>.ts
 *   2. Implement IMarketDataProvider
 *   3. Add a case below
 */

import type { IMarketDataProvider } from "./interface";
import { MockMarketDataProvider } from "./mock";

let _instance: IMarketDataProvider | null = null;

export function getMarketDataProvider(): IMarketDataProvider {
  if (_instance) return _instance;

  const vendor = (process.env.MARKET_DATA_PROVIDER ?? "mock").toLowerCase();

  switch (vendor) {
    // TODO: case "polygon": _instance = new PolygonMarketDataProvider(process.env.POLYGON_API_KEY!); break;
    // TODO: case "alpaca":  _instance = new AlpacaMarketDataProvider(...); break;
    default:
      _instance = new MockMarketDataProvider();
  }

  console.log(`[market-data] using provider: ${_instance.name}`);
  return _instance;
}

export type { IMarketDataProvider } from "./interface";
