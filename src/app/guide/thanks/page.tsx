import type { Metadata } from "next";
import { BookCallButton } from "@/components/BookCallButton";
import { ThanksAnalytics } from "@/components/ThanksAnalytics";
import { GUIDE_PATH } from "@/lib/site";

export const metadata: Metadata = {
  title: "Your guide is on the way",
  description:
    "The 5 Levels of AI is in your inbox. Here's the two-minute version, and how to get your number.",
  alternates: { canonical: "/guide/thanks" },
  // Funnel-internal page: keep it out of search results.
  robots: { index: false, follow: false },
};

// display font utility (Archivo is loaded globally in layout.tsx)
const display = "font-[family-name:var(--font-archivo)]";


// ─────────────────────────────────────────────────────────────────────────────
// THE INTRO VIDEO
//
// Currently self-hosted out of public/videos: 1920x1080 H.264/AAC, 57s, ~18 MB.
// To swap it, drop the new file in public/videos and repoint VIDEO_SRC.
//
// VIDEO_POSTER is the still shown before play. With none set, the browser shows
// the video's first frame — fine, but a chosen frame looks better. To add one:
// save a JPG to public/images/video-poster.jpg and set VIDEO_POSTER to
// "/images/video-poster.jpg".
//
// To move to YouTube / Vimeo / Loom instead (cheaper bandwidth, faster start),
// set VIDEO_EMBED_URL to the *embed* URL — not the share URL — and null out
// VIDEO_SRC. Embeds take precedence. For example:
//   "https://www.youtube.com/embed/AbCdEf12345"
//   "https://player.vimeo.com/video/123456789"
//
// With all three null the slot renders a labelled placeholder.
const VIDEO_SRC: string | null = "/videos/foothold-guide-intro.mp4";
const VIDEO_EMBED_URL: string | null = null;
const VIDEO_POSTER: string | null = null;
// ─────────────────────────────────────────────────────────────────────────────

function VideoSlot() {
  // 16:9 frame either way, so the page never reflows once the video lands.
  const frame =
    "relative aspect-video w-full overflow-hidden rounded-xl border border-[#33332f] bg-[#141412]";

  if (VIDEO_EMBED_URL) {
    return (
      <div className={frame}>
        <iframe
          src={VIDEO_EMBED_URL}
          title="Foothold Systems — start here"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  if (VIDEO_SRC) {
    return (
      <div className={frame}>
        <video
          src={VIDEO_SRC}
          poster={VIDEO_POSTER ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <div
      className={`${frame} flex flex-col items-center justify-center gap-3 border-dashed`}
    >
      <svg
        className="h-12 w-12 text-[#4a4a46]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 7.5l-6 4.5 6 4.5V7.5zM3 6.75A2.25 2.25 0 015.25 4.5h7.5A2.25 2.25 0 0115 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-7.5A2.25 2.25 0 013 17.25V6.75z"
        />
      </svg>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a887f]">
        Video goes here
      </p>
    </div>
  );
}

export default function GuideThanksPage() {
  return (
    <div className="bg-[#eae8e1] text-[#1f1f1d]">
      <ThanksAnalytics />

      {/* ============================= CONFIRMATION ============================= */}
      <section className="bg-[#1b1b1b] text-[#f2efe6]">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
            You&apos;re in
          </p>

          <h1
            className={`${display} mt-6 text-5xl font-black uppercase leading-[0.94] tracking-tight sm:text-7xl`}
          >
            Check your
            <br />
            <span className="text-[#f6be00]">inbox</span>
          </h1>

          <p className="mt-8 max-w-xl font-serif text-lg leading-relaxed text-[#cfccc2]">
            The 5 Levels of AI is on its way. It can take a minute to land. If
            it&apos;s not there, check your spam folder — or just grab it right
            here.
          </p>

          <a
            href={GUIDE_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg border-2 border-[#f6be00] px-7 py-3.5 font-bold text-[#f6be00] transition-colors hover:bg-[#f6be00] hover:text-[#1b1b1b]"
          >
            Download it now &rarr;
          </a>
        </div>
        <div className="bg-[#f6be00] py-3">
          <p className="mx-auto max-w-3xl px-6 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#1b1b1b]">
            The map is free. Your step takes one call.
          </p>
        </div>
      </section>

      {/* ============================= VIDEO ============================= */}
      <section className="border-b border-[#d4d1c6] bg-[#232320]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
            One minute
          </p>
          <h2
            className={`${display} mt-3 text-3xl font-black uppercase leading-[0.98] tracking-tight text-[#f2efe6] sm:text-5xl`}
          >
            Watch this first
          </h2>
          <p className="mt-5 max-w-xl font-serif text-[17px] leading-relaxed text-[#cfccc2]">
            A minute from me before you dig into the guide. Then, if it lands,
            let&apos;s put a number on where you actually are.
          </p>

          <div className="mt-10">
            <VideoSlot />
          </div>
        </div>
      </section>

      {/* ============================= BOOK THE CALL ============================= */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
          The next step
        </p>
        <h2
          className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}
        >
          You&apos;ll know your level.
          <br />
          Now get your number.
        </h2>
        <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed">
          Everything in the guide you can do on your own, and you should start
          today. What a guide can&apos;t tell you is which move is yours and what
          it&apos;s worth. That takes twenty minutes.
        </p>

        <div className="mt-10 bg-[#f6be00] p-8 text-[#1b1b1b] sm:p-10">
          <h3
            className={`${display} text-2xl font-black uppercase tracking-tight sm:text-3xl`}
          >
            Twenty minutes. Bring your level.
          </h3>
          <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-[#1b1b1b]/80">
            Tell me the level you landed on. I&apos;ll tell you what I usually
            find there, and what it costs businesses like yours. Free,
            whether or not you hire me.
          </p>

          <BookCallButton
            entryPoint="guide-thanks"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1b1b1b] px-7 py-3.5 text-lg font-bold text-[#f2efe6] transition-colors hover:bg-[#2c2c29]"
          />

          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#1b1b1b]/60">
            Weekday afternoons, 1–4pm Pacific &middot; Next 7 days
          </p>
        </div>

        <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f]">
          Foothold Systems &middot; AI for Business
        </p>
      </section>
    </div>
  );
}
