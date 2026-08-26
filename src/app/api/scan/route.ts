import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { Resend } from "resend";
import {
  createScan,
  initScanSchema,
  recentScanCountForIp,
  scansStartedInLastMinute,
  scansStartedToday,
  upsertLead,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { runScanJob } from "@/lib/scan/run";
import { ScanRequestSchema } from "@/lib/scan/schema";
import { subscribeToSequence } from "@/lib/subscribe";
import { CONSENT_TEXT, CONTACT_EMAIL } from "@/lib/site";
import { HONEYPOT_FIELD, MIN_FILL_MS } from "@/lib/spam";

/**
 * Free-scan capture.
 *
 * Responds as soon as the row is written and runs the scan in `after()`, so the
 * visitor never waits on a third-party call. Ora took about six seconds on the
 * sites we tested, which is survivable but not something to put in front of
 * paid traffic — and `after()` also means a slow scan cannot turn into a failed
 * form submission.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ora's own timeout is 60s; this has to outlast it or `after()` gets killed
// mid-scan and the sweeper has to redo the work.
export const maxDuration = 90;

/**
 * Per-IP ceiling for an hour. Genuine abuse protection: one person refreshing
 * the form should not be able to occupy the burst allowance below.
 */
const MAX_SCANS_PER_IP_PER_HOUR = 3;

/**
 * Scans a minute, across everybody, before we stop running them inline.
 *
 * This is the only limit that reflects something real. Scans go through Is
 * Agentic, which allows 10 a minute per IP and Vercel gives us one outbound IP,
 * so ten a minute is the whole deployment's allowance. Eight leaves room for
 * the sweeper, which is scanning on the same allowance.
 *
 * EXCEEDING THIS DOES NOT REJECT ANYONE. The row is still written and the
 * visitor still gets the same "we're scanning" page; only the inline run is
 * skipped, and the sweeper picks the row up within ten minutes. Turning a
 * traffic spike into an error page would mean paying for a click and then
 * refusing the lead, which is the worst possible response to being popular.
 */
const MAX_SCANS_PER_MINUTE = 8;

/**
 * Absolute daily ceiling. A backstop against a runaway loop or a scraper, not
 * a quota.
 *
 * It used to be 25, sized to stay under Ora's 30-per-day — which is the limit
 * the scan pipeline no longer runs against. Left at that value it would have
 * capped a whole day's advertising at twenty-five leads and shown everyone
 * after that a "try again tomorrow" page. Now it sits far above any plausible
 * day so it only ever fires on something genuinely wrong.
 */
const DAILY_SCAN_BUDGET = 500;

/**
 * Resend client for the enrolment call.
 *
 * Built per request rather than at module scope so that an unset key surfaces
 * as an enrolment note inside the try, instead of throwing while the module is
 * being evaluated and taking the whole capture route down with it.
 */
function resendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/** Keeps only the campaign keys we care about, capped, so this can't be a payload. */
function cleanAttribution(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object") return null;
  const allowed = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "referrer",
    "landing_page",
  ];
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim().slice(0, 300);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "That request didn't arrive in one piece. Please try again." },
      { status: 400 }
    );
  }

  const parsed = ScanRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path[0];
    return NextResponse.json(
      {
        error: issue?.message ?? "Please check the form and try again.",
        field:
          path === "url" || path === "email" || path === "consent"
            ? path
            : undefined,
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
    return NextResponse.json({ ok: true, queued: true });
  }

  const domain = normaliseDomain(data.url);
  if (!domain) {
    return NextResponse.json(
      {
        error:
          "We couldn't read that as a website address. Try it like yourbusiness.com",
        field: "url",
      },
      { status: 400 }
    );
  }

  const ip = clientIp(request);

  try {
    await initScanSchema();

    if (ip) {
      const recent = await recentScanCountForIp(ip);
      if (recent >= MAX_SCANS_PER_IP_PER_HOUR) {
        return NextResponse.json(
          {
            error:
              "That's a few scans in a short window. Give it an hour and we'll run another.",
            field: "url",
          },
          { status: 429 }
        );
      }
    }

    // Checked before the row is written, so a full day doesn't leave rows that
    // will never be processed.
    if ((await scansStartedToday()) >= DAILY_SCAN_BUDGET) {
      return NextResponse.json(
        {
          error:
            "We've hit today's scan limit. This is running hotter than expected. Try again tomorrow and it'll go straight through.",
        },
        { status: 503 }
      );
    }

    // Read before the row is written, so this request is not counting itself.
    const burstCount = await scansStartedInLastMinute();

    const leadId = await upsertLead({
      email: data.email,
      // The wording actually shown, not the constant, when the client sends it.
      // If they ever drift, the record has to reflect what was on screen.
      consentText: data.consentText?.trim() || CONSENT_TEXT,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
      attribution: cleanAttribution(data.attribution),
    });

    const scan = await createScan({
      leadId,
      domain,
      url: `https://${domain}`,
      category: data.category,
      ipAddress: ip,
    });

    // Enrolment and the scan are two independent background jobs, deliberately
    // not chained. The sequence should start whether or not Ora cooperates, and
    // a scan should still run if Resend is having a bad day.
    //
    // Enrolment runs even on a reused scan. `subscribeToSequence` treats an
    // already-present contact as success, and the automation's own trigger
    // handles someone who is already enrolled, so a repeat request is a no-op
    // rather than a double enrolment.
    after(async () => {
      try {
        const result = await subscribeToSequence(resendClient(), {
          email: data.email,
          source: `ai-visibility-scan:${data.category}:${domain}`,
        });
        if (result.notes.length > 0) {
          // Never thrown. The scan is already accepted and a failure to enrol
          // must not become an error for the person who asked for it, but a
          // silent one would mean a sequence quietly stops enrolling anybody.
          console.warn("[scan] enrolment notes:", result.notes.join("; "));
        }
      } catch (error) {
        console.error("[scan] enrolment failed:", error);
      }
    });

    // Already scanned this domain today — hand back the existing report rather
    // than spending another slot on an answer we have.
    //
    // The burst check is the other reason to skip: over the per-minute
    // allowance, the row is left queued for the sweeper instead of running now
    // and getting a 429 from the provider. The customer-facing response is
    // identical either way, because from their side it is — the report was
    // always going to arrive by email rather than on this page.
    const overBurst = burstCount >= MAX_SCANS_PER_MINUTE;
    if (overBurst) {
      console.warn(
        `[scan] ${burstCount} scans in the last minute, over the ${MAX_SCANS_PER_MINUTE} inline limit — leaving ${scan.id} for the sweeper.`
      );
    }
    if (!scan.reused && !overBurst) {
      after(async () => {
        try {
          await runScanJob(scan.id);
        } catch (error) {
          // after() failures are invisible to the client by definition. The
          // sweeper is what actually recovers this; the log is for us.
          console.error(`[scan] background run failed for ${scan.id}:`, error);
        }
      });
    }

    return NextResponse.json({
      ok: true,
      queued: !scan.reused,
      token: scan.token,
      domain,
    });
  } catch (error) {
    console.error("[scan] capture failed:", error);
    return NextResponse.json(
      {
        error:
          `Something went wrong on our end. Try again in a moment. If it keeps happening, email ${CONTACT_EMAIL} and we'll run it by hand.`,
      },
      { status: 500 }
    );
  }
}
