import { trpc } from "@/trpc/server";
import type { MacroEventDTO, EarningsEventDTO } from "@pip/api";

export const metadata = { title: "Calendar — Portfolio Intelligence" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    timeZone: "UTC",
  });
}

function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00Z");
  const today  = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatRevenue(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function groupByWeek(
  events: MacroEventDTO[],
): Array<{ label: string; events: MacroEventDTO[] }> {
  const groups = new Map<string, MacroEventDTO[]>();
  for (const e of events) {
    const d   = new Date(e.date + "T00:00:00Z");
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1);
    const key = mon.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return [...groups.entries()].map(([key, evts]) => {
    const mon = new Date(key + "T00:00:00Z");
    const fri = new Date(mon);
    fri.setUTCDate(mon.getUTCDate() + 4);
    const label = `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${fri.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
    return { label, events: evts };
  });
}

const IMPORTANCE_STYLES = {
  high:   { dot: "bg-red-400",    badge: "border-red-500/20 bg-red-500/10 text-red-400" },
  medium: { dot: "bg-yellow-400", badge: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400" },
  low:    { dot: "bg-gray-600",   badge: "border-gray-700 bg-gray-800 text-gray-500" },
};

const EARNINGS_TIME_LABELS: Record<string, string> = {
  before_market: "Pre-market",
  after_market:  "After close",
  during_market: "During market",
  unknown:       "TBD",
};

// ─── Macro event row ──────────────────────────────────────────────────────────

function MacroRow({ evt }: { evt: MacroEventDTO }) {
  const style    = IMPORTANCE_STYLES[evt.importance];
  const daysAway = daysFromNow(evt.date);
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      {/* Date column */}
      <div className="w-20 shrink-0 text-right">
        <p className="text-xs font-medium text-gray-300">{formatDate(evt.date)}</p>
        {evt.time && <p className="text-[10px] text-gray-600">{evt.time} ET</p>}
        {daysAway <= 7 && (
          <p className={`text-[10px] font-medium ${daysAway === 0 ? "text-blue-400" : "text-gray-500"}`}>
            {daysAway === 0 ? "Today" : `In ${daysAway}d`}
          </p>
        )}
      </div>

      {/* Importance dot */}
      <div className="mt-1.5 shrink-0">
        <span className={`block h-2 w-2 rounded-full ${style.dot}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-200">{evt.title}</p>
        {evt.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-600">{evt.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
          {evt.forecast !== null && (
            <span>Forecast: <span className="text-gray-300">{evt.forecast}</span></span>
          )}
          {evt.previous !== null && (
            <span>Prior: <span className="text-gray-400">{evt.previous}</span></span>
          )}
          {evt.actual !== null && (
            <span>Actual: <span className="font-medium text-green-400">{evt.actual}</span></span>
          )}
        </div>
      </div>

      {/* Importance badge */}
      <div className="shrink-0">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
          {evt.importance}
        </span>
      </div>
    </div>
  );
}

// ─── Earnings row ─────────────────────────────────────────────────────────────

function EarningsRow({ evt }: { evt: EarningsEventDTO }) {
  const daysAway = daysFromNow(evt.date);
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${evt.isHolding ? "text-blue-400" : "text-gray-200"}`}
          >
            {evt.ticker}
          </span>
          {!evt.isConfirmed && (
            <span className="text-[10px] italic text-gray-600">est.</span>
          )}
        </div>
        {evt.securityName && (
          <p className="line-clamp-1 text-xs text-gray-500">{evt.securityName}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
          <span>{formatDate(evt.date)}</span>
          <span>·</span>
          <span>{EARNINGS_TIME_LABELS[evt.time]}</span>
        </div>
        {evt.epsEstimate !== null && (
          <p className="mt-0.5 text-[11px] text-gray-500">
            EPS est. <span className="text-gray-300">${evt.epsEstimate.toFixed(2)}</span>
            {evt.revenueEstimate !== null && (
              <> · Rev est. <span className="text-gray-300">{formatRevenue(evt.revenueEstimate)}</span></>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-xs font-medium ${daysAway <= 7 ? "text-blue-400" : "text-gray-500"}`}>
          {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway}d`}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CalendarPage() {
  const caller = await trpc();

  const [macroEvents, earningsForMe, allEarnings] = await Promise.all([
    caller.calendar.macroEvents({ days: 60 }),
    caller.calendar.earningsForHoldings({ days: 90 }),
    caller.calendar.earningsAll({ days: 90 }),
  ]);

  const myTickers    = new Set(earningsForMe.map((e) => e.ticker));
  const otherEarnings = allEarnings.filter((e) => !myTickers.has(e.ticker));
  const weekGroups   = groupByWeek(macroEvents);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Calendar</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {macroEvents.length} macro events · {allEarnings.length} earnings upcoming
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
        {/* ── Macro Events (3/5) ─────────────────────────────────────────── */}
        <section className="space-y-6 xl:col-span-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Macro Events
          </h2>

          {macroEvents.length === 0 && (
            <p className="text-sm text-gray-500">No upcoming macro events.</p>
          )}

          {weekGroups.map((group, gi) => (
            <div key={gi} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                {group.label}
              </p>
              <div className="overflow-hidden divide-y divide-gray-800/60 rounded-xl border border-gray-800 bg-gray-900">
                {group.events.map((evt) => (
                  <MacroRow key={evt.id} evt={evt} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── Earnings (2/5) ─────────────────────────────────────────────── */}
        <section className="space-y-6 xl:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Earnings
          </h2>

          {earningsForMe.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-blue-400">Your holdings</p>
              <div className="overflow-hidden divide-y divide-gray-800/60 rounded-xl border border-blue-500/20 bg-gray-900">
                {earningsForMe.map((e) => (
                  <EarningsRow key={e.id} evt={e} />
                ))}
              </div>
            </div>
          )}

          {otherEarnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Other upcoming</p>
              <div className="overflow-hidden divide-y divide-gray-800/60 rounded-xl border border-gray-800 bg-gray-900">
                {otherEarnings.map((e) => (
                  <EarningsRow key={e.id} evt={e} />
                ))}
              </div>
            </div>
          )}

          {allEarnings.length === 0 && (
            <p className="text-sm text-gray-500">No upcoming earnings.</p>
          )}
        </section>
      </div>
    </div>
  );
}
