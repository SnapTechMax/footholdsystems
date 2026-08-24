import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  createScan,
  initScanSchema,
  recentScanCountForIp,
  scansStartedToday,
  upsertLead,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { runScanJob } from "@/lib/scan/run";
import { ScanRequestSchema } from "@/lib/scan/schema";
import { CONSENT_TEXT } from "@/lib/site";
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
 * Per-IP ceiling for an hour.
 *
 * Ora allows 30 scans per rolling 24 hours across our entire deployment, since
 * Vercel presents one outbound IP. So this is not really abuse protection — it
 * is making sure one person cannot take the feature away from everybody else
 * for the rest of the day.
 */
const MAX_SCANS_PER_IP_PER_HOUR = 3;

/** Leaves headroom under Ora's 30/day so a burst never hits a hard 429. */
const DAILY_SCAN_BUDGET = 25;

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
      ipAddress: ip,
    });

    // Already scanned this domain today — hand back the existing report rather
    // than spending another slot on an answer we have.
    if (!scan.reused) {
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
          "Something went wrong on our end. Try again in a moment. If it keeps happening, email max@footholdsystems.com and we'll run it by hand.",
      },
      { status: 500 }
    );
  }
}
