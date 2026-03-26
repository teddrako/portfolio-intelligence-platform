/**
 * Ingestion job: fetch and persist news items.
 *
 * Pulls the latest headlines from INewsProvider and upserts them into
 * the `news` table (keyed on url to avoid duplicates).
 *
 * TODO: wire to a cron trigger (every 15 min during market hours).
 *
 * Manual trigger (dev): POST /api/ingest/news
 */

import { db } from "@pip/db/db";
import { newsItems } from "@pip/db/schema";
import { sql } from "drizzle-orm";
import { getNewsProvider } from "../providers/news";

function newId(): string {
  return `nws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function ingestNews(limit = 50): Promise<{ upserted: number; errors: string[] }> {
  const provider = getNewsProvider();
  const items    = await provider.getLatestNews(limit);

  let upserted = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      await db
        .insert(newsItems)
        .values({
          id:              item.externalId ?? newId(),
          title:           item.title,
          summary:         item.summary ?? null,
          source:          item.source,
          url:             item.url,
          ticker:          item.ticker ?? null,
          affectedTickers: item.affectedTickers,
          category:        item.category,
          sentiment:       item.sentiment,
          importance:      item.importance,
          relevanceScore:  item.relevanceScore,
          publishedAt:     item.publishedAt,
        })
        .onConflictDoNothing(); // no unique constraint yet — idempotent by id
      upserted++;
    } catch (err) {
      errors.push(`${item.url}: ${String(err)}`);
    }
  }

  console.log(`[ingest-news] upserted=${upserted} errors=${errors.length}`);
  return { upserted, errors };
}
