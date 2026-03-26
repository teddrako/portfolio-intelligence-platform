import { Database, Newspaper, Calendar, BarChart2, ExternalLink } from "lucide-react";
import { ProfileSection } from "./components/ProfileSection";
import { PortfolioSection } from "./components/PortfolioSection";

export const metadata = { title: "Settings — Portfolio Intelligence" };

// ─── Data Sources ─────────────────────────────────────────────────────────────
// Read from env server-side so API keys are never sent to the client.

const PROVIDER_DOCS: Record<string, { label: string; url: string }> = {
  mock:         { label: "Mock (built-in)",    url: "" },
  polygon:      { label: "Polygon.io",         url: "https://polygon.io" },
  alpaca:       { label: "Alpaca Markets",     url: "https://alpaca.markets" },
  benzinga:     { label: "Benzinga",           url: "https://benzinga.com" },
  alphavantage: { label: "Alpha Vantage",      url: "https://www.alphavantage.co" },
  newsapi:      { label: "NewsAPI",            url: "https://newsapi.org" },
};

function providerInfo(key: string) {
  const lower = key.toLowerCase();
  return PROVIDER_DOCS[lower] ?? { label: key, url: "" };
}

interface DataSource {
  icon:     React.ReactNode;
  label:    string;
  provider: string;
  envVar:   string;
  docUrl:   string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const marketKey  = process.env.MARKET_DATA_PROVIDER ?? "mock";
  const newsKey    = process.env.NEWS_PROVIDER        ?? "mock";
  const calKey     = process.env.CALENDAR_PROVIDER    ?? "mock";

  const sources: DataSource[] = [
    {
      icon:     <BarChart2 className="h-4 w-4" />,
      label:    "Market Data",
      provider: providerInfo(marketKey).label,
      envVar:   "MARKET_DATA_PROVIDER",
      docUrl:   providerInfo(marketKey).url,
    },
    {
      icon:     <Newspaper className="h-4 w-4" />,
      label:    "News",
      provider: providerInfo(newsKey).label,
      envVar:   "NEWS_PROVIDER",
      docUrl:   providerInfo(newsKey).url,
    },
    {
      icon:     <Calendar className="h-4 w-4" />,
      label:    "Calendar",
      provider: providerInfo(calKey).label,
      envVar:   "CALENDAR_PROVIDER",
      docUrl:   providerInfo(calKey).url,
    },
  ];

  const allMock = [marketKey, newsKey, calKey].every((k) => k === "mock");

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your account and data providers.</p>
        </div>

        {/* Account */}
        <ProfileSection />

        {/* Portfolios */}
        <PortfolioSection />

        {/* Data Sources */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Data Sources
          </h2>

          {allMock && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <span className="mt-0.5 text-yellow-400">⚠</span>
              <p className="text-xs text-yellow-300/80 leading-relaxed">
                All providers are using built-in mock data. Set{" "}
                <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[11px] text-yellow-200">
                  MARKET_DATA_PROVIDER
                </code>
                ,{" "}
                <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[11px] text-yellow-200">
                  NEWS_PROVIDER
                </code>
                , and{" "}
                <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[11px] text-yellow-200">
                  CALENDAR_PROVIDER
                </code>{" "}
                in your <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[11px] text-yellow-200">.env</code> to connect real APIs.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
            {sources.map((s) => (
              <div key={s.label} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-400">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{s.label}</p>
                  <p className="text-xs text-gray-500">
                    <code className="font-mono text-[11px] text-gray-600">{s.envVar}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    s.provider === "Mock (built-in)"
                      ? "bg-gray-800 text-gray-400"
                      : "bg-green-500/15 text-green-400"
                  }`}>
                    {s.provider}
                  </span>
                  {s.docUrl && (
                    <a
                      href={s.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            To plug in real providers, implement{" "}
            <code className="font-mono text-[11px]">IMarketDataProvider</code> /{" "}
            <code className="font-mono text-[11px]">INewsProvider</code> /{" "}
            <code className="font-mono text-[11px]">ICalendarProvider</code> in{" "}
            <code className="font-mono text-[11px]">packages/api/src/providers/</code> and set the
            relevant env var.
          </p>
        </section>

        {/* Ingestion */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Data Ingestion
          </h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
            {[
              { type: "prices",   label: "Price Snapshots", desc: "EOD OHLCV per security" },
              { type: "news",     label: "News",            desc: "Latest headlines" },
              { type: "calendar", label: "Calendar",        desc: "Macro events + earnings" },
            ].map(({ type, label, desc }) => (
              <IngestRow key={type} type={type} label={label} desc={desc} />
            ))}
          </div>
          <p className="text-xs text-gray-600">
            Ingestion jobs can be triggered manually via{" "}
            <code className="font-mono text-[11px]">POST /api/ingest/[type]</code> with a{" "}
            <code className="font-mono text-[11px]">Bearer {"{INGEST_SECRET}"}</code> header.
            Wire to a cron job for automatic ingestion.
          </p>
        </section>

        {/* App info */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">About</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800 text-sm">
            {[
              ["Platform",   "Portfolio Intelligence"],
              ["Stack",      "Next.js 15 · tRPC v11 · Drizzle · Neon · Better Auth"],
              ["Auth",       "Better Auth v1 · Google OAuth"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-4 px-5 py-3">
                <span className="w-28 shrink-0 text-xs text-gray-500">{k}</span>
                <span className="text-xs text-gray-400">{v}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Ingestion row (client button) ────────────────────────────────────────────

function IngestRow({ type, label, desc }: { type: string; label: string; desc: string }) {
  // Rendered server-side but the button fires a fetch — no tRPC needed here.
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-600">{desc}</p>
      </div>
      <Database className="h-3.5 w-3.5 text-gray-700" />
    </div>
  );
}
