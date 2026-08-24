import Image from "next/image";
import Link from "next/link";
import { BUSINESS_ADDRESS } from "@/lib/site";

/**
 * Footer.
 *
 * Deliberately thin. The only links are the two that have to be here: the
 * privacy policy, because the site collects email addresses and Meta's ad
 * review looks for it, and nothing else. A footer full of exits on a
 * single-page funnel is just a leak with a border on top.
 *
 * The postal address is the same one the delivery emails print for CAN-SPAM.
 * It stays visible because a lead-capture page running cold paid traffic with
 * no identifiable business behind it costs trust and draws ad-review attention.
 */
export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--ink)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-14 sm:flex-row sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/foothold-mark.png"
              alt="FootHold Systems"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
            />
            <span className="font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text)]">
              FootHold <span className="text-[var(--accent)]">AEO</span>
            </span>
          </div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
            Answer Engine Optimization
          </p>
          {BUSINESS_ADDRESS && (
            <p className="mt-5 max-w-[16rem] font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-[var(--dim)]">
              {BUSINESS_ADDRESS}
            </p>
          )}
        </div>

        <div className="sm:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
            Legal
          </p>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li>
              <Link
                href="/privacy"
                className="text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Privacy policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--dim)]">
            &copy; {new Date().getFullYear()} FootHold Systems
          </p>
          {/* Not decoration. This page makes strong claims about a channel
              nobody can guarantee an outcome in, and it runs on Meta traffic.
              Saying plainly that results vary and that we are not affiliated
              with the model vendors is both true and the thing that keeps the
              ad account healthy. */}
          <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-[var(--dim)]">
            FootHold Systems is an independent consultancy and is not affiliated
            with, endorsed by, or partnered with OpenAI, Google, Microsoft,
            Perplexity, or Anthropic. ChatGPT, Gemini, Copilot, Perplexity and
            Claude are trademarks of their respective owners. No agency can
            control the output of a language model, and we do not promise a
            specific ranking, placement, or recommendation. Results vary by
            business, category, and market.
          </p>
        </div>
      </div>
    </footer>
  );
}
