import { readFileSync } from "node:fs";
import { categoryLabel, DEFAULT_CATEGORY, isBusinessCategory } from "../src/lib/scan/categories";
import { normaliseDomain } from "../src/lib/scan/domain";
import { buildReport } from "../src/lib/scan/report";
import { scanDomain } from "../src/lib/scan/scanner";
import { CHECKS } from "../src/lib/scan/scanner/catalog";
import type { ScanCheck, ScanPayload } from "../src/lib/scan/types";

/**
 * Runs the scanner and shows, check by check, where it disagrees with a
 * reference payload.
 *
 *   npm run scan:compare -- example.com [category]                  # vs Ora's cached score
 *   npm run scan:compare -- example.com [category] --against x.json # vs a stored payload
 *
 * The reference defaults to Ora's public, keyless score endpoint, which
 * serves whatever it last scanned for the domain and 404s on one nobody has
 * scanned there. Ora no longer runs our scans; it stays the yardstick because
 * the check ids, weights and wording were taken from it, and "does it produce
 * the same report" is the only honest test of a change to a check. `--against`
 * takes any stored payload, a `raw` column from the scans table included.
 */

const args = process.argv.slice(2);
const againstAt = args.indexOf("--against");
const againstFile = againstAt >= 0 ? args[againstAt + 1] : null;
const positional = args.filter((a, i) => !a.startsWith("--") && (againstAt < 0 || i !== againstAt + 1));
const domain = normaliseDomain(positional[0] ?? "");
if (!domain) {
  console.error("Usage: npm run scan:compare -- <domain> [sbo|digital|ecommerce|saas|app] [--against <payload.json>]");
  process.exit(2);
}
const category = isBusinessCategory(positional[1]) ? positional[1] : DEFAULT_CATEGORY;

async function loadReference(): Promise<ScanPayload | null> {
  if (againstFile) return JSON.parse(readFileSync(againstFile, "utf8")) as ScanPayload;
  const response = await fetch(`https://ora.ai/api/score/${encodeURIComponent(domain as string)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) {
    console.error(`Ora has no cached score for ${domain}. Pass --against <payload.json> instead.`);
    return null;
  }
  if (!response.ok) {
    console.error(`Ora's score endpoint answered ${response.status}.`);
    return null;
  }
  const payload = (await response.json()) as ScanPayload;
  return Array.isArray(payload.layers) ? payload : null;
}

const [reference, local] = await Promise.all([loadReference(), scanDomain(domain)]);
if (!reference) process.exit(1);

const byId = (scan: ScanPayload) => new Map(scan.layers.flatMap((l) => l.checks).map((c) => [c.id, c]));
const referenceChecks = byId(reference);
const localChecks = byId(local);

const cell = (c: ScanCheck | undefined) =>
  c ? `${c.status.padEnd(7)} ${String(c.score).padStart(3)}/${c.maxScore}` : "(absent)     ";

let same = 0;
let sameStatus = 0;
console.log(`\n${domain}  reference scanned ${reference.scannedAt ?? "?"}  local ${local.scannedAt}\n`);
console.log(`${"check".padEnd(28)} ${"reference".padEnd(13)} ${"local".padEnd(13)}`);
for (const def of CHECKS) {
  const r = referenceChecks.get(def.id);
  const l = localChecks.get(def.id);
  const statusMatch = r?.status === l?.status;
  const exact = statusMatch && r?.score === l?.score;
  if (exact) same++;
  if (statusMatch) sameStatus++;
  const mark = exact ? " " : statusMatch ? "~" : "✗";
  console.log(`${mark} ${def.id.padEnd(26)} ${cell(r)} ${cell(l)}`);
  if (!exact) {
    console.log(`      reference: ${r?.details ?? "-"}`);
    console.log(`      local:     ${l?.details ?? "-"}`);
  }
}

const referenceReport = buildReport(reference, category);
const localReport = buildReport(local, category);
console.log(`\n${same}/${CHECKS.length} checks identical, ${sameStatus}/${CHECKS.length} same status.`);
console.log(`Raw score: reference ${reference.score} (${reference.grade}), local ${local.score} (${local.grade}).`);
console.log(
  `Report as ${categoryLabel(category)}: reference ${referenceReport.score}/100 ${referenceReport.grade}, local ${localReport.score}/100 ${localReport.grade}.`
);
console.log(`Findings: reference [${referenceReport.findings.map((f) => f.checkId).join(", ")}]`);
console.log(`          local     [${localReport.findings.map((f) => f.checkId).join(", ")}]\n`);
