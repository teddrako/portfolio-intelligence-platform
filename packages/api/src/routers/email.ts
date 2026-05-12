import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@pip/db/db";
import { users } from "@pip/db/schema";
import { sendEmail } from "../lib/email";
import { dailyCloseReadyEmail } from "../emails/daily-close-ready";

// ─── Router ───────────────────────────────────────────────────────────────────

export const emailRouter = router({
  /**
   * Send a test "Daily Close Ready" email to the authenticated user's address.
   * Useful for verifying Resend config and template rendering.
   */
  sendTest: protectedProcedure
    .input(
      z.object({
        /** Override the recipient for testing — defaults to the signed-in user's email. */
        to: z.string().email().optional(),
      }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up the user's email from the DB
      const rows = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      const user = rows[0];
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const recipient = input?.to ?? user.email;
      const dateStr   = new Date().toLocaleDateString("en-US", {
        month: "long",
        day:   "numeric",
        year:  "numeric",
      });
      const appUrl    = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

      const { subject, html, text } = dailyCloseReadyEmail({
        userName:    user.name,
        reportTitle: `Daily Close — ${dateStr}`,
        reportUrl:   `${appUrl}/reports`,
        dateStr,
        preview:
          "Markets closed mixed today. Your portfolio positioning and key levels to watch are summarised below.",
      });

      const result = await sendEmail({ to: recipient, subject, html, text });

      if (result.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${result.error}`,
        });
      }

      return { sent: true, to: recipient, messageId: result.id };
    }),

  /**
   * Send a "Daily Close Ready" notification email for a specific completed report.
   * Called internally after a successful daily_close generation.
   */
  notifyDailyClose: protectedProcedure
    .input(
      z.object({
        reportId:    z.string(),
        reportTitle: z.string(),
        preview:     z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      const user = rows[0];
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const dateStr = new Date().toLocaleDateString("en-US", {
        month: "long",
        day:   "numeric",
        year:  "numeric",
      });
      const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

      const { subject, html, text } = dailyCloseReadyEmail({
        userName:    user.name,
        reportTitle: input.reportTitle,
        reportUrl:   `${appUrl}/reports`,
        dateStr,
        preview:     input.preview,
      });

      const result = await sendEmail({ to: user.email, subject, html, text });
      return { sent: !result.error, messageId: result.id };
    }),
});
