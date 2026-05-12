import { Resend } from "resend";

// ─── Client ───────────────────────────────────────────────────────────────────
//
// Guard: Resend throws synchronously if the key is missing.
// Returns null when unconfigured so callers can skip gracefully.
// Same pattern as posthog.ts.

function createResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const _client = createResend();

// ─── Sender address ───────────────────────────────────────────────────────────
//
// EMAIL_FROM must be a verified sender in your Resend dashboard.
// For local testing use:  onboarding@resend.dev  (no verification needed)
// For production use:     noreply@yourdomain.com  (requires domain DNS setup)

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Portfolio Intelligence <onboarding@resend.dev>";

// ─── Send helper ──────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to:      string | string[];
  subject: string;
  html:    string;
  /** Optional plain-text fallback */
  text?:   string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  if (!_client) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send.");
    return { error: "Email not configured." };
  }

  const { data, error } = await _client.emails.send({
    from:    EMAIL_FROM,
    to:      Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { error: error.message };
  }

  return { id: data?.id };
}
