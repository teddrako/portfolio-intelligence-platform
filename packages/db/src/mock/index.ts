import type { Security } from "../schema/securities";
import type { Portfolio } from "../schema/portfolios";
import type { NewsItem } from "../schema/news";

// ─── Securities ───────────────────────────────────────────────────────────────

const SEC_DEFAULTS = { industry: null, description: null, logoUrl: null, updatedAt: new Date("2024-01-01") };

export const mockSecurities: Security[] = [
  { ...SEC_DEFAULTS, id: "s_nvda", ticker: "NVDA", name: "NVIDIA Corp.", assetClass: "equity", sector: "Technology", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_meta", ticker: "META", name: "Meta Platforms", assetClass: "equity", sector: "Technology", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_spy", ticker: "SPY", name: "SPDR S&P 500 ETF", assetClass: "etf", sector: null, exchange: "NYSE", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_msft", ticker: "MSFT", name: "Microsoft Corp.", assetClass: "equity", sector: "Technology", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_amzn", ticker: "AMZN", name: "Amazon.com", assetClass: "equity", sector: "Consumer Disc.", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_aapl", ticker: "AAPL", name: "Apple Inc.", assetClass: "equity", sector: "Technology", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_jpm", ticker: "JPM", name: "JPMorgan Chase", assetClass: "equity", sector: "Financials", exchange: "NYSE", currency: "USD", createdAt: new Date("2024-01-01") },
  { ...SEC_DEFAULTS, id: "s_googl", ticker: "GOOGL", name: "Alphabet Inc.", assetClass: "equity", sector: "Technology", exchange: "NASDAQ", currency: "USD", createdAt: new Date("2024-01-01") },
];

// ─── Portfolio ─────────────────────────────────────────────────────────────────

export const mockPortfolio: Portfolio = {
  id: "port_1",
  userId: "user_1",
  name: "Main Portfolio",
  description: "Primary growth portfolio",
  currency: "USD",
  benchmarkTicker: "SPY",
  isDefault: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2026-03-25"),
};

// ─── Holdings with live-like metrics ─────────────────────────────────────────

export interface HoldingWithMetrics {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  assetClass: "equity" | "etf";
  shares: number;
  avgCost: number;
  currentPrice: number;
  previousClose: number;
  marketValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dailyPnl: number;
  dailyChangePct: number;
  portfolioWeight: number;
}

const rawHoldings = [
  { id: "h_nvda", ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", assetClass: "equity" as const, shares: 20, avgCost: 620.0, currentPrice: 891.25, previousClose: 872.37 },
  { id: "h_meta", ticker: "META", name: "Meta Platforms", sector: "Technology", assetClass: "equity" as const, shares: 15, avgCost: 520.0, currentPrice: 605.3, previousClose: 598.59 },
  { id: "h_spy", ticker: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF", assetClass: "etf" as const, shares: 100, avgCost: 505.0, currentPrice: 542.18, previousClose: 540.66 },
  { id: "h_msft", ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", assetClass: "equity" as const, shares: 30, avgCost: 370.2, currentPrice: 388.95, previousClose: 390.2 },
  { id: "h_amzn", ticker: "AMZN", name: "Amazon.com", sector: "Consumer Disc.", assetClass: "equity" as const, shares: 40, avgCost: 195.6, currentPrice: 212.75, previousClose: 214.18 },
  { id: "h_aapl", ticker: "AAPL", name: "Apple Inc.", sector: "Technology", assetClass: "equity" as const, shares: 50, avgCost: 187.5, currentPrice: 201.35, previousClose: 199.6 },
  { id: "h_jpm", ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", assetClass: "equity" as const, shares: 20, avgCost: 215.0, currentPrice: 228.9, previousClose: 228.56 },
  { id: "h_googl", ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology", assetClass: "equity" as const, shares: 25, avgCost: 175.8, currentPrice: 183.4, previousClose: 182.58 },
];

const totalMarketValue = rawHoldings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);

export const mockHoldings: HoldingWithMetrics[] = rawHoldings.map((h) => {
  const marketValue = h.shares * h.currentPrice;
  const totalCost = h.shares * h.avgCost;
  const dailyPnl = h.shares * (h.currentPrice - h.previousClose);
  return {
    ...h,
    marketValue,
    totalCost,
    unrealizedPnl: marketValue - totalCost,
    unrealizedPnlPct: ((marketValue - totalCost) / totalCost) * 100,
    dailyPnl,
    dailyChangePct: ((h.currentPrice - h.previousClose) / h.previousClose) * 100,
    portfolioWeight: (marketValue / totalMarketValue) * 100,
  };
});

// ─── Portfolio Summary ─────────────────────────────────────────────────────────

export const mockPortfolioSummary = (() => {
  const totalValue = mockHoldings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost = mockHoldings.reduce((s, h) => s + h.totalCost, 0);
  const totalDailyPnl = mockHoldings.reduce((s, h) => s + h.dailyPnl, 0);
  return {
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    totalPnlPct: ((totalValue - totalCost) / totalCost) * 100,
    dailyPnl: totalDailyPnl,
    dailyPnlPct: (totalDailyPnl / (totalValue - totalDailyPnl)) * 100,
    positionCount: mockHoldings.length,
  };
})();

// ─── News ──────────────────────────────────────────────────────────────────────

export const mockNews: NewsItem[] = [
  {
    id: "n1",
    title: "NVIDIA Reports Record Q4 Revenue, Data Center Sales Up 78% YoY",
    summary: "NVIDIA beat consensus estimates by 12%, driven by surging AI infrastructure demand from hyperscalers.",
    source: "Reuters",
    url: null,
    ticker: "NVDA",
    affectedTickers: ["NVDA", "AMD", "INTC"],
    category: "earnings",
    sentiment: "positive",
    importance: "high",
    relevanceScore: 95,
    publishedAt: new Date("2026-03-25T09:30:00Z"),
    createdAt: new Date("2026-03-25T09:30:00Z"),
  },
  {
    id: "n2",
    title: "Federal Reserve Holds Rates Steady, Signals Two Cuts in H2 2026",
    summary: "The Fed left the federal funds rate unchanged at 4.25–4.50%, with the dot plot projecting two 25bps cuts later this year.",
    source: "Bloomberg",
    url: null,
    ticker: null,
    affectedTickers: null,
    category: "macro",
    sentiment: "neutral",
    importance: "high",
    relevanceScore: 90,
    publishedAt: new Date("2026-03-25T14:00:00Z"),
    createdAt: new Date("2026-03-25T14:00:00Z"),
  },
  {
    id: "n3",
    title: "Meta AI Studio Sees 40% Surge in Enterprise Adoption",
    summary: "Meta's AI development platform has crossed 2M enterprise users, with analysts raising price targets to $680.",
    source: "CNBC",
    url: null,
    ticker: "META",
    affectedTickers: ["META"],
    category: "company",
    sentiment: "positive",
    importance: "medium",
    relevanceScore: 80,
    publishedAt: new Date("2026-03-24T16:00:00Z"),
    createdAt: new Date("2026-03-24T16:00:00Z"),
  },
  {
    id: "n4",
    title: "Apple iPhone 17 Pro Pre-Orders Beat Expectations by 15%",
    summary: "Strong iPhone 17 Pro demand from Asia-Pacific and Europe suggests upside to Q2 revenue guidance.",
    source: "WSJ",
    url: null,
    ticker: "AAPL",
    affectedTickers: ["AAPL"],
    category: "company",
    sentiment: "positive",
    importance: "medium",
    relevanceScore: 78,
    publishedAt: new Date("2026-03-24T11:00:00Z"),
    createdAt: new Date("2026-03-24T11:00:00Z"),
  },
  {
    id: "n5",
    title: "Amazon AWS Growth Accelerates to 22% in Early Q1 Signals",
    summary: "Channel checks suggest AWS re-accelerated after Q4's 19% print, driven by AI workload migrations.",
    source: "FT",
    url: null,
    ticker: "AMZN",
    affectedTickers: ["AMZN"],
    category: "company",
    sentiment: "positive",
    importance: "medium",
    relevanceScore: 75,
    publishedAt: new Date("2026-03-23T15:30:00Z"),
    createdAt: new Date("2026-03-23T15:30:00Z"),
  },
  {
    id: "n6",
    title: "JPMorgan Raises Dividend 12%, Announces $30B Buyback",
    summary: "JPM's capital return program signals confidence in earnings resilience despite macro uncertainty.",
    source: "Bloomberg",
    url: null,
    ticker: "JPM",
    affectedTickers: ["JPM"],
    category: "company",
    sentiment: "positive",
    importance: "medium",
    relevanceScore: 72,
    publishedAt: new Date("2026-03-22T10:00:00Z"),
    createdAt: new Date("2026-03-22T10:00:00Z"),
  },
];
