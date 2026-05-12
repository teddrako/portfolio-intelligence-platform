// ─── Daily Close Report Ready ─────────────────────────────────────────────────
//
// Plain inline-styled HTML — compatible with Gmail, Outlook, Apple Mail.
// No external CSS or images (avoids blocking in Outlook).

export interface DailyCloseReadyEmailProps {
  userName:   string;
  reportTitle: string;
  reportUrl:  string;
  /** e.g. "March 26, 2026" */
  dateStr:    string;
  /** Optional one-line teaser pulled from the report content */
  preview?:   string;
}

export function dailyCloseReadyEmail(props: DailyCloseReadyEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, reportTitle, reportUrl, dateStr, preview } = props;

  const subject = `Your Daily Close is ready — ${dateStr}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f1117;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Logo / brand bar -->
          <tr>
            <td style="padding-bottom:28px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);width:36px;height:36px;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:18px;font-weight:700;line-height:36px;">◆</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#e2e8f0;font-size:15px;font-weight:600;letter-spacing:-0.3px;">Portfolio Intelligence</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#161b27;border:1px solid #1e2738;border-radius:16px;padding:32px;">

              <!-- Date chip -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;background-color:#1e2738;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:6px;">${dateStr}</span>
              </div>

              <!-- Heading -->
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.3;letter-spacing:-0.5px;">
                Your Daily Close is ready
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;line-height:1.5;">
                Hi ${userName} — your AI-generated market brief for today has been compiled.
              </p>

              ${preview ? `
              <!-- Preview teaser -->
              <div style="background-color:#0f1117;border-left:3px solid #4f46e5;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;font-style:italic;">${preview}</p>
              </div>
              ` : ""}

              <!-- Report title pill -->
              <div style="background-color:#1e2738;border-radius:10px;padding:14px 16px;margin-bottom:28px;">
                <p style="margin:0 0 2px 0;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">Report</p>
                <p style="margin:0;font-size:14px;font-weight:600;color:#e2e8f0;">${reportTitle}</p>
              </div>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${reportUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      View Report →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:11px;color:#334155;line-height:1.6;">
                You're receiving this because you generated a Daily Close report.<br/>
                <a href="${reportUrl}" style="color:#475569;text-decoration:underline;">Manage notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  const text = `Your Daily Close is ready — ${dateStr}

Hi ${userName},

Your AI-generated Daily Close report for ${dateStr} is ready to view.

Report: ${reportTitle}
${preview ? `\nSummary: ${preview}\n` : ""}
View it here: ${reportUrl}

—
Portfolio Intelligence
`;

  return { subject, html, text };
}
