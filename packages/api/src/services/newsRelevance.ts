/**
 * LLM-powered news relevance scoring.
 *
 * Takes a batch of news articles and a portfolio's holdings, then calls
 * the configured LLM (Gemini) to score each article for portfolio relevance.
 *
 * Results are cached in Redis for 5 minutes so a single LLM call serves all
 * requests within the window. Falls back to heuristic scores if the LLM is
 * unavailable or the key is not set.
 */

import { callAI } from "../lib/ai";
import { withCache } from "../lib/redis";
import type { NewsItem } from "../providers/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMScore {
  relevanceScore:  number;                               // 0–100
  portfolioImpact: "positive" | "negative" | "neutral"; // net effect on portfolio
  reason:          string;                              // ≤ 15 words, specific to portfolio
}

export interface HoldingContext {
  ticker:          string;
  name:            string;
  portfolioWeight: number;   // 0–100 (percent)
  sector:          string | null;
}

// ─── Cache key ────────────────────────────────────────────────────────────────

function buildCacheKey(articles: NewsItem[], holdings: HoldingContext[]): string {
  // Rotate hourly so stale articles are evicted; include holding tickers to
  // separate keys across different portfolios.
  const hour    = new Date().toISOString().slice(0, 13);
  const tickers = holdings.map((h) => h.ticker).sort().join("-");
  // Use first 3 article IDs/URLs as a fingerprint for the article set.
  const sample  = articles
    .slice(0, 3)
    .map((a) => a.externalId ?? a.url.slice(-20))
    .join(",");
  return `news_scores:${tickers}:${hour}:${sample}`;
}

// ─── LLM prompt ──────────────────────────────────────────────────────────────

function buildPrompt(articles: NewsItem[], holdings: HoldingContext[]): string {
  const holdingLines = holdings
    .sort((a, b) => b.portfolioWeight - a.portfolioWeight)
    .map((h) => {
      const sector = h.sector ? ` — ${h.sector}` : "";
      return `- ${h.ticker} ${h.name} (${h.portfolioWeight.toFixed(1)}% weight)${sector}`;
    })
    .join("\n");

  const articleLines = articles
    .map((a, i) => {
      const tag     = a.ticker ? `[${a.ticker}] ` : "";
      const summary = a.summary.slice(0, 160).replace(/\n/g, " ");
      return `${i + 1}. ${tag}${a.title} (${a.source}) — ${summary}`;
    })
    .join("\n");

  return `You are a senior portfolio analyst at a hedge fund. Score each news article's relevance to the portfolio below.

## Portfolio Holdings
${holdingLines}

## Relevance Scale
- 90-100: Direct material catalyst for a major holding (earnings, M&A, regulatory, guidance)
- 70-89:  Significant for a meaningful holding or key sector
- 50-69:  Moderate — industry dynamics, competitor moves, adjacent sector
- 30-49:  Indirect — macro factors with plausible portfolio exposure
- 0-29:   Not relevant to this specific portfolio

## Instructions
For each article (numbered), return ONE JSON object with:
  "id": <1-based integer>
  "relevanceScore": <integer 0-100>
  "portfolioImpact": "positive" | "negative" | "neutral"  (net effect on portfolio value)
  "reason": <string, max 15 words, cite specific ticker or sector>

Return ONLY a valid JSON array — no prose, no markdown fences.

## Articles
${articleLines}`;
}

// ─── JSON parsing ─────────────────────────────────────────────────────────────

interface RawScore {
  id:              number;
  relevanceScore:  number;
  portfolioImpact: string;
  reason:          string;
}

function parseScores(content: string): RawScore[] {
  // Strip markdown fences if the model wraps its output
  const stripped = content.replace(/```[a-z]*\n?/g, "").trim();
  // Find the first JSON array
  const match    = stripped.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as RawScore[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function isValidImpact(s: string): s is "positive" | "negative" | "neutral" {
  return s === "positive" || s === "negative" || s === "neutral";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a batch of articles for relevance to the given portfolio.
 *
 * The returned map is keyed by article URL (always unique).
 * Falls back to heuristic scores if the LLM call fails or the key is missing.
 */
export async function scoreArticlesForPortfolio(
  articles: NewsItem[],
  holdings: HoldingContext[],
): Promise<Map<string, LLMScore>> {
  if (articles.length === 0 || holdings.length === 0) return new Map();

  const cacheKey = buildCacheKey(articles, holdings);

  // Maps don't survive JSON round-trips through Redis — store as [url, score][] entries
  const entries = await withCache<Array<[string, LLMScore]>>(cacheKey, 300, async () => {
    const result = new Map<string, LLMScore>();

    // Process in chunks of 20 to stay well within context limits
    const CHUNK = 20;
    for (let i = 0; i < articles.length; i += CHUNK) {
      const chunk  = articles.slice(i, i + CHUNK);
      const scores = await scoreBatch(chunk, holdings);
      for (const [url, score] of scores) result.set(url, score);
    }

    return [...result.entries()];
  });

  return new Map(entries);
}

async function scoreBatch(
  articles: NewsItem[],
  holdings: HoldingContext[],
): Promise<Map<string, LLMScore>> {
  const result  = new Map<string, LLMScore>();
  const fallback = () => {
    for (const a of articles) {
      result.set(a.url, {
        relevanceScore:  a.relevanceScore,
        portfolioImpact: "neutral",
        reason:          "",
      });
    }
    return result;
  };

  // Skip if GEMINI_API_KEY is not configured
  if (!process.env.GEMINI_API_KEY) return fallback();

  let rawScores: RawScore[];
  try {
    const { content } = await callAI(buildPrompt(articles, holdings));
    rawScores = parseScores(content);
  } catch (err) {
    console.warn("[newsRelevance] LLM call failed, using heuristic scores:", err);
    return fallback();
  }

  if (rawScores.length === 0) {
    console.warn("[newsRelevance] LLM returned no parseable scores");
    return fallback();
  }

  for (const raw of rawScores) {
    const article = articles[raw.id - 1];
    if (!article) continue;
    result.set(article.url, {
      relevanceScore:  Math.max(0, Math.min(100, Math.round(raw.relevanceScore ?? 0))),
      portfolioImpact: isValidImpact(raw.portfolioImpact) ? raw.portfolioImpact : "neutral",
      reason:          typeof raw.reason === "string" ? raw.reason.slice(0, 120) : "",
    });
  }

  // Fill in any articles the LLM missed
  for (const a of articles) {
    if (!result.has(a.url)) {
      result.set(a.url, { relevanceScore: a.relevanceScore, portfolioImpact: "neutral", reason: "" });
    }
  }

  return result;
}
