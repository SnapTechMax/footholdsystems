import "server-only";
import { CHECK_COPY, isRelevant, tierWeight } from "./relevance";
import {
  categoryLabel,
  isCategoryExtra,
  type BusinessCategory,
} from "./categories";
import type {
  Grade,
  OraCheck,
  OraScan,
  ReportFinding,
  ScanReport,
} from "./types";

/**
 * Turns a raw Ora payload into the report a business owner reads.
 *
 * Three jobs: throw away the checks that don't apply to a non-software business
 * (see relevance.ts, which is where the reasoning lives), re-score against what
 * is left, and write the whole thing in English rather than in check names.
 *
 * The split between `problem` and `fix` on every finding is the paywall. The
 * free half says what is wrong and what it costs; the paid half says how to fix
 * it. That split is enforced here at build time so no downstream renderer has to
 * remember to do it.
 */

/** How many findings make it into the report. */
const MAX_FINDINGS = 8;

/**
 * Checks that only make sense when a parent check passed.
 *
 * Ora reports these independently, so a site with no llms.txt fails "llms.txt
 * exists", "llms.txt formatting" and "llms.txt links resolve" all at once, and
 * the report ends up telling someone their formatting is wrong on a file they
 * do not have. Same shape for structured data: with no JSON-LD at all, the
 * entity-linking, completeness and breadth checks each fail with their own
 * variation of "no JSON-LD found".
 *
 * When the parent is failing, the children are suppressed — the parent finding
 * already covers the work, and three restatements of one problem in a report
 * somebody paid for reads like padding, because it is.
 */
const DEPENDENT_CHECKS: Record<string, string> = {
  "llms-txt-formatting": "llms-txt-exists",
  "llms-txt-links-resolve": "llms-txt-exists",
  "json-ld-entity-linking": "json-ld",
  "org-schema-completeness": "json-ld",
  "schema-type-breadth": "json-ld",
  "sitemap-lastmod": "sitemap",
};

/**
 * Our score, not Ora's.
 *
 * Ora scores agent-readiness across everything it checks, so a local service
 * business is permanently capped well below 50 by work it will never do —
 * OpenAPI specs, MCP servers, SDK packages. Reporting that number would mean
 * telling someone they are at 20/100 and then selling them a fix list that
 * cannot move it, which is a refund waiting to happen.
 *
 * So we score the subset we actually assessed and can actually fix. `na` checks
 * are excluded from both halves of the fraction rather than counted as
 * failures: a check that did not apply is not a thing they got wrong. Bonus
 * checks are excluded because they cannot cost points by definition, and
 * including them in the denominator would make a perfect site score under 100.
 */
function scoreSubset(
  checks: OraCheck[],
  category: BusinessCategory
): { earned: number; available: number } {
  let earned = 0;
  let available = 0;
  for (const check of checks) {
    if (check.bonus || check.status === "error") continue;
    if (check.status === "na") {
      // See isCategoryExtra: unassessable is a failure when the reader declared
      // the category that asked for this check, and an exclusion otherwise.
      if (!isCategoryExtra(check.id, category)) continue;
      available += check.maxScore;
      continue;
    }
    earned += check.score;
    available += check.maxScore;
  }
  return { earned, available };
}

/**
 * Our own banding. Ora's grades are computed off its own score, so they don't
 * transfer.
 *
 * A, B, C, D, F — the American school scale, with no E, because that is the
 * scale the people reading this went through and a grade only works if it needs
 * no explanation.
 *
 * The bands are not the classic 90/80/70/60 either. Those are calibrated for a
 * test most people pass; this is calibrated for a population where almost
 * nobody has done any of the work yet, so a straight 60-point pass mark would
 * hand out an F to essentially every business we scan and stop discriminating
 * between "nearly there" and "not started".
 */
function gradeFor(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * The line that opens the email.
 *
 * Written to be true at every band. The temptation on a page selling a fix is
 * to tell everyone they are failing, but a business that genuinely scores well
 * and gets told it is invisible stops believing the rest of the report — and
 * they are the ones most likely to buy the $1,500 engagement.
 */
function verdictFor(grade: Grade, domain: string): string {
  switch (grade) {
    case "A":
      return `${domain} is in better shape than most. You are readable, and the gaps left are the ones your competitors haven't found either.`;
    case "B":
      return `${domain} reads clearly to an AI. What is missing is the detail that turns "this is a real business" into "this is the one to call".`;
    case "C":
      return `${domain} is half-visible. An AI can find you and read some of you, but it cannot confidently say what you do or who you are for.`;
    case "D":
      return `${domain} is mostly invisible to AI. Some of the basics are there. The parts that decide whether you get named are not.`;
    case "F":
      return `${domain} is effectively invisible. Right now, an AI asked to recommend a business like yours has almost nothing to go on.`;
  }
}

/**
 * The two or three sentences under the verdict.
 *
 * Leads with the count of required failures because that is the number people
 * react to, then names the single biggest one so the report proves it has
 * actually read their site rather than sending a template.
 */
function summaryFor(args: {
  grade: Grade;
  categoryLabel: string;
  domain: string;
  findings: ReportFinding[];
  requiredFailures: number;
  passed: number;
  assessed: number;
}): string {
  const { grade, findings, requiredFailures, passed, assessed } = args;

  if (findings.length === 0) {
    return `We checked ${assessed} things that decide whether an AI can find, read and recommend a business, and you passed all of them. That is rare. There is nothing here worth charging you for.`;
  }

  const worst = findings[0];
  const parts: string[] = [];

  parts.push(
    `We ran ${assessed} checks on the things that decide whether an AI assistant can find you, understand what you sell, and recommend you when someone asks, using the set that applies to a ${args.categoryLabel.toLowerCase()}. You passed ${passed}.`
  );

  if (requiredFailures > 0) {
    parts.push(
      `${requiredFailures} of the failures are in the group we treat as non-negotiable. Those are the ones that keep coming up when a business simply never appears in an answer.`
    );
  }

  parts.push(
    `The biggest single problem: ${worst.title.toLowerCase()}. ${worst.consequence}`
  );

  if (grade === "F") {
    parts.push(
      `None of this is unusual and none of it is hard to fix. It is just that nobody has ever been asked to look.`
    );
  }

  return parts.join(" ");
}

/**
 * Cleans Ora's `details` into something quotable.
 *
 * Ora writes details for engineers reading a dashboard, so they arrive with
 * trailing parentheticals, bare paths and the occasional unclosed bracket. This
 * is cosmetic only — it never changes the finding, just how it reads in an
 * email a customer paid for.
 */
function tidyDetails(details: string | undefined): string | null {
  if (!details) return null;
  let text = details.trim();
  // Ora truncates some details mid-parenthetical; drop a dangling opener.
  const open = text.lastIndexOf("(");
  if (open !== -1 && !text.includes(")", open)) text = text.slice(0, open).trim();
  text = text.replace(/\s+/g, " ");

  // Some of Ora's details run the observation and the recommendation together
  // in one string — "No Wikidata entity found for X - creating a Wikipedia page
  // is the highest-impact step...". The second half is the thing we sell, so
  // leaving it in the free report would give away the paid half for nothing.
  // Long details get cut at the clause boundary; short ones are observation
  // only and are kept whole.
  if (text.length > 120) {
    const boundary = text.search(/\s[-–—]\s/);
    if (boundary > 30) text = text.slice(0, boundary);
  }

  text = text.replace(/[\s,;:-]+$/, "");
  if (!text) return null;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function buildFinding(check: OraCheck, layerName: string): ReportFinding | null {
  const copy = CHECK_COPY[check.id];
  if (!copy) return null;

  const found = tidyDetails(check.details);

  return {
    checkId: check.id,
    title: copy.title,
    // What we found on their site, stated before the interpretation. Ora's own
    // observation is more convincing than our paraphrase of it, because it is
    // specific to them.
    problem: found ?? copy.title,
    consequence: copy.consequence,
    // Our wording where we have it; Ora's as the floor. Never empty — an empty
    // fix is the one thing the paid half cannot be.
    fix:
      copy.fix ??
      check.recommendation ??
      "Get in touch and we'll walk you through this one directly.",
    pointsBack: check.estScoreGain ?? 0,
    layer: layerName,
    tier: check.tier ?? "recommended",
    specUrl: check.specUrl,
  };
}

/**
 * Builds the report for one business category.
 *
 * The category decides which checks are scored and reported, which is the whole
 * point of asking for it: a local business assessed on the SaaS set is told to
 * ship an SDK, and a SaaS company assessed on the local set is congratulated for
 * having a sitemap while shipping no API spec. See categories.ts.
 */
export function buildReport(
  scan: OraScan,
  category: BusinessCategory
): ScanReport {
  const relevant: { check: OraCheck; layer: string }[] = [];
  for (const layer of scan.layers) {
    for (const check of layer.checks) {
      if (isRelevant(check.id, category)) {
        relevant.push({ check, layer: layer.name });
      }
    }
  }

  const checks = relevant.map((r) => r.check);
  const { earned, available } = scoreSubset(checks, category);
  // A site where every relevant check was `na` would divide by zero. Treat it
  // as unscoreable rather than as a perfect zero, which would be a lie.
  const score = available > 0 ? Math.round((earned / available) * 100) : 0;

  const failingIds = new Set(
    relevant
      .filter(
        ({ check }) =>
          check.status === "fail" ||
          check.status === "warning" ||
          (check.status === "na" &&
            !check.bonus &&
            isCategoryExtra(check.id, category))
      )
      .map(({ check }) => check.id)
  );

  const failing = relevant.filter(({ check }) => {
    const counts =
      check.status === "fail" ||
      check.status === "warning" ||
      // Same rule as the scoring: nothing found, for a check this category
      // explicitly asked for, is a finding rather than a non-applicable.
      (check.status === "na" &&
        !check.bonus &&
        isCategoryExtra(check.id, category));
    if (!counts) return false;
    const parent = DEPENDENT_CHECKS[check.id];
    return !(parent && failingIds.has(parent));
  });

  const findings = failing
    .map(({ check, layer }) => buildFinding(check, layer))
    .filter((f): f is ReportFinding => f !== null)
    .sort(
      (a, b) =>
        b.pointsBack * tierWeight(b.tier) - a.pointsBack * tierWeight(a.tier)
    )
    .slice(0, MAX_FINDINGS);

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter(
    (c) =>
      c.status === "fail" ||
      (c.status === "na" && !c.bonus && isCategoryExtra(c.id, category))
  ).length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  // Excludes `na` and `error`: we only claim to have assessed what we could.
  const assessed = passed + failed + warnings;
  const requiredFailures = failing.filter(
    ({ check }) => check.tier === "required"
  ).length;

  const grade = gradeFor(score);

  return {
    domain: scan.domain,
    score,
    maxScore: 100,
    grade,
    verdict: verdictFor(grade, scan.domain),
    summary: summaryFor({
      grade,
      categoryLabel: categoryLabel(category),
      domain: scan.domain,
      findings,
      requiredFailures,
      passed,
      assessed,
    }),
    findings,
    totals: {
      passed,
      failed,
      warnings,
      pointsAvailable:
        Math.round(findings.reduce((sum, f) => sum + f.pointsBack, 0) * 10) / 10,
    },
    // What we assessed against, not Ora's guess at the sector. The reader chose
    // this, and the report has to be able to say so: a score means nothing
    // without the set it was scored over.
    businessCategory: category,
    categoryLabel: categoryLabel(category),
    category: scan.category,
    scannedAt: scan.scannedAt ?? new Date().toISOString(),
    partial: scan.analysisStatus === "partial" || scan.analysisStatus === "stuck",
  };
}

/**
 * The free view of a report.
 *
 * Strips `fix` and `specUrl` — the paid half — before anything reaches an
 * unpaid client. This exists so the paywall is a data transformation rather
 * than a rendering convention: a component cannot forget to call it, because
 * what it returns has no fix text in it to leak.
 */
export type PublicFinding = Omit<ReportFinding, "fix" | "specUrl">;

export interface PublicReport extends Omit<ScanReport, "findings"> {
  findings: PublicFinding[];
}

export function toPublicReport(report: ScanReport): PublicReport {
  return {
    ...report,
    // Built field by field rather than by spreading and deleting. An explicit
    // allowlist means a new field added to ReportFinding is excluded by default
    // and has to be opted in — the safe direction for the type that carries the
    // thing we charge for.
    findings: report.findings.map((f) => ({
      checkId: f.checkId,
      title: f.title,
      problem: f.problem,
      consequence: f.consequence,
      pointsBack: f.pointsBack,
      layer: f.layer,
      tier: f.tier,
    })),
  };
}
