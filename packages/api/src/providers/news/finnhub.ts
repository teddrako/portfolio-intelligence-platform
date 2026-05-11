/**
 * FinnhubNewsProvider — real company & market news via the Finnhub REST API.
 *
 * Required env var: FINNHUB_API_KEY
 * Free tier: 60 req/min.  Company-news endpoint returns ≤ 200 articles per call.
 *
 * Sentiment and importance are derived heuristically because Finnhub's free
 * tier does not include scored sentiment on the news endpoints.
 */

import type { INewsProvider } from "./interface";
import type { NewsItem, NewsCategory, Sentiment, Importance } from "../types";

// ─── Finnhub wire types ───────────────────────────────────────────────────────

interface FinnhubArticle {
  id:       number;
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  datetime: number;   // Unix seconds
  related:  string;   // primary ticker or empty string
  category: string;
  image?:   string;
}

// ─── Heuristic helpers ────────────────────────────────────────────────────────

const POSITIVE_WORDS = [
  "beat", "beats", "surge", "surges", "gain", "upgrade", "upgrades",
  "strong", "growth", "record", "bull", "outperform", "exceed", "rose",
  "rises", "climbs", "jumps", "soars", "rally", "rallies", "lifted",
];

const NEGATIVE_WORDS = [
  "miss", "misses", "fall", "falls", "decline", "declines", "downgrade",
  "downgrades", "weak", "concern", "risk", "cut", "cuts", "lower", "bearish",
  "underperform", "drop", "drops", "plunge", "slump", "layoff", "layoffs",
  "probe", "investigation", "breach", "halt",
];

function heuristicSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const pos   = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const neg   = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

const TIER1_SOURCES = [
  "reuters", "wall street journal", "wsj", "bloomberg", "financial times",
  "cnbc", "barron", "ft.com", "nytimes", "new york times",
];

function heuristicImportance(source: string): Importance {
  const lower = source.toLowerCase();
  if (TIER1_SOURCES.some((s) => lower.includes(s))) return "high";
  return "medium";
}

function mapFinnhubCategory(cat: string): NewsCategory {
  switch (cat.toLowerCase()) {
    case "forex": return "fx";
    case "crypto": return "commodities";
    case "merger": return "company";
    default:       return "macro";
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// ─── Article normaliser ───────────────────────────────────────────────────────

function normalise(a: FinnhubArticle, overrideTicker?: string): NewsItem {
  const text   = `${a.headline} ${a.summary}`;
  const ticker = overrideTicker ?? (a.related?.toUpperCase() || undefined);

  return {
    externalId:      String(a.id),
    title:           a.headline || "(no headline)",
    summary:         a.summary  || "",
    source:          a.source   || "Finnhub",
    url:             a.url,
    publishedAt:     new Date(a.datetime * 1000),
    affectedTickers: ticker ? [ticker] : [],
    ticker,
    category:        mapFinnhubCategory(a.category),
    sentiment:       heuristicSentiment(text),
    importance:      heuristicImportance(a.source),
    relevanceScore:  ticker ? 70 : 30,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const BASE = "https://finnhub.io/api/v1";

export class FinnhubNewsProvider implements INewsProvider {
  readonly name = "finnhub";

  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string): Promise<T> {
    const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}token=${this.apiKey}`;
    const res = await fetch(url, {
      headers: { "X-Finnhub-Token": this.apiKey },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Finnhub ${res.status} ${res.statusText} — ${path.split("?")[0]}`);
    }
    return res.json() as Promise<T>;
  }

  async getLatestNews(limit: number): Promise<NewsItem[]> {
    const raw = await this.get<FinnhubArticle[]>("/news?category=general");
    return raw.slice(0, limit).map((a) => normalise(a));
  }

  async getNewsByTicker(ticker: string, limit: number): Promise<NewsItem[]> {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const raw = await this.get<FinnhubArticle[]>(
      `/company-news?symbol=${ticker}&from=${toDateStr(from)}&to=${toDateStr(to)}`,
    );
    return raw.slice(0, limit).map((a) => normalise(a, ticker));
  }

  async getNewsByCategory(category: NewsCategory, limit: number): Promise<NewsItem[]> {
    // Map our categories to Finnhub's limited set
    const finnhubCat =
      category === "fx"
        ? "forex"
        : category === "commodities"
          ? "crypto"   // closest available on free tier
          : "general";

    const raw = await this.get<FinnhubArticle[]>(`/news?category=${finnhubCat}`);
    return raw
      .slice(0, limit)
      .map((a) => normalise(a))
      .filter((n) => finnhubCat === "general" || n.category === category);
  }
}
