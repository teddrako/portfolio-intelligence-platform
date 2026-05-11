/**
 * Seed script: fetches real market data from Yahoo Finance and populates
 * the securities and price_snapshots tables.
 *
 * Usage:
 *   bun apps/web/scripts/seed-market-data.ts
 *
 * Requires DATABASE_URL to be set (loaded automatically from .env by Bun).
 */

import { fetchSecurityMetadata, fetchDailyBars } from "@pip/api/services/marketData";

const PORTFOLIO_TICKERS = ["NVDA", "META", "MSFT", "AMZN", "AAPL", "JPM", "GOOGL"];
const BENCHMARK_TICKERS = ["SPY", "QQQ", "TLT", "GLD", "USO"];
const ALL_TICKERS = [...PORTFOLIO_TICKERS, ...BENCHMARK_TICKERS];

const LOOKBACK_DAYS = 730; // ~2 years

async function main() {
  console.log(`Seeding market data for ${ALL_TICKERS.length} tickers:`);
  console.log(ALL_TICKERS.join(", "));
  console.log();

  console.log("--- Fetching security metadata ---");
  await fetchSecurityMetadata(ALL_TICKERS);

  console.log("\n--- Backfilling price history (~2 years) ---");
  await fetchDailyBars(ALL_TICKERS, LOOKBACK_DAYS);

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
