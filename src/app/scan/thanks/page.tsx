import type { Metadata } from "next";
import Link from "next/link";

/**
 * Post-submission page.
 *
 * Its whole job is to stop someone closing the tab thinking nothing happened,
 * and to set the expectation that the report arrives by email rather than here.
 * The scan is running in the background at this point.
 *
 * Not indexed: a thank-you page in search results is a page that shows up for
 * people who never submitted anything.
 */

export const metadata: Metadata = {
  title: "Your scan is running",
  robots: { index: false, follow: false },
};

export default async function ScanThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;

  return (
    <main className="bg-[var(--ink)]">
      <div className="mx-auto max-w-2xl px-5 py-24 sm:px-6 sm:py-32">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          Scan running
        </p>

        <h1 className="mt-5 text-balance font-display text-[2.1rem] font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          We&apos;re reading your site right now.
        </h1>

        <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
          It takes a couple of minutes. We run your site through the checks that
          decide whether an AI assistant can find you, understand what you sell,
          and recommend you when somebody asks. Then we write up what we found
          in plain English and email it over.
        </p>

        <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Two things worth doing now
          </p>
          <ul className="mt-5 space-y-4 text-[15px] leading-[1.6] text-[var(--muted)]">
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-[var(--accent)]">1.</span>
              <span>
                Check your spam folder if nothing arrives in ten minutes, and
                mark us as not spam so the follow-ups reach you.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-[var(--accent)]">2.</span>
              <span>
                Open ChatGPT and ask it to recommend a business like yours in
                your area. Whatever it says is the thing your report is about.
              </span>
            </li>
          </ul>
        </div>

        {token && (
          <p className="mt-8 text-[15px] leading-relaxed text-[var(--muted)]">
            Your report will live here when it&apos;s ready:{" "}
            <Link
              href={`/scan/${token}`}
              className="font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              view your report
            </Link>
            . Bookmark it, because the link doesn&apos;t expire.
          </p>
        )}

        <p className="mt-10 text-[14px] leading-relaxed text-[var(--dim)]">
          Nothing after fifteen minutes? Email{" "}
          <a
            href="mailto:max@footholdsystems.com"
            className="text-[var(--muted)] underline underline-offset-4"
          >
            max@footholdsystems.com
          </a>{" "}
          and we&apos;ll run it by hand.
        </p>
      </div>
    </main>
  );
}
