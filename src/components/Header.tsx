import Image from "next/image";
import { ScanCta } from "@/components/ScanCta";

/**
 * Site header.
 *
 * The site is one page, and that page is bought traffic. So there is no nav:
 * every link in a header is a way for a visitor to leave without converting,
 * and there is nowhere else worth sending them anyway. The wordmark does not
 * link — clicking it would only reload the page they are already on.
 *
 * Sticky so the CTA is always one tap away on mobile, which is where the ads
 * land. That replaces the old sticky bottom bar rather than adding to it: two
 * fixed CTAs on a phone is most of the screen.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--ink)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/foothold-mark.png"
            alt="FootHold Systems"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md"
            priority
          />
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--text)]">
            FootHold{" "}
            <span className="text-[var(--accent)]">AEO</span>
          </span>
        </div>

        <ScanCta
          entryPoint="header"
          className="!px-4 !py-2 !text-[11px] sm:!px-5 sm:!text-xs"
        >
          <span className="sm:hidden">Free scan</span>
          <span className="hidden sm:inline">Get my free scan</span>
        </ScanCta>
      </div>
    </header>
  );
}
