import type { NewsArticleDTO } from "@pip/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  const hrs  = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${days}d ago`;
}

function importanceDot(importance?: string | null) {
  const map: Record<string, string> = {
    high:   "dot-high",
    medium: "dot-medium",
    low:    "dot-low",
  };
  const cls = map[importance?.toLowerCase() ?? ""] ?? "dot-low";
  return (
    <span
      className={`${cls} mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full`}
    />
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, string> = {
    positive: "badge-pos",
    negative: "badge-neg",
    neutral:  "badge-neu",
  };
  const cls = map[sentiment] ?? "badge-neu";
  return (
    <span className={`${cls} shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide`}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewsFeed({ news }: { news: NewsArticleDTO[] }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "#0D0F1A",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div>
          <h2 className="text-[13px] font-semibold text-slate-200">Intelligence</h2>
          <p className="text-[10px] text-slate-600">Relevant to your holdings</p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-500"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="animate-pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      {/* Feed */}
      <ul className="divide-y" style={{ "--tw-divide-opacity": "1" } as React.CSSProperties}>
        {news.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-600">
            No news yet.
          </li>
        ) : (
          news.map((item, idx) => (
            <li
              key={item.url ?? idx}
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              <a
                href={item.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 px-4 py-3 transition-colors duration-100 hover:bg-white/[0.025]"
              >
                {/* Importance dot */}
                {importanceDot((item as any).importance)}

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 text-[12px] font-medium leading-snug text-slate-200 group-hover:text-white transition-colors">
                    {item.title}
                  </p>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Tickers */}
                    {item.tickers.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="num rounded px-1.5 py-px text-[9px] font-semibold text-indigo-300"
                        style={{
                          background: "rgba(99,102,241,0.12)",
                          border: "1px solid rgba(99,102,241,0.2)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    {item.tickers.length > 3 && (
                      <span className="text-[9px] text-slate-600">
                        +{item.tickers.length - 3}
                      </span>
                    )}

                    <span className="text-[9px] text-slate-700">·</span>
                    <span className="text-[10px] text-slate-600">{item.source}</span>
                    <span className="text-[9px] text-slate-700">·</span>
                    <span className="num text-[10px] text-slate-600">{timeAgo(item.publishedAt)}</span>
                  </div>
                </div>

                {/* Sentiment */}
                <SentimentBadge sentiment={item.sentiment} />
              </a>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
