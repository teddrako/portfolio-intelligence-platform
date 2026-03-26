/**
 * News provider factory.
 *
 * Active provider is selected via the NEWS_PROVIDER env var:
 *   (unset or "mock")  → MockNewsProvider  ← current default
 *   "alpaca"           → AlpacaNewsProvider (not yet implemented)
 *                        requires: ALPACA_API_KEY
 *   "polygon"          → PolygonNewsProvider (not yet implemented)
 *                        requires: POLYGON_API_KEY
 *   "benzinga"         → BenzingaNewsProvider (not yet implemented)
 *                        requires: BENZINGA_API_KEY
 */

import type { INewsProvider } from "./interface";
import { MockNewsProvider } from "./mock";

let _instance: INewsProvider | null = null;

export function getNewsProvider(): INewsProvider {
  if (_instance) return _instance;

  const vendor = (process.env.NEWS_PROVIDER ?? "mock").toLowerCase();

  switch (vendor) {
    // TODO: case "alpaca":   _instance = new AlpacaNewsProvider(process.env.ALPACA_API_KEY!); break;
    // TODO: case "polygon":  _instance = new PolygonNewsProvider(process.env.POLYGON_API_KEY!); break;
    // TODO: case "benzinga": _instance = new BenzingaNewsProvider(process.env.BENZINGA_API_KEY!); break;
    default:
      _instance = new MockNewsProvider();
  }

  console.log(`[news] using provider: ${_instance.name}`);
  return _instance;
}

export type { INewsProvider } from "./interface";
