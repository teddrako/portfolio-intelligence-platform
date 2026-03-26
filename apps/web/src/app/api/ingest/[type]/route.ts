/**
 * Manual ingestion trigger — dev/ops use only.
 *
 * POST /api/ingest/prices    → runs ingest-prices job
 * POST /api/ingest/news      → runs ingest-news job
 * POST /api/ingest/calendar  → runs ingest-calendar job
 *
 * Protected by the INGEST_SECRET env var (Bearer token).
 * In production, wire these to Vercel Cron or a GitHub Actions schedule instead.
 *
 * Example:
 *   curl -X POST http://localhost:3000/api/ingest/prices \
 *        -H "Authorization: Bearer <INGEST_SECRET>"
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function authorized(req: NextRequest): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return process.env.NODE_ENV === "development"; // allow in dev without secret
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  try {
    switch (type) {
      case "prices": {
        const { ingestPrices } = await import("@pip/api/jobs/ingest-prices");
        const result = await ingestPrices();
        return NextResponse.json({ ok: true, type, ...result });
      }
      case "news": {
        const { ingestNews } = await import("@pip/api/jobs/ingest-news");
        const result = await ingestNews();
        return NextResponse.json({ ok: true, type, ...result });
      }
      case "calendar": {
        const { ingestCalendar } = await import("@pip/api/jobs/ingest-calendar");
        const result = await ingestCalendar();
        return NextResponse.json({ ok: true, type, ...result });
      }
      default:
        return NextResponse.json({ error: `Unknown ingest type: ${type}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`[ingest/${type}]`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
