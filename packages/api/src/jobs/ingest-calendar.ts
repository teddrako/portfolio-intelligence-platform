/**
 * Ingestion job: macro events + earnings calendar.
 *
 * Pulls upcoming events from ICalendarProvider and upserts them into
 * macro_events and earnings_events tables.
 *
 * TODO: wire to a daily cron trigger (overnight, pre-market).
 *
 * Manual trigger (dev): POST /api/ingest/calendar
 */

import { db } from "@pip/db/db";
import { macroEvents, earningsEvents, securities } from "@pip/db/schema";
import { sql, eq } from "drizzle-orm";
import { getCalendarProvider } from "../providers/calendar";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function ingestCalendar(
  days = 90,
): Promise<{ macro: number; earnings: number; errors: string[] }> {
  const provider = getCalendarProvider();
  const from     = new Date();
  const to       = new Date();
  to.setDate(to.getDate() + days);

  const errors: string[] = [];
  let macroCount    = 0;
  let earningsCount = 0;

  // ── Macro events ──────────────────────────────────────────────────────────
  const macroItems = await provider.getMacroEvents(from, to);
  for (const evt of macroItems) {
    try {
      await db
        .insert(macroEvents)
        .values({
          id:          newId("me"),
          title:       evt.title,
          date:        evt.date,
          time:        evt.time ?? null,
          country:     evt.country,
          category:    evt.category,
          importance:  evt.importance,
          forecast:    evt.forecast ?? null,
          previous:    evt.previous ?? null,
          actual:      evt.actual   ?? null,
          description: evt.description ?? null,
          source:      provider.name,
        })
        .onConflictDoNothing(); // no unique constraint — idempotent by title+date in practice
      macroCount++;
    } catch (err) {
      errors.push(`macro ${evt.date} ${evt.title}: ${String(err)}`);
    }
  }

  // ── Earnings events ───────────────────────────────────────────────────────
  // Build ticker→securityId map for FK resolution
  const secRows = await db.select({ id: securities.id, ticker: securities.ticker }).from(securities);
  const tickerToId = Object.fromEntries(secRows.map((r) => [r.ticker, r.id]));

  const earningsItems = await provider.getAllEarningsEvents(from, to);
  for (const evt of earningsItems) {
    try {
      await db
        .insert(earningsEvents)
        .values({
          id:               newId("ee"),
          securityId:       tickerToId[evt.ticker] ?? null,
          ticker:           evt.ticker,
          securityName:     evt.securityName ?? null,
          date:             evt.date,
          time:             evt.time,
          epsEstimate:      evt.epsEstimate      != null ? String(evt.epsEstimate)      : null,
          epsActual:        evt.epsActual        != null ? String(evt.epsActual)        : null,
          revenueEstimate:  evt.revenueEstimate  != null ? String(evt.revenueEstimate)  : null,
          revenueActual:    evt.revenueActual    != null ? String(evt.revenueActual)    : null,
          surprisePct:      evt.surprisePct      != null ? String(evt.surprisePct)      : null,
          isConfirmed:      evt.isConfirmed,
          source:           provider.name,
        })
        .onConflictDoUpdate({
          target: [earningsEvents.ticker, earningsEvents.date],
          set: {
            epsEstimate:     sql`excluded.eps_estimate`,
            revenueEstimate: sql`excluded.revenue_estimate`,
            isConfirmed:     sql`excluded.is_confirmed`,
          },
        });
      earningsCount++;
    } catch (err) {
      errors.push(`earnings ${evt.ticker} ${evt.date}: ${String(err)}`);
    }
  }

  console.log(`[ingest-calendar] macro=${macroCount} earnings=${earningsCount} errors=${errors.length}`);
  return { macro: macroCount, earnings: earningsCount, errors };
}
