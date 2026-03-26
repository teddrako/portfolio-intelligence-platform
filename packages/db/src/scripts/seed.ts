/**
 * DEV ONLY — seeds the database with a demo user, portfolio, and realistic positions.
 *
 * Usage:
 *   pnpm db:seed
 *
 * After seeding, add DEV_USER_ID=user_demo_01 to your .env to bypass auth in dev.
 */
import { db } from "../db";
import {
  users,
  securities,
  portfolios,
  positions,
  transactions,
  cashBalances,
} from "../schema";
import { sql } from "drizzle-orm";

// ─── Stable seed IDs ─────────────────────────────────────────────────────────

const USER_ID = "user_demo_01";
const PORTFOLIO_ID = "port_demo_01";
const CASH_ID = "cash_demo_01";

const SECS = {
  NVDA:  { id: "sec_nvda",  ticker: "NVDA",  name: "NVIDIA Corp.",        assetClass: "equity", sector: "Technology",    exchange: "NASDAQ" },
  META:  { id: "sec_meta",  ticker: "META",  name: "Meta Platforms",      assetClass: "equity", sector: "Technology",    exchange: "NASDAQ" },
  SPY:   { id: "sec_spy",   ticker: "SPY",   name: "SPDR S&P 500 ETF",    assetClass: "etf",    sector: null,            exchange: "NYSE"   },
  MSFT:  { id: "sec_msft",  ticker: "MSFT",  name: "Microsoft Corp.",     assetClass: "equity", sector: "Technology",    exchange: "NASDAQ" },
  AMZN:  { id: "sec_amzn",  ticker: "AMZN",  name: "Amazon.com",          assetClass: "equity", sector: "Consumer Disc.",exchange: "NASDAQ" },
  AAPL:  { id: "sec_aapl",  ticker: "AAPL",  name: "Apple Inc.",          assetClass: "equity", sector: "Technology",    exchange: "NASDAQ" },
  JPM:   { id: "sec_jpm",   ticker: "JPM",   name: "JPMorgan Chase",      assetClass: "equity", sector: "Financials",    exchange: "NYSE"   },
  GOOGL: { id: "sec_googl", ticker: "GOOGL", name: "Alphabet Inc.",       assetClass: "equity", sector: "Technology",    exchange: "NASDAQ" },
} as const;

// Positions: (secKey, positionId, shares, avgCostBasis, openedAt)
const POSITIONS = [
  { secKey: "NVDA",  id: "pos_nvda",  shares: "20",  avgCostBasis: "620.00",  openedAt: new Date("2024-01-15") },
  { secKey: "META",  id: "pos_meta",  shares: "15",  avgCostBasis: "520.00",  openedAt: new Date("2024-02-03") },
  { secKey: "SPY",   id: "pos_spy",   shares: "100", avgCostBasis: "505.00",  openedAt: new Date("2023-11-20") },
  { secKey: "MSFT",  id: "pos_msft",  shares: "30",  avgCostBasis: "370.20",  openedAt: new Date("2024-01-08") },
  { secKey: "AMZN",  id: "pos_amzn",  shares: "40",  avgCostBasis: "195.60",  openedAt: new Date("2024-03-12") },
  { secKey: "AAPL",  id: "pos_aapl",  shares: "50",  avgCostBasis: "187.50",  openedAt: new Date("2023-10-05") },
  { secKey: "JPM",   id: "pos_jpm",   shares: "20",  avgCostBasis: "215.00",  openedAt: new Date("2024-04-18") },
  { secKey: "GOOGL", id: "pos_googl", shares: "25",  avgCostBasis: "175.80",  openedAt: new Date("2024-02-27") },
] as const;

// Each position gets 1–2 buy transactions that sum to the correct shares/cost
const SEED_TRANSACTIONS = [
  // NVDA — initial buy, then add
  { id: "txn_nvda_1",  posKey: "pos_nvda",  sec: "NVDA",  type: "buy", date: "2024-01-15", shares: "15", price: "618.00",  fees: "1.99" },
  { id: "txn_nvda_2",  posKey: "pos_nvda",  sec: "NVDA",  type: "buy", date: "2024-06-10", shares: "5",  price: "626.00",  fees: "0.99" },
  // META
  { id: "txn_meta_1",  posKey: "pos_meta",  sec: "META",  type: "buy", date: "2024-02-03", shares: "15", price: "520.00",  fees: "1.49" },
  // SPY — DCA over two tranches
  { id: "txn_spy_1",   posKey: "pos_spy",   sec: "SPY",   type: "buy", date: "2023-11-20", shares: "60", price: "455.00",  fees: "0.00" },
  { id: "txn_spy_2",   posKey: "pos_spy",   sec: "SPY",   type: "buy", date: "2024-05-15", shares: "40", price: "572.50",  fees: "0.00" },
  // MSFT
  { id: "txn_msft_1",  posKey: "pos_msft",  sec: "MSFT",  type: "buy", date: "2024-01-08", shares: "30", price: "370.20",  fees: "1.99" },
  // AMZN
  { id: "txn_amzn_1",  posKey: "pos_amzn",  sec: "AMZN",  type: "buy", date: "2024-03-12", shares: "40", price: "195.60",  fees: "1.49" },
  // AAPL — three buys
  { id: "txn_aapl_1",  posKey: "pos_aapl",  sec: "AAPL",  type: "buy", date: "2023-10-05", shares: "20", price: "177.50",  fees: "0.99" },
  { id: "txn_aapl_2",  posKey: "pos_aapl",  sec: "AAPL",  type: "buy", date: "2024-01-22", shares: "20", price: "192.00",  fees: "0.99" },
  { id: "txn_aapl_3",  posKey: "pos_aapl",  sec: "AAPL",  type: "buy", date: "2024-08-14", shares: "10", price: "193.00",  fees: "0.99" },
  // JPM
  { id: "txn_jpm_1",   posKey: "pos_jpm",   sec: "JPM",   type: "buy", date: "2024-04-18", shares: "20", price: "215.00",  fees: "1.49" },
  // GOOGL
  { id: "txn_googl_1", posKey: "pos_googl", sec: "GOOGL", type: "buy", date: "2024-02-27", shares: "25", price: "175.80",  fees: "1.49" },
  // Cash deposits
  { id: "txn_dep_1",   posKey: null, sec: null, type: "deposit", date: "2023-10-01", shares: null, price: null, fees: "0.00" },
  { id: "txn_dep_2",   posKey: null, sec: null, type: "deposit", date: "2024-01-02", shares: null, price: null, fees: "0.00" },
  { id: "txn_dep_3",   posKey: null, sec: null, type: "deposit", date: "2024-06-01", shares: null, price: null, fees: "0.00" },
] as const;

const DEPOSIT_AMOUNTS: Record<string, string> = {
  txn_dep_1: "50000.00",
  txn_dep_2: "50000.00",
  txn_dep_3: "25000.00",
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding database…");

  // 1. Upsert demo user
  await db
    .insert(users)
    .values({
      id: USER_ID,
      name: "Demo User",
      email: "demo@pip.local",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: "Demo User", email: "demo@pip.local" },
    });
  console.log("  ✓ Demo user");

  // 2. Upsert securities
  for (const sec of Object.values(SECS)) {
    await db
      .insert(securities)
      .values({
        id: sec.id,
        ticker: sec.ticker,
        name: sec.name,
        assetClass: sec.assetClass,
        sector: sec.sector ?? null,
        exchange: sec.exchange,
        currency: "USD",
      })
      .onConflictDoUpdate({
        target: securities.ticker,
        set: { name: sec.name, assetClass: sec.assetClass },
      });
  }
  console.log("  ✓ Securities");

  // 3. Upsert portfolio
  await db
    .insert(portfolios)
    .values({
      id: PORTFOLIO_ID,
      userId: USER_ID,
      name: "Main Portfolio",
      description: "Primary growth portfolio",
      currency: "USD",
      benchmarkTicker: "SPY",
      isDefault: true,
    })
    .onConflictDoUpdate({
      target: portfolios.id,
      set: { name: "Main Portfolio", isDefault: true },
    });
  console.log("  ✓ Portfolio");

  // 4. Upsert positions
  for (const pos of POSITIONS) {
    const sec = SECS[pos.secKey];
    await db
      .insert(positions)
      .values({
        id: pos.id,
        portfolioId: PORTFOLIO_ID,
        securityId: sec.id,
        shares: pos.shares,
        avgCostBasis: pos.avgCostBasis,
        openedAt: pos.openedAt,
      })
      .onConflictDoUpdate({
        target: positions.id,
        set: { shares: pos.shares, avgCostBasis: pos.avgCostBasis },
      });
  }
  console.log("  ✓ Positions");

  // 5. Upsert transactions
  for (const txn of SEED_TRANSACTIONS) {
    const isDeposit = txn.type === "deposit";
    const amount = isDeposit
      ? (DEPOSIT_AMOUNTS[txn.id] ?? "0")
      : txn.shares && txn.price
        ? String(Number(txn.shares) * Number(txn.price))
        : "0";

    const secId = txn.sec ? SECS[txn.sec as keyof typeof SECS].id : null;
    const posId = txn.posKey ?? null;

    await db
      .insert(transactions)
      .values({
        id: txn.id,
        portfolioId: PORTFOLIO_ID,
        positionId: posId,
        securityId: secId,
        type: txn.type as "buy" | "deposit",
        date: txn.date,
        shares: txn.shares ?? null,
        pricePerShare: txn.price ?? null,
        amount,
        fees: txn.fees,
        currency: "USD",
        source: "manual",
        notes: isDeposit ? "Initial funding" : null,
      })
      .onConflictDoUpdate({
        target: transactions.id,
        set: { amount },
      });
  }
  console.log("  ✓ Transactions");

  // 6. Upsert cash balance
  // Total deposited: 125,000 — total invested in buys
  const totalBought =
    15 * 618 + 5 * 626 +         // NVDA
    15 * 520 +                    // META
    60 * 455 + 40 * 572.5 +      // SPY
    30 * 370.2 +                  // MSFT
    40 * 195.6 +                  // AMZN
    20 * 177.5 + 20 * 192 + 10 * 193 + // AAPL
    20 * 215 +                    // JPM
    25 * 175.8;                   // GOOGL
  const totalDeposited = 50000 + 50000 + 25000;
  const cashBalance = (totalDeposited - totalBought).toFixed(2);

  await db
    .insert(cashBalances)
    .values({
      id: CASH_ID,
      portfolioId: PORTFOLIO_ID,
      currency: "USD",
      balance: cashBalance,
    })
    .onConflictDoUpdate({
      target: cashBalances.id,
      set: { balance: cashBalance },
    });
  console.log(`  ✓ Cash balance: $${cashBalance}`);

  console.log("");
  console.log("✅ Seed complete!");
  console.log(`   User ID:     ${USER_ID}`);
  console.log(`   Portfolio:   ${PORTFOLIO_ID}`);
  console.log("");
  console.log("   Add to .env:  DEV_USER_ID=user_demo_01");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
