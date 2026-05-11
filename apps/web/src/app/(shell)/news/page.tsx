import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import type { NewsArticleDTO } from "@pip/api";
import { NewsFilters } from "./components/NewsFilters";

export const metadata = { title: "Intelligence — Portfolio Intelligence" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "bg-green-500/15 text-green-400",
  negative: "bg-red-500/15 text-red-400",
  neutral:  "bg-gray-700 text-gray-400",
};

const IMPORTANCE_DOTS: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-yellow-400",
  low:    "bg-gray-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  company:      "Company",
  sector:       "Sector",
  macro:        "Macro",
  policy:       "Policy",
  geopolitical: "Geopolitical",
  commodities:  "Commodities",
  rates:        "Rates",
  fx:           "FX",
  earnings:     "Earnings",
};

// ─── Relevance badge ──────────────────────────────────────────────────────────

function relevanceBadge(score: number): string {
  if (score >= 70) return "bg-indigo-500/20 text-indigo-300";
  if (score >= 40) return "bg-yellow-500/15 text-yellow-400";
  return "bg-gray-800 text-gray-500";
}

function relevanceLabel(score: number): string {
  if (score >= 70) return "High relevance";
  if (score >= 40) return "Moderate";
  return "Low relevance";
}

// ─── Filter skeleton ──────────────────────────────────────────────────────────

function NewsFiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {["All News", "My Holdings", "Macro", "Earnings", "Policy", "Rates"].map((label) => (
          <div key={label} className="rounded px-3 py-1.5 text-xs text-gray-600">{label}</div>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {["All", "High", "Medium"].map((label) => (
          <div key={label} className="rounded px-3 py-1.5 text-xs text-gray-600">{label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({
  item,
  showRelevance = false,
}: {
  item:          NewsArticleDTO;
  showRelevance?: boolean;
}) {
  const hasScore = showRelevance && item.relevanceScore > 0;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700">
      {/* Top row: importance dot + category + relevance badge + timestamp */}
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${IMPORTANCE_DOTS[item.importance]}`}
          title={`${item.importance} importance`}
        />
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {CATEGORY_LABELS[item.category] ?? item.category}
        </span>

        {hasScore && (
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${relevanceBadge(item.relevanceScore)}`}
            title={`Portfolio relevance: ${item.relevanceScore}/100`}
          >
            {relevanceLabel(item.relevanceScore)} · {item.relevanceScore}
          </span>
        )}

        <span className="ml-auto shrink-0 text-[10px] text-gray-600">
          {timeAgo(item.publishedAt)}
        </span>
      </div>

      {/* Title */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-3 text-sm font-medium leading-snug text-gray-100 transition-colors hover:text-blue-400"
      >
        {item.title}
      </a>

      {/* Summary */}
      <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">{item.summary}</p>

      {/* LLM reason — only shown when score is available */}
      {showRelevance && item.llmReason && (
        <p className="rounded-md border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-indigo-300/80">
          {item.llmReason}
        </p>
      )}

      {/* Footer: tickers + source + sentiment */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {item.tickers.slice(0, 4).map((t) => (
          <a
            key={t}
            href={`/positions/${t}`}
            className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 transition-colors hover:bg-blue-500/25"
          >
            {t}
          </a>
        ))}
        <span className="ml-auto text-[10px] text-gray-600">{item.source}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            SENTIMENT_STYLES[item.sentiment] ?? SENTIMENT_STYLES.neutral
          }`}
        >
          {item.sentiment}
        </span>
        {showRelevance && item.portfolioImpact && item.portfolioImpact !== "neutral" && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              item.portfolioImpact === "positive"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {item.portfolioImpact === "positive" ? "↑ portfolio" : "↓ portfolio"}
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Tab → tRPC arg mapping ───────────────────────────────────────────────────

const CATEGORY_TABS = new Set(["macro", "earnings", "policy", "rates", "sector"]);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; importance?: string }>;
}) {
  const { tab = "all", importance = "all" } = await searchParams;
  const caller = await trpc();

  let items: NewsArticleDTO[];
  const isHoldingsTab = tab === "holdings";

  if (isHoldingsTab) {
    // LLM-scored articles for the user's holdings, sorted by relevance
    items = await caller.news.forHoldingsWithScores({ limit: 40 });
  } else if (CATEGORY_TABS.has(tab)) {
    items = await caller.news.byCategory({
      category: tab as Parameters<typeof caller.news.byCategory>[0]["category"],
      limit: 50,
    });
  } else {
    items = await caller.news.list({ limit: 50 });
  }

  if (importance !== "all") {
    items = items.filter((n) => n.importance === importance);
  }

  const scoredCount = isHoldingsTab
    ? items.filter((n) => n.llmReason).length
    : 0;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Market Intelligence</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {items.length} article{items.length !== 1 ? "s" : ""}
            {isHoldingsTab && scoredCount > 0 && (
              <> · <span className="text-indigo-400">{scoredCount} AI-scored</span></>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={<NewsFiltersSkeleton />}>
        <NewsFilters />
      </Suspense>

      {/* Holdings tab explainer */}
      {isHoldingsTab && (
        <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
          <span className="mt-0.5 text-sm">✦</span>
          <p className="text-[12px] leading-relaxed text-indigo-300/80">
            Articles are scored and ranked by AI for relevance to your portfolio holdings.
            {scoredCount === 0 && " Scoring requires a configured Gemini API key."}
          </p>
        </div>
      )}

      {/* Feed */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20 text-center">
          <p className="text-gray-400">No articles match your filter.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, idx) => (
            <ArticleCard
              key={`${item.url}-${idx}`}
              item={item}
              showRelevance={isHoldingsTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}
