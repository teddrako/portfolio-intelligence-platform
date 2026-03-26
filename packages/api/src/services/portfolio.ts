import { db } from "@pip/db/db";
import {
  portfolios,
  positions,
  transactions,
  cashBalances,
  securities,
} from "@pip/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getQuote, getQuotes } from "./prices";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositionWithMetrics {
  positionId: string;
  securityId: string;
  ticker: string;
  name: string;
  assetClass: string;
  sector: string | null;
  shares: number;
  avgCostBasis: number;
  currentPrice: number;
  previousClose: number;
  marketValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dailyPnl: number;
  dailyChangePct: number;
  portfolioWeight: number;
  openedAt: Date;
}

export interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  investedCapital: number;
  cashBalance: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dailyPnl: number;
  dailyPnlPct: number;
  totalReturn: number;
  totalReturnPct: number;
  positionCount: number;
  currency: string;
}

export type RecentTransaction = {
  id: string;
  type: string;
  date: string;
  shares: string | null;
  pricePerShare: string | null;
  amount: string;
  fees: string;
  currency: string;
  notes: string | null;
  ticker: string | null;
  securityName: string | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getDefaultPortfolio(userId: string) {
  const rows = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .orderBy(desc(portfolios.isDefault), portfolios.createdAt)
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserPortfolios(userId: string) {
  return db.select().from(portfolios).where(eq(portfolios.userId, userId)).orderBy(desc(portfolios.isDefault), portfolios.createdAt);
}

export async function getPortfolioById(portfolioId: string, userId: string) {
  const rows = await db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getHoldings(portfolioId: string): Promise<PositionWithMetrics[]> {
  const rows = await db
    .select({
      positionId: positions.id,
      securityId: positions.securityId,
      shares: positions.shares,
      avgCostBasis: positions.avgCostBasis,
      openedAt: positions.openedAt,
      ticker: securities.ticker,
      name: securities.name,
      assetClass: securities.assetClass,
      sector: securities.sector,
    })
    .from(positions)
    .innerJoin(securities, eq(positions.securityId, securities.id))
    .where(and(eq(positions.portfolioId, portfolioId), isNull(positions.closedAt)));

  const tickers = [...new Set(rows.map((r) => r.ticker))];
  const quotes  = await getQuotes(tickers);

  const withMetrics = rows.map((row) => {
    const shares = Number(row.shares);
    const avgCostBasis = Number(row.avgCostBasis);
    const quote = quotes.get(row.ticker);
    const currentPrice = quote?.price ?? avgCostBasis;
    const previousClose = quote?.previousClose ?? currentPrice;

    const marketValue = shares * currentPrice;
    const totalCost = shares * avgCostBasis;
    const unrealizedPnl = marketValue - totalCost;
    const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
    const dailyPnl = shares * (currentPrice - previousClose);
    const dailyChangePct =
      previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

    return {
      ...row,
      shares,
      avgCostBasis,
      currentPrice,
      previousClose,
      marketValue,
      totalCost,
      unrealizedPnl,
      unrealizedPnlPct,
      dailyPnl,
      dailyChangePct,
      portfolioWeight: 0, // computed in second pass
    };
  });

  const totalMarketValue = withMetrics.reduce((s, h) => s + h.marketValue, 0);
  return withMetrics
    .map((h) => ({
      ...h,
      portfolioWeight: totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

export async function getCashBalance(portfolioId: string, currency = "USD"): Promise<number> {
  const rows = await db
    .select({ balance: cashBalances.balance })
    .from(cashBalances)
    .where(and(eq(cashBalances.portfolioId, portfolioId), eq(cashBalances.currency, currency)))
    .limit(1);
  return rows[0] ? Number(rows[0].balance) : 0;
}

export async function getPortfolioSummary(
  portfolioId: string,
  userId: string,
): Promise<PortfolioSummary | null> {
  const portfolio = await getPortfolioById(portfolioId, userId);
  if (!portfolio) return null;

  const [holdings, cash] = await Promise.all([
    getHoldings(portfolioId),
    getCashBalance(portfolioId, portfolio.currency),
  ]);

  const investedCapital = holdings.reduce((s, h) => s + h.totalCost, 0);
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalValue = totalMarketValue + cash;
  const unrealizedPnl = totalMarketValue - investedCapital;
  const unrealizedPnlPct = investedCapital > 0 ? (unrealizedPnl / investedCapital) * 100 : 0;
  const dailyPnl = holdings.reduce((s, h) => s + h.dailyPnl, 0);
  const prevMarketValue = totalMarketValue - dailyPnl;
  const dailyPnlPct = prevMarketValue > 0 ? (dailyPnl / prevMarketValue) * 100 : 0;

  return {
    portfolioId,
    portfolioName: portfolio.name,
    totalValue,
    investedCapital,
    cashBalance: cash,
    unrealizedPnl,
    unrealizedPnlPct,
    dailyPnl,
    dailyPnlPct,
    totalReturn: unrealizedPnl,
    totalReturnPct: unrealizedPnlPct,
    positionCount: holdings.length,
    currency: portfolio.currency,
  };
}

export async function getRecentTransactions(
  portfolioId: string,
  limit = 20,
): Promise<RecentTransaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      date: transactions.date,
      shares: transactions.shares,
      pricePerShare: transactions.pricePerShare,
      amount: transactions.amount,
      fees: transactions.fees,
      currency: transactions.currency,
      notes: transactions.notes,
      ticker: securities.ticker,
      securityName: securities.name,
    })
    .from(transactions)
    .leftJoin(securities, eq(transactions.securityId, securities.id))
    .where(eq(transactions.portfolioId, portfolioId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    shares: r.shares ?? null,
    pricePerShare: r.pricePerShare ?? null,
    fees: r.fees ?? "0",
    ticker: r.ticker ?? null,
    securityName: r.securityName ?? null,
  }));
}

export async function getPositionByTicker(portfolioId: string, ticker: string) {
  const rows = await db
    .select({
      positionId: positions.id,
      securityId: positions.securityId,
      shares: positions.shares,
      avgCostBasis: positions.avgCostBasis,
      openedAt: positions.openedAt,
      notes: positions.notes,
      ticker: securities.ticker,
      name: securities.name,
      assetClass: securities.assetClass,
      sector: securities.sector,
      industry: securities.industry,
      exchange: securities.exchange,
    })
    .from(positions)
    .innerJoin(securities, eq(positions.securityId, securities.id))
    .where(
      and(
        eq(positions.portfolioId, portfolioId),
        eq(securities.ticker, ticker.toUpperCase()),
        isNull(positions.closedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const shares = Number(row.shares);
  const avgCostBasis = Number(row.avgCostBasis);
  const quote = await getQuote(row.ticker);
  const currentPrice  = quote?.price        ?? avgCostBasis;
  const previousClose = quote?.previousClose ?? currentPrice;
  const marketValue = shares * currentPrice;
  const totalCost = shares * avgCostBasis;
  const unrealizedPnl = marketValue - totalCost;
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
  const dailyPnl = shares * (currentPrice - previousClose);
  const dailyChangePct =
    previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

  return {
    ...row,
    shares,
    avgCostBasis,
    currentPrice,
    previousClose,
    marketValue,
    totalCost,
    unrealizedPnl,
    unrealizedPnlPct,
    dailyPnl,
    dailyChangePct,
  };
}

export async function getPositionTransactions(positionId: string) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      date: transactions.date,
      shares: transactions.shares,
      pricePerShare: transactions.pricePerShare,
      amount: transactions.amount,
      fees: transactions.fees,
      currency: transactions.currency,
      notes: transactions.notes,
    })
    .from(transactions)
    .where(eq(transactions.positionId, positionId))
    .orderBy(desc(transactions.date));
}
