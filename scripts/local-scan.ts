import { categoryLabel, DEFAULT_CATEGORY, isBusinessCategory } from "../src/lib/scan/categories";
import { scanDomain } from "../src/lib/scan/scanner";
import { CHECKS } from "../src/lib/scan/scanner/catalog";
import { normaliseDomain } from "../src/lib/scan/domain";
import { buildReport } from "../src/lib/scan/report";

/**
 * Runs the local scanner against one domain and prints what it saw, then the
 * report that would be built from it.
 *
 *   npm run scan:local -- example.com            # Local Services report
 *   npm run scan:local -- example.com saas       # scored as a platform
 *   npm run scan:local -- example.com --json     # the raw ScanPayload payload
 *
 * This is the way to check the scanner against a site whose Ora score is
 * known: run both, compare check by check. The raw payload is exactly what
 * would be stored in the scans table's `raw` column.
 */

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter((a) => !a.startsWith("--"));
const domain = normaliseDomain(positional[0] ?? "");
if (!domain) {
  console.error("Usage: npm run scan:local -- <domain> [sbo|digital|ecommerce|saas|app] [--json]");
  process.exit(2);
}
const category = isBusinessCategory(positional[1]) ? positional[1] : DEFAULT_CATEGORY;

const STATUS_MARK: Record<string, string> = {
  pass: "✓",
  warning: "~",
  fail: "✗",
  na: "–",
  error: "!",
};

const scan = await scanDomain(domain);

if (json) {
  console.log(JSON.stringify(scan, null, 2));
  process.exit(0);
}

console.log(`\n${scan.domain}  →  ${scan.finalUrl}`);
console.log(`Local raw score ${scan.score}/100 (${scan.grade}), ${scan.layers.reduce((n, l) => n + l.checks.length, 0)} checks in ${((scan.durationMs ?? 0) / 1000).toFixed(1)}s\n`);

for (const layer of scan.layers) {
  console.log(`## ${layer.name}  ${layer.score}/${layer.maxScore}`);
  for (const check of layer.checks) {
    const def = CHECKS.find((c) => c.id === check.id);
    const flag = def?.bonus ? " (bonus)" : "";
    console.log(
      `  ${STATUS_MARK[check.status] ?? "?"} ${check.id.padEnd(28)} ${String(check.score).padStart(3)}/${String(check.maxScore).padEnd(2)} ${check.status.padEnd(7)}${flag}`
    );
    console.log(`      ${check.details ?? ""}`);
  }
  console.log();
}

const report = buildReport(scan, category);
console.log(`════ Report as ${categoryLabel(category)} ════`);
console.log(`Score ${report.score}/100, grade ${report.grade}${report.gradeCappedBecause ? ` (capped: ${report.gradeCappedBecause})` : ""}`);
console.log(`Passed ${report.totals.passed}, failed ${report.totals.failed}, warnings ${report.totals.warnings}, ${report.totals.pointsAvailable} points recoverable\n`);
console.log(report.verdict);
console.log();
console.log(report.summary);
console.log();
report.findings.forEach((f, i) => {
  console.log(`${i + 1}. [${f.tier}] ${f.title}  (+${f.pointsBack})`);
  console.log(`   ${f.problem}`);
});
console.log();
