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
import { sendLead } from "@/lib/meta-capi";
import { sendPush } from "@/lib/notify";
import { normaliseDomain } from "@/lib/scan/domain";
import { runScanJob } from "@/lib/scan/run";
import { ScanRequestSchema } from "@/lib/scan/schema";
import { subscribeToSequence } from "@/lib/subscribe";
import { siteUrl } from "@/lib/scan/pricing";
import { CONSENT_TEXT, CONTACT_EMAIL } from "@/lib/site";
import { HONEYPOT_FIELD, MIN_FILL_MS } from "@/lib/spam";

/**
 * Free-scan capture.
 *
 * Responds as soon as the row is written and runs the scan in `after()`, so the
 * visitor never waits on the crawl. A scan takes three to ten seconds on the
 * sites we tested, which is survivable but not something to put in front of
 * paid traffic — and `after()` also means a slow scan cannot turn into a failed
 * form submission.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The scanner's own deadline is 75s (lib/scan/scanner); this has to outlast it
// or `after()` gets killed mid-scan and the sweeper has to redo the work.
export const maxDuration = 90;

/**
 * Per-IP ceiling for an hour. Genuine abuse protection: one person refreshing
 * the form should not be able to occupy the burst allowance below.
 */
const MAX_SCANS_PER_IP_PER_HOUR = 3;

/**
 * Scans a minute, across everybody, before we stop running them inline.
 *
 * Each scan is forty-odd requests at somebody's website plus two web searches,
 * and the searches go out from one shared IP through one queue (see
 * lib/scan/scanner/search.ts). Eight a minute keeps the request path and the
 * sweeper, which scans on the same allowance, from stacking dozens of
 * concurrent crawls on one deployment or rate-limiting the search into
 * `error` statuses.
 *
 * EXCEEDING THIS DOES NOT REJECT ANYONE. The row is still written and the
 * visitor still gets the same "we're scanning" page; only the inline run is
 * skipped, and the sweeper picks the row up within ten minutes. Turning a
 * traffic spike into an error page would mean paying for a click and then
 * refusing the lead, which is the worst possible response to being popular.
 */
const MAX_SCANS_PER_MINUTE = 8;

/**
 * Public scans a day before we stop running them inline.
 *
 * A cost ceiling on crawling, and — like MAX_SCANS_PER_MINUTE and for the same
 * reason — NOT A REJECTION. Over this the lead is still captured, the row is
 * still written, the visitor still gets the same "we're scanning" page, and
 * only the inline run is skipped; the sweeper picks the row up on its own
 * pacing.
 *
 * This used to answer over-budget with a 503 reading "we've hit today's scan
 * limit, try again tomorrow", and on 2026-09-10 that is exactly what every
 * visitor on the homepage got. Note what that costs, because it is the whole
 * argument for the change: the check sits ahead of `upsertLead`, so a refused
 * submission wrote no lead row, stored no consent record, enrolled nobody in
 * the sequence and fired no Lead conversion. We paid for the click and then
 * discarded the person — not degraded, discarded. A cost ceiling is not worth
 * one lead, and this one was silently costing all of them.
 *
 * Counts public scans only. Cold outbound has its own pacing and must never be
 * able to close the public form: see the note at the top of
 * /api/outreach/scan, which says the public form is "the thing that must not be
 * starved for cold outbound", and see scansStartedToday in lib/scan/db.ts.
 */
const DAILY_SCAN_BUDGET = 500;

/**
 * The point at which this stops being a busy day and starts being an incident.
 *
 * The only thing here that still refuses a visitor, and it is deliberately far
 * enough above DAILY_SCAN_BUDGET that ordinary success can never reach it: four
 * times a day we have never had. Reaching it means a loop, a scraper past the
 * per-IP throttle, or something else genuinely wrong, and at that volume the
 * crawling is a real cost incident rather than a good problem.
 *
 * Rejecting is a poor answer even here — it is just the least bad one, since
 * queueing without limit would leave the sweeper grinding through junk rows for
 * days. That is why crossing it pushes a phone notification: the fix is a human
 * looking, not a ceiling.
 */
const DAILY_SCAN_HARD_STOP = 2000;

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

    // Both read before the row is written, so this request is not counting
    // itself. Neither one turns anybody away below DAILY_SCAN_HARD_STOP; they
    // decide whether the scan runs on this invocation or waits for the sweeper.
    const [dayCount, burstCount] = await Promise.all([
      scansStartedToday(),
      scansStartedInLastMinute(),
    ]);

    if (dayCount >= DAILY_SCAN_HARD_STOP) {
      console.error(
        `[scan] ${dayCount} public scans in 24h, past the ${DAILY_SCAN_HARD_STOP} hard stop — refusing new scans until someone looks.`
      );
      // Best effort and deliberately not awaited into the response path: an
      // alert that could not send must not also cost us the answer.
      after(async () => {
        await sendPush({
          title: "FootHold: scan hard stop",
          message:
            `${dayCount} public scans in the last 24h, past the ${DAILY_SCAN_HARD_STOP} limit. ` +
            "The form is now refusing visitors. Something is looping or scraping.",
          url: `${siteUrl()}/admin`,
          urlTitle: "Open admin",
          priority: 1,
        });
      });
      return NextResponse.json(
        {
          error:
            "We've hit today's scan limit. This is running hotter than expected. Try again tomorrow and it'll go straight through.",
        },
        { status: 503 }
      );
    }

    const overDailyBudget = dayCount >= DAILY_SCAN_BUDGET;
    if (overDailyBudget) {
      console.warn(
        `[scan] ${dayCount} public scans in 24h, over the ${DAILY_SCAN_BUDGET} inline budget — leaving this one for the sweeper.`
      );
    }

    const leadId = await upsertLead({
      email: data.email,
      // The wording actually shown, not the constant, when the client sends it.
      // If they ever drift, the record has to reflect what was on screen.
      consentText: data.consentText?.trim() || CONSENT_TEXT,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
      attribution: cleanAttribution(data.attribution),
      // Stored, not just used below. This is the only moment we are guaranteed
      // to see these cookies — the visitor is in the browser that clicked the
      // ad. ReportOpened fires later from an emailed link, often on another
      // device, and without these kept it would have nothing but a hashed
      // email to match on.
      fbp: request.cookies.get("_fbp")?.value ?? null,
      fbc: request.cookies.get("_fbc")?.value ?? null,
    });

    const scan = await createScan({
      leadId,
      domain,
      url: `https://${domain}`,
      category: data.category,
      ipAddress: ip,
    });

    // The server half of the Lead conversion. The browser fires the same event
    // with the same id, and Meta collapses the pair — see meta-event-id.ts.
    // This half is the one that survives an ad blocker, which is a meaningful
    // share of paid traffic and exactly the share you cannot afford to be blind
    // to while optimising delivery against it.
    //
    // Not sent for a reused scan: that is the same person asking again, and the
    // lead was already reported the first time.
    if (!scan.reused) {
      after(async () => {
        await sendLead({
          token: scan.token,
          email: data.email,
          ip,
          userAgent: request.headers.get("user-agent"),
          // Meta's own cookies, when the browser had them. They are what lifts
          // match quality above an email hash alone.
          fbp: request.cookies.get("_fbp")?.value ?? null,
          fbc: request.cookies.get("_fbc")?.value ?? null,
          sourceUrl: request.headers.get("referer") ?? undefined,
          category: data.category,
        });
      });
    }

    // Enrolment and the scan are two independent background jobs, deliberately
    // not chained. The sequence should start whether or not the scan succeeds, and
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
    // The two ceilings are the other reasons to skip: over the per-minute
    // allowance, or over the day's inline budget, the row is left queued for
    // the sweeper instead of running now. The customer-facing response is
    // identical in all three cases, because from their side it is — the report
    // was always going to arrive by email rather than on this page.
    const overBurst = burstCount >= MAX_SCANS_PER_MINUTE;
    if (overBurst) {
      console.warn(
        `[scan] ${burstCount} scans in the last minute, over the ${MAX_SCANS_PER_MINUTE} inline limit — leaving ${scan.id} for the sweeper.`
      );
    }
    if (!scan.reused && !overBurst && !overDailyBudget) {
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
