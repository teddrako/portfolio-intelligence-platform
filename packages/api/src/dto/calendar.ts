/**
 * Calendar DTOs — MacroEventDTO and EarningsEventDTO.
 *
 * All optional provider fields become explicit null (never undefined) so the
 * frontend can rely on strict null checks without optional-chaining noise.
 */

import type { MacroEvent, EarningsEvent, EarningsTime } from "../providers/types";

// ─── Macro ────────────────────────────────────────────────────────────────────

export interface MacroEventDTO {
  /** Stable rendering key derived from externalId or title+date */
  id:          string;
  title:       string;
  /** YYYY-MM-DD */
  date:        string;
  /** HH:MM ET, or null when time is unknown */
  time:        string | null;
  country:     string;
  category:    string;
  importance:  "low" | "medium" | "high";
  forecast:    string | null;
  previous:    string | null;
  actual:      string | null;
  description: string | null;
}

export function toMacroEventDTO(e: MacroEvent): MacroEventDTO {
  return {
    id:          e.externalId ?? `${e.title}-${e.date}`,
    title:       e.title,
    date:        e.date,
    time:        e.time    ?? null,
    country:     e.country,
    category:    e.category,
    importance:  e.importance,
    forecast:    e.forecast    ?? null,
    previous:    e.previous    ?? null,
    actual:      e.actual      ?? null,
    description: e.description ?? null,
  };
}

// ─── Earnings ─────────────────────────────────────────────────────────────────

export interface EarningsEventDTO {
  /** Stable rendering key */
  id:              string;
  ticker:          string;
  securityName:    string | null;
  /** YYYY-MM-DD */
  date:            string;
  time:            EarningsTime;
  epsEstimate:     number | null;
  epsActual:       number | null;
  revenueEstimate: number | null;
  revenueActual:   number | null;
  surprisePct:     number | null;
  isConfirmed:     boolean;
  /** True when this ticker is in the authenticated user's active portfolio */
  isHolding:       boolean;
}

export function toEarningsEventDTO(
  e: EarningsEvent,
  isHolding: boolean,
): EarningsEventDTO {
  return {
    id:              `${e.ticker}-${e.date}`,
    ticker:          e.ticker,
    securityName:    e.securityName    ?? null,
    date:            e.date,
    time:            e.time,
    epsEstimate:     e.epsEstimate     ?? null,
    epsActual:       e.epsActual       ?? null,
    revenueEstimate: e.revenueEstimate ?? null,
    revenueActual:   e.revenueActual   ?? null,
    surprisePct:     e.surprisePct     ?? null,
    isConfirmed:     e.isConfirmed,
    isHolding,
  };
}
