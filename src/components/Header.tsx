"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookCallButton } from "@/components/BookCallButton";
import { GUIDE_CAPTURE_ANCHOR } from "@/lib/site";

/**
 * Site header.
 *
 * `/guide` is the paid-traffic landing page and is treated as a landing page:
 * one goal, no exits. Someone four seconds into their first visit is not going to
 * book a call, and the Calendly link opened in a new tab — so a click there lost
 * the visitor *and* kept them out of the email sequence that does the actual work
 * of booking calls. On that route the nav links and the wordmark link come off
 * too, and the call to action points at the capture form instead.
 *
 * On mobile the sticky bar at the bottom of `/guide` carries the call to action,
 * so the header keeps only the wordmark and stays out of the way of the fold.
 *
 * A client component purely for `usePathname`. Reading headers() in the layout
 * instead would opt every page into dynamic rendering to brand one route.
 */
export function Header() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/guide";

  return (
    <header className="sticky top-0 z-50 border-b border-[#2c2c29] bg-[#1b1b1b]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark linked={!isLandingPage} />

        <nav className="flex items-center gap-6">
          {!isLandingPage && (
            <>
              <Link
                href="/#how-we-work"
                className="hidden font-mono text-xs uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:text-[#f2efe6] sm:inline"
              >
                How we work
              </Link>
              <Link
                href="/guide"
                className="hidden font-mono text-xs uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:text-[#f2efe6] sm:inline"
              >
                The guide
              </Link>
            </>
          )}

          {isLandingPage ? (
            <a
              href={GUIDE_CAPTURE_ANCHOR}
              className="hidden rounded-lg bg-[#f6be00] px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#1b1b1b] transition-colors hover:bg-[#ffd23d] sm:inline-block"
            >
              Get the guide
            </a>
          ) : (
            <BookCallButton
              entryPoint="header"
              className="rounded-lg bg-[#f6be00] px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#1b1b1b] transition-colors hover:bg-[#ffd23d]"
            >
              Book a call
            </BookCallButton>
          )}
        </nav>
      </div>
    </header>
  );
}

function Wordmark({ linked }: { linked: boolean }) {
  const inner = (
    <>
      <Image
        src="/images/foothold-mark.png"
        alt="Foothold Systems logo"
        width={32}
        height={32}
        className="h-8 w-8 rounded-md"
        priority
      />
      <span className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-[#f2efe6]">
        Foothold Systems
      </span>
    </>
  );

  if (!linked) {
    return <div className="flex items-center gap-2.5">{inner}</div>;
  }

  return (
    <Link href="/" className="flex items-center gap-2.5">
      {inner}
    </Link>
  );
}
