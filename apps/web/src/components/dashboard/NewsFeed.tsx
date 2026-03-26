import { Badge, Card, CardHeader, CardTitle } from "@pip/ui";
import type { NewsArticleDTO } from "@pip/api";

const sentimentVariant = {
  positive: "success",
  negative: "danger",
  neutral:  "default",
} as const;

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const hrs  = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (hrs < 1)  return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export function NewsFeed({ news }: { news: NewsArticleDTO[] }) {
  return (
    <Card padding="none">
      <CardHeader className="px-4 pt-4">
        <CardTitle>Latest News</CardTitle>
        <span className="text-xs text-gray-500">Relevant to your holdings</span>
      </CardHeader>

      <ul className="divide-y divide-gray-800/60">
        {news.map((item, idx) => (
          <li key={item.url ?? idx} className="px-4 py-3 transition-colors hover:bg-gray-800/30">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug text-gray-200">{item.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {item.tickers[0] && (
                    <span className="text-xs font-medium text-blue-400">{item.tickers[0]}</span>
                  )}
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">{item.source}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
              <Badge variant={sentimentVariant[item.sentiment]} className="shrink-0">
                {item.sentiment}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
