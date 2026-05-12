import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@pip/auth/server";
import { sendEmail } from "@pip/api/email";
import { dailyCloseReadyEmail } from "@pip/api/emails/daily-close-ready";

// ─── GET /api/email/test ───────────────────────────────────────────────────────
//
// Quick smoke-test for Resend configuration.
// Must be signed in. Sends a test email to the authenticated user's address.
// Optional query param: ?to=other@example.com to override recipient.
//
// Usage: curl http://localhost:3000/api/email/test  (with session cookie)

export async function GET(request: Request) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("to") ?? session.user.email;

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });

  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  const { subject, html, text } = dailyCloseReadyEmail({
    userName:    session.user.name ?? "Investor",
    reportTitle: `Daily Close — ${dateStr} (TEST)`,
    reportUrl:   `${appUrl}/reports`,
    dateStr,
    preview:
      "This is a test email from Portfolio Intelligence. If you received this, Resend is configured correctly.",
  });

  const result = await sendEmail({ to: recipient, subject, html, text });

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok:        true,
    messageId: result.id,
    to:        recipient,
    subject,
  });
}
