import { GoogleGenAI } from "@google/genai";
import type { PositionWithMetrics, PortfolioSummary } from "../services/portfolio";
import type { ReportType } from "@pip/db/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// ─── Gemini call ──────────────────────────────────────────────────────────────

export async function callAI(prompt: string): Promise<{ content: string; tokensUsed: number | null }> {
  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
  });

  return {
    content: response.text ?? "",
    tokensUsed: response.usageMetadata?.totalTokenCount ?? null,
  };
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function fmt(n: number, prefix = "$") {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}${prefix}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function holdingsTable(holdings: PositionWithMetrics[]): string {
  if (holdings.length === 0) return "_No open positions._";
  return [
    "| Ticker | Name | Shares | Avg Cost | Price | Mkt Value | Weight | Unr. P&L | Day |",
    "|--------|------|-------:|--------:|------:|----------:|-------:|---------:|----:|",
    ...holdings.map((h) =>
      `| ${h.ticker} | ${h.name} | ${h.shares} | $${h.avgCostBasis.toFixed(2)} | $${h.currentPrice.toFixed(2)} | $${h.marketValue.toFixed(0)} | ${h.portfolioWeight.toFixed(1)}% | ${fmtPct(h.unrealizedPnlPct)} | ${fmtPct(h.dailyChangePct)} |`
    ),
  ].join("\n");
}

function summaryBlock(s: PortfolioSummary): string {
  return [
    `- **Portfolio:** ${s.portfolioName} (${s.currency})`,
    `- **Total Value:** $${s.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `- **Invested Capital:** $${s.investedCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `- **Cash Balance:** $${s.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `- **Unrealized P&L:** ${fmt(s.unrealizedPnl)} (${fmtPct(s.unrealizedPnlPct)})`,
    `- **Today's P&L:** ${fmt(s.dailyPnl)} (${fmtPct(s.dailyPnlPct)})`,
    `- **Positions:** ${s.positionCount}`,
  ].join("\n");
}

// ─── Public prompt builder ────────────────────────────────────────────────────

export interface PromptInput {
  type: ReportType;
  ticker?: string;
  customPrompt?: string;
  holdings: PositionWithMetrics[];
  summary: PortfolioSummary | null;
  dateStr: string;
}

const SYSTEM_ROLE =
  "You are a professional portfolio analyst. Write in clear, concise markdown. " +
  "Be specific about numbers. No filler disclaimers. Use headers, bullets, and tables where helpful.";

export function buildPrompt({ type, ticker, customPrompt, holdings, summary, dateStr }: PromptInput): string {
  const ctx = summary
    ? `## Portfolio Snapshot — ${dateStr}\n\n${summaryBlock(summary)}\n\n## Holdings\n\n${holdingsTable(holdings)}`
    : `_No portfolio data available._`;

  switch (type) {
    case "portfolio_summary":
      return `${SYSTEM_ROLE}

${ctx}

Write a comprehensive portfolio summary for ${dateStr}. Include:
1. **Overview** — total value, key P&L metrics, overall health
2. **Top Performers & Laggards** — call out the best and worst positions today
3. **Concentration & Sector Exposure** — any notable concentration risk
4. **Key Observations** — 2–3 actionable insights or things to watch`;

    case "daily_close":
      return `${SYSTEM_ROLE}

${ctx}

Write a daily close report for ${dateStr}. Include:
1. **Market Session Summary** — how the portfolio performed today vs expectations
2. **Position Moves** — notable gainers and decliners with context
3. **P&L Attribution** — what drove today's portfolio P&L
4. **Overnight Watch** — positions or events to monitor before tomorrow's open`;

    case "morning_brief":
      return `${SYSTEM_ROLE}

${ctx}

Write a pre-market morning brief for ${dateStr}. Include:
1. **Portfolio Positioning** — current exposure and cash level
2. **Positions to Watch** — holdings with upcoming catalysts or elevated risk
3. **Key Levels** — any important price levels for top holdings
4. **Action Items** — suggested things to monitor or consider today`;

    case "security_analysis":
      if (!ticker) return `${SYSTEM_ROLE}\n\nProvide a general security analysis prompt. No ticker was specified.`;
      const pos = holdings.find((h) => h.ticker === ticker);
      const posContext = pos
        ? `**Position:** ${pos.shares} shares @ avg cost $${pos.avgCostBasis.toFixed(2)} | Current $${pos.currentPrice.toFixed(2)} | Mkt Value $${pos.marketValue.toFixed(0)} | Unr. P&L ${fmtPct(pos.unrealizedPnlPct)} | Weight ${pos.portfolioWeight.toFixed(1)}%`
        : `**${ticker}** is not currently held in this portfolio.`;

      return `${SYSTEM_ROLE}

## Security Analysis — ${ticker} — ${dateStr}

${posContext}

${ctx}

Write a focused analysis of **${ticker}**. Include:
1. **Position Summary** — size, cost basis, current P&L
2. **Recent Performance** — price action and what's driving it
3. **Portfolio Impact** — contribution to overall portfolio
4. **Risk Factors** — key risks specific to this holding
5. **Outlook** — short-term considerations for this position`;

    case "risk_preview":
      return `${SYSTEM_ROLE}

${ctx}

Write a portfolio risk assessment for ${dateStr}. Include:
1. **Concentration Risk** — top holdings by weight, sector concentration
2. **Drawdown Exposure** — positions with significant unrealized losses
3. **Correlation Risk** — clusters of similar positions
4. **Cash & Liquidity** — available cash relative to portfolio size
5. **Key Risk Scenarios** — 2–3 scenarios that could materially impact the portfolio`;

    case "custom":
      return `${SYSTEM_ROLE}

${ctx}

${customPrompt ?? "Provide a general portfolio analysis."}`;
  }
}
