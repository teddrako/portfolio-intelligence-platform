/**
 * FinnhubCalendarProvider
 *
 * Earnings and economic calendar via Finnhub's free API tier.
 * Enable: set CALENDAR_PROVIDER=finnhub + FINNHUB_API_KEY
 *
 * Free-tier limits: 60 req/min. The earnings endpoint supports date filtering
 * and optional symbol filtering. The economic calendar returns a rolling
 * ~2-month window of upcoming events; it degrades gracefully to [] if the
 * account is not on a paid plan.
 *
 * API reference:
 *   https://finnhub.io/docs/api/earnings-calendar
 *   https://finnhub.io/docs/api/economic-calendar
 */

import type { ICalendarProvider } from "./interface";
import type { MacroEvent, EarningsEvent, Importance, EarningsTime } from "../types";

const BASE = "https://finnhub.io/api/v1";

// ─── Raw API shapes ───────────────────────────────────────────────────────────

interface FinnhubEarningsItem {
  date:            string;
  symbol:          string;
  hour:            string;  // "bmo" | "amc" | "dmh" | ""
  epsEstimate:     number | null;
  epsActual:       number | null;
  revenueEstimate: number | null;
  revenueActual:   number | null;
  quarter:         number;
  year:            number;
}

interface FinnhubEarningsResponse {
  earningsCalendar?: FinnhubEarningsItem[];
}

interface FinnhubEconomicItem {
  event:    string;
  time:     string;   // ISO datetime UTC e.g. "2026-04-10T12:30:00+00:00"
  country:  string;
  impact:   string;   // "high" | "medium" | "low"
  estimate: number | null;
  actual:   number | null;
  prev:     number | null;
  unit:     string;   // "%" | "K" | "B" | etc.
}

interface FinnhubEconomicResponse {
  economicCalendar?: FinnhubEconomicItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapHour(hour: string): EarningsTime {
  switch (hour?.toLowerCase()) {
    case "bmo": return "before_market";
    case "amc": return "after_market";
    case "dmh": return "during_market";
    default:    return "unknown";
  }
}

function mapImpact(impact: string): Importance {
  switch (impact?.toLowerCase()) {
    case "high":   return "high";
    case "medium": return "medium";
    default:       return "low";
  }
}

function inferCategory(event: string): string {
  const s = event.toLowerCase();
  if (/\bcpi\b|ppi|inflation/.test(s))                    return "inflation";
  if (/payroll|nonfarm|jobless|unemployment|employment/.test(s)) return "employment";
  if (/\bgdp\b/.test(s))                                  return "gdp";
  if (/fomc|federal funds|rate decision/.test(s))         return "rates";
  if (/\bpmi\b|manufacturing|ism/.test(s))                return "manufacturing";
  if (/retail sales|consumer spend/.test(s))              return "consumer";
  if (/housing|home sales|permits/.test(s))               return "housing";
  if (/trade balance|import|export/.test(s))              return "trade";
  return "macro";
}

function toETTime(isoString: string): string | undefined {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return undefined;
    return d.toLocaleTimeString("en-US", {
      timeZone:  "America/New_York",
      hour:      "2-digit",
      minute:    "2-digit",
      hour12:    false,
    });
  } catch {
    return undefined;
  }
}

function fmtValue(val: number | null, unit: string): string | undefined {
  if (val == null) return undefined;
  const u = unit ? ` ${unit}` : "";
  return `${val}${u}`;
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class FinnhubCalendarProvider implements ICalendarProvider {
  readonly name = "Finnhub";

  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string): Promise<T> {
    const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}token=${this.apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Finnhub ${path} → HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  async getMacroEvents(from: Date, to: Date): Promise<MacroEvent[]> {
    let data: FinnhubEconomicResponse;
    try {
      data = await this.get<FinnhubEconomicResponse>("/calendar/economic");
    } catch (err) {
      console.warn("[finnhub-calendar] economic calendar unavailable:", String(err));
      return [];
    }

    const items = data.economicCalendar ?? [];
    const mapped = items
      .filter((e) => {
        const d = new Date(e.time);
        return d >= from && d <= to;
      })
      .map((e) => ({
        title:       e.event,
        date:        e.time.slice(0, 10),
        time:        toETTime(e.time),
        country:     e.country || "US",
        category:    inferCategory(e.event),
        importance:  mapImpact(e.impact),
        forecast:    fmtValue(e.estimate, e.unit),
        previous:    fmtValue(e.prev,     e.unit),
        actual:      fmtValue(e.actual,   e.unit),
      }));

    // Deduplicate by title+date; prefer entry with actual data over estimate-only
    const seen = new Map<string, typeof mapped[0]>();
    for (const evt of mapped) {
      const key = `${evt.title}-${evt.date}`;
      const existing = seen.get(key);
      if (!existing || (evt.actual != null && existing.actual == null)) {
        seen.set(key, evt);
      }
    }
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getEarningsEvents(tickers: string[], from: Date, to: Date): Promise<EarningsEvent[]> {
    if (tickers.length === 0) return this.getAllEarningsEvents(from, to);

    // Parallel fetches instead of sequential — one HTTP call per ticker simultaneously
    const settled = await Promise.allSettled(
      tickers.map((ticker) =>
        this.get<FinnhubEarningsResponse>(
          `/calendar/earnings?from=${toDateStr(from)}&to=${toDateStr(to)}&symbol=${ticker.toUpperCase()}`,
        ).then((data) => (data.earningsCalendar ?? []).map(toEarningsEvent)),
      ),
    );

    const results: EarningsEvent[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(...r.value);
      else console.warn("[finnhub-calendar] earnings fetch failed:", String(r.reason));
    }
    return deduplicateEarnings(results).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAllEarningsEvents(from: Date, to: Date): Promise<EarningsEvent[]> {
    let data: FinnhubEarningsResponse;
    try {
      data = await this.get<FinnhubEarningsResponse>(
        `/calendar/earnings?from=${toDateStr(from)}&to=${toDateStr(to)}`,
      );
    } catch (err) {
      console.warn("[finnhub-calendar] earnings calendar unavailable:", String(err));
      return [];
    }
    return deduplicateEarnings((data.earningsCalendar ?? []).map(toEarningsEvent))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Dedup by ticker+date; prefer the entry with more complete data. */
function deduplicateEarnings(events: EarningsEvent[]): EarningsEvent[] {
  const map = new Map<string, EarningsEvent>();
  for (const e of events) {
    const key = `${e.ticker}-${e.date}`;
    const existing = map.get(key);
    if (!existing || (e.epsEstimate != null && existing.epsEstimate == null)) {
      map.set(key, e);
    }
  }
  return [...map.values()];
}

function toEarningsEvent(e: FinnhubEarningsItem): EarningsEvent {
  return {
    ticker:           e.symbol,
    date:             e.date,
    time:             mapHour(e.hour),
    epsEstimate:      e.epsEstimate      ?? undefined,
    epsActual:        e.epsActual        ?? undefined,
    revenueEstimate:  e.revenueEstimate  ?? undefined,
    revenueActual:    e.revenueActual    ?? undefined,
    isConfirmed:      true,
  };
}
