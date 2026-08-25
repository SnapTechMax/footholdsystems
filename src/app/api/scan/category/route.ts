import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorised } from "@/lib/admin-auth";
import {
  CATEGORIES,
  isBusinessCategory,
  categoryLabel,
} from "@/lib/scan/categories";
import {
  completeScan,
  getScanByToken,
  initScanSchema,
  setScanCategory,
} from "@/lib/scan/db";
import { buildReport } from "@/lib/scan/report";

/**
 * Re-scores an existing report against a different business type.
 *
 * For when somebody picked the wrong one at the form. The report they hold is
 * built from the wrong check set, and the honest fix is not to re-run the scan
 * — the scan data is fine, it was only ever scored against the wrong list. So
 * this reuses the stored `raw` payload and rebuilds from it, which means no
 * third-party call, no new token, no duplicate email, and the correction lands
 * on the URL they already have.
 *
 * Behind the admin password. It rewrites a stored customer report, which is not
 * something to leave open, and `isAdminAuthorised` fails shut.
 *
 *   curl -u :$ADMIN_PASSWORD -X POST \
 *     "https://www.footholdsystems.com/api/scan/category?token=TOKEN&category=digital"
 *
 * Query parameters:
 *   token     required. The scan to re-score, from its report URL.
 *   category  required. One of the values in CATEGORIES.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALUES = CATEGORIES.map((c) => c.value).join(", ");

export async function POST(request: NextRequest) {
  if (!isAdminAuthorised(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Foothold admin"' },
    });
  }

  const params = request.nextUrl.searchParams;
  const token = params.get("token")?.trim();
  const category = params.get("category")?.trim();

  if (!token) {
    return NextResponse.json(
      { error: "Pass ?token= from the report URL." },
      { status: 400 }
    );
  }
  if (!isBusinessCategory(category)) {
    return NextResponse.json(
      { error: `Pass ?category= as one of: ${VALUES}.` },
      { status: 400 }
    );
  }

  await initScanSchema();

  const scan = await getScanByToken(token);
  if (!scan) {
    return NextResponse.json({ error: "No scan for that token." }, { status: 404 });
  }
  if (scan.category === category) {
    return NextResponse.json({
      changed: false,
      reason: `Already scored as ${categoryLabel(category)}.`,
      domain: scan.domain,
    });
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

  const report = buildReport(scan.raw, category);

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

  return NextResponse.json({
    changed: true,
    domain: scan.domain,
    before,
    after: {
      category,
      label: categoryLabel(category),
      score: report.score,
      grade: report.grade,
    },
    findings: report.findings.map((f) => f.title),
    note: "The report page rebuilds from raw, so the existing URL is already correct. No email was sent.",
  });
}
