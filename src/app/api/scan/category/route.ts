import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import {
  CATEGORIES,
  isBusinessCategory,
  categoryLabel,
} from "@/lib/scan/categories";
import {
  completeScan,
  findLatestScanForDomain,
  getScanByToken,
  initScanSchema,
  setScanCategory,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { buildReport } from "@/lib/scan/report";
import { sendReportEmail } from "@/lib/scan/run";

/**
 * Re-scores an existing report against a different business type.
 *
 * For when somebody picked the wrong one at the form. The report they hold is
 * built from the wrong check set, and the honest fix is not to re-run the scan
 * — the scan data is fine, it was only ever scored against the wrong list. So
 * this reuses the stored `raw` payload and rebuilds from it, which means no
 * third-party call, no new token, and the correction lands on the URL they
 * already have.
 *
 * Behind the admin password. It rewrites a stored customer report and can send
 * mail, neither of which is something to leave open, and `isAdminAuthorised`
 * fails shut.
 *
 *   curl -u :$ADMIN_PASSWORD -X POST \
 *     ".../api/scan/category?domain=example.com&category=digital&email=1"
 *
 * Query parameters:
 *   token     the scan to re-score, from its report URL.
 *   domain    alternative to token: the most recent completed scan for a site.
 *             One of token or domain is required.
 *   category  required. One of the values in CATEGORIES.
 *   email     send the corrected report. OFF by default, because a re-score is
 *             usually us fixing our own mistake and a second identical-looking
 *             email is worse for the recipient than a quietly corrected page.
 *             Worth sending when the numbers actually moved, which for a
 *             category change they usually have.
 *   to        send to this address instead of the one that ran the scan. For
 *             the case where the person who needs the corrected report is not
 *             the address in the row.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rebuilding is local work, but the send is a round trip to Resend.
export const maxDuration = 30;

const VALUES = CATEGORIES.map((c) => c.value).join(", ");

/** Loose enough for an admin typing a domain, strict enough not to send mail to a typo. */
function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  const domainParam = params.get("domain")?.trim();
  const category = params.get("category")?.trim();
  const shouldEmail = params.get("email") === "1";
  const to = params.get("to")?.trim();

  if (!token && !domainParam) {
    return NextResponse.json(
      { error: "Pass ?token= from the report URL, or ?domain= for a site." },
      { status: 400 }
    );
  }
  if (!isBusinessCategory(category)) {
    return NextResponse.json(
      { error: `Pass ?category= as one of: ${VALUES}.` },
      { status: 400 }
    );
  }
  if (to && !validEmail(to)) {
    return NextResponse.json(
      { error: "?to= is not a valid email address." },
      { status: 400 }
    );
  }

  await initScanSchema();

  let scan;
  if (token) {
    scan = await getScanByToken(token);
  } else {
    const domain = normaliseDomain(domainParam!);
    if (!domain) {
      return NextResponse.json(
        { error: `Could not read "${domainParam}" as a domain.` },
        { status: 400 }
      );
    }
    scan = await findLatestScanForDomain(domain);
  }

  if (!scan) {
    return NextResponse.json(
      { error: "No completed scan found for that token or domain." },
      { status: 404 }
    );
  }
  // Without the raw payload there is nothing to re-score from, and rebuilding
  // would mean spending a scan. Say so rather than silently running one.
  if (!scan.raw) {
    return NextResponse.json(
      {
        error:
          "That scan has no stored raw payload, so it cannot be re-scored. Use /api/scan/refresh to re-run it.",
      },
      { status: 409 }
    );
  }

  const before = {
    category: scan.category,
    label: categoryLabel(scan.category),
    score: scan.score,
    grade: scan.grade,
  };
  const unchanged = scan.category === category;

  const report = buildReport(scan.raw, category);

  if (!unchanged) {
    // Column first, then the stored report. The page reads the column and
    // rebuilds from raw, so this ordering means the customer-visible fix lands
    // even if the write below fails.
    await setScanCategory(scan.id, category);
    await completeScan({
      id: scan.id,
      score: report.score,
      grade: report.grade,
      report,
      raw: scan.raw,
    });
  }

  let emailed: { ok: boolean; to?: string; reason?: string } | null = null;
  if (shouldEmail) {
    const recipient = to || scan.email;
    const sent = await sendReportEmail({
      ...scan,
      category,
      email: recipient,
      report,
    });
    emailed = sent.ok
      ? { ok: true, to: recipient }
      : { ok: false, to: recipient, reason: sent.reason };
  }

  return NextResponse.json({
    changed: !unchanged,
    ...(unchanged
      ? { note: `Already scored as ${categoryLabel(category)}; nothing was rewritten.` }
      : {}),
    domain: scan.domain,
    token: scan.token,
    reportUrl: `/scan/${scan.token}`,
    before,
    after: {
      category,
      label: categoryLabel(category),
      score: report.score,
      grade: report.grade,
    },
    findings: report.findings.map((f) => f.title),
    emailed,
  });
}
