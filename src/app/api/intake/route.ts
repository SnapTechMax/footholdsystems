import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { Resend } from "resend";
import { contractUrl } from "@/lib/intake/contract";
import {
  createIntake,
  initIntakeSchema,
  markIntakeNotified,
  recentIntakeCountForIp,
} from "@/lib/intake/db";
import {
  buildIntakeConfirmation,
  buildIntakeNotification,
} from "@/lib/intake/email";
import { INTAKE_DECLARATION, IntakeRequestSchema } from "@/lib/intake/questions";
import { getScanByToken } from "@/lib/scan/db";
import { reportUrl, siteUrl } from "@/lib/scan/pricing";
import { CONTACT_EMAIL } from "@/lib/site";
import { HONEYPOT_FIELD, MIN_FILL_MS } from "@/lib/spam";

/**
 * Build intake capture.
 *
 * The row is written before either email is attempted, and the response goes
 * back as soon as it is. A customer who has just spent twenty minutes on this
 * form must never see it fail because Resend was slow, and the answers are the
 * thing that has to survive: an email that did not send is recoverable from
 * /admin/intake, an answer that was never stored is gone and has to be asked
 * for again.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Submissions from one IP in an hour.
 *
 * Higher than the scan form's ceiling because the failure modes differ. Nobody
 * fills this in on a whim, and a real customer redoing it after realising they
 * got something wrong is a likely and completely legitimate use — several rows
 * from one address is normal here in a way it is not on a lead form.
 */
const MAX_INTAKES_PER_IP_PER_HOUR = 8;

/** Verified sender. Same reasoning as run.ts: this is not the reply-to address. */
const FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL || "maximilian@footholdsystems.com";
const BRAND = "FootHold AEO";

/** Where the notification lands. */
function notifyTo(): string {
  return process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL;
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "That didn't arrive in one piece. Please try sending it again." },
      { status: 400 }
    );
  }

  const parsed = IntakeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Path is ["answers", "<field name>"] for anything in the questionnaire,
    // which is what lets the form put the message under the right box and
    // scroll to it rather than showing a banner at the bottom of a long page.
    const field =
      issue?.path[0] === "answers" && typeof issue.path[1] === "string"
        ? issue.path[1]
        : issue?.path[0] === "declaration"
          ? "declaration"
          : undefined;

    return NextResponse.json(
      {
        error: issue?.message ?? "Please check the form and try again.",
        field,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Bots, quietly. A 200 with a plausible body: telling a script it was caught
  // just teaches whoever wrote it to fix the tell.
  const honeypotValue =
    (payload as Record<string, unknown>)?.[HONEYPOT_FIELD] ?? data.honeypot;
  const tooFast =
    typeof data.elapsedMs === "number" && data.elapsedMs < MIN_FILL_MS;
  if ((typeof honeypotValue === "string" && honeypotValue.trim()) || tooFast) {
    return NextResponse.json({ ok: true, received: true });
  }

  const ip = clientIp(request);

  try {
    await initIntakeSchema();

    if (ip) {
      const recent = await recentIntakeCountForIp(ip);
      if (recent >= MAX_INTAKES_PER_IP_PER_HOUR) {
        return NextResponse.json(
          {
            error:
              "That's several submissions in a short window. We have the earlier ones. Email us instead if something needs changing.",
          },
          { status: 429 }
        );
      }
    }

    const scanToken = data.scanToken?.trim() || null;

    const intake = await createIntake({
      answers: data.answers,
      // The wording actually shown, when the client sends it. If the constant
      // and the rendered sentence ever drift, the record has to reflect what
      // was on the screen rather than what is in the source today.
      declarationText: data.declarationText?.trim() || INTAKE_DECLARATION,
      scanToken,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    /**
     * Both emails, in the background and independently.
     *
     * Not chained: the notification must go out whether or not the customer's
     * address accepts mail, and the customer's confirmation is what carries the
     * link they need to sign, so neither is allowed to be blocked by the other
     * failing.
     */
    after(async () => {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error(
          `[intake] ${intake.token} stored but RESEND_API_KEY is unset — no email sent. Read it at /admin/intake.`
        );
        return;
      }
      const resend = new Resend(apiKey);

      // A scan link is a convenience, never a reason to fail. The token may be
      // stale, from another environment, or nonsense somebody pasted.
      let scanUrl: string | null = null;
      if (scanToken) {
        const scan = await getScanByToken(scanToken).catch(() => null);
        if (scan) scanUrl = reportUrl(scan.token);
      }

      const notification = buildIntakeNotification({
        answers: data.answers,
        submittedAt: intake.createdAt,
        declarationText: intake.declarationText,
        scanUrl,
        adminUrl: `${siteUrl()}/admin/intake`,
      });

      try {
        const { error } = await resend.emails.send({
          from: `${BRAND} <${FROM_EMAIL}>`,
          to: [notifyTo()],
          // So hitting reply goes to the customer rather than to ourselves.
          replyTo: intake.email || CONTACT_EMAIL,
          subject: notification.subject,
          html: notification.html,
          text: notification.text,
        });
        if (error) {
          console.error(`[intake] notification failed for ${intake.token}:`, error);
        } else {
          await markIntakeNotified(intake.id);
        }
      } catch (error) {
        console.error(`[intake] notification threw for ${intake.token}:`, error);
      }

      if (!intake.email) return;

      const confirmation = buildIntakeConfirmation({
        answers: data.answers,
        contractUrl: contractUrl(),
      });

      try {
        const { error } = await resend.emails.send({
          from: `${BRAND} <${FROM_EMAIL}>`,
          to: [intake.email],
          replyTo: CONTACT_EMAIL,
          subject: confirmation.subject,
          html: confirmation.html,
          text: confirmation.text,
        });
        if (error) {
          console.error(`[intake] confirmation failed for ${intake.token}:`, error);
        }
      } catch (error) {
        console.error(`[intake] confirmation threw for ${intake.token}:`, error);
      }
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    console.error("[intake] submission failed:", error);
    return NextResponse.json(
      {
        error:
          "Something broke on our end and your answers did not save. Nothing you typed is lost if you leave this page open. Try again in a minute, and if it fails twice email us and we will take it that way.",
      },
      { status: 500 }
    );
  }
}
