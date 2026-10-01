import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { OUTREACH_LEAD_EMAIL, initScanSchema, searchScansByDomain } from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/domain";
import { auditUrl, reportUrl } from "@/lib/scan/pricing";
import { CopyLinkButton } from "./CopyLinkButton";

/**
 * Website in, report link out.
 *
 * For replying to an email about a scan that already exists. The person writing
 * in names their site, not their token, and the token is the only way to the
 * report, so without this the link meant a trip to the database.
 *
 * A GET form, so a lookup is a URL that can be reloaded or kept in a tab.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scan lookup",
  robots: { index: false, follow: false },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

/**
 * What to search the domain column for.
 *
 * A full URL or "www.Example.com" is normalised to the stored form. Anything
 * normaliseDomain rejects, like "joesplumbing" with no TLD, is still worth a
 * substring search, so it is cleaned up by hand rather than refused.
 */
function searchTerm(input: string): string {
  return (
    normaliseDomain(input) ??
    input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/[/?#].*$/, "")
  );
}

export default async function LookupAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site = "" } = await searchParams;
  const term = searchTerm(site);

  let results: Awaited<ReturnType<typeof searchScansByDomain>> = [];
  let failed = false;
  if (term) {
    await initScanSchema().catch((error) => {
      console.error("[lookup] schema check failed:", error);
    });
    results = await searchScansByDomain(term).catch((error) => {
      console.error("[lookup] search failed:", error);
      failed = true;
      return [];
    });
  }

  return (
    <main className="min-h-screen bg-[#1b1b1b] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="/admin/lookup" />

        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-[-0.02em] text-[#f2efe6]">
          Scan lookup
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.7] text-[#a8a599]">
          Type a website that has already been scanned and copy the link to its
          report. Part of a name works too.
        </p>

        <form method="get" className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="site"
            defaultValue={site}
            placeholder="example.com"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-[#33332f] bg-[#211f1b] px-4 py-3 text-[15px] text-[#f2efe6] placeholder:text-[#7a786f] focus:outline-none focus:ring-2 focus:ring-[#f6be00]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[#f6be00] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[#1b1b1b] transition-opacity hover:opacity-90"
          >
            Look up
          </button>
        </form>

        <div className="mt-10 space-y-3">
          {failed ? (
            <p className="rounded-xl border border-[#5c2b22] bg-[#211f1b] px-5 py-6 text-[15px] text-[#ff9c88]">
              The lookup failed. Check the server logs.
            </p>
          ) : term && results.length === 0 ? (
            <p className="rounded-xl border border-[#33332f] bg-[#211f1b] px-5 py-8 text-center text-[15px] text-[#7a786f]">
              No scans match &ldquo;{term}&rdquo;.
            </p>
          ) : null}

          {results.map((scan) => {
            // Outreach scans are read at /audit, everything else at /scan. The
            // /scan page would redirect an outreach token anyway, but the link
            // that goes in the email should be the one it lands on.
            const url = scan.outreach ? auditUrl(scan.token) : reportUrl(scan.token);
            const created = new Date(scan.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Los_Angeles",
            });
            const statusText =
              scan.status === "complete"
                ? `${scan.score}/100 · ${scan.grade}`
                : scan.status;
            const statusClass =
              scan.status === "complete"
                ? "border-[#f6be00]/50 text-[#f6be00]"
                : scan.status === "failed"
                  ? "border-[#ff9d7a]/50 text-[#ff9d7a]"
                  : "border-[#4a4a44] text-[#8a887f]";

            return (
              <div
                key={scan.token}
                className="rounded-xl border border-[#33332f] bg-[#211f1b] px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-lg font-black tracking-[-0.01em] text-[#f2efe6]">
                    {scan.domain}
                  </span>
                  <span className={`${mono} rounded border px-2 py-0.5 ${statusClass}`}>
                    {statusText}
                  </span>
                  <span className={`${mono} text-[#7a786f]`}>
                    {scan.outreach ? "Outreach" : "Inbound"} · {created} PT
                  </span>
                </div>
                {!scan.outreach && scan.email !== OUTREACH_LEAD_EMAIL ? (
                  <p className="mt-1 text-[14px] text-[#a8a599]">{scan.email}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-3">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate font-mono text-[12px] text-[#cfccc2] underline underline-offset-4 hover:text-[#f6be00]"
                  >
                    {url}
                  </a>
                  <CopyLinkButton url={url} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
