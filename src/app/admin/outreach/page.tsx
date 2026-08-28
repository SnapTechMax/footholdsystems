import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { initScanSchema, listOutreachScans } from "@/lib/scan/db";
import { DONE_FOR_YOU_PRICE, siteUrl } from "@/lib/scan/pricing";
import { OutreachPanel } from "./OutreachPanel";

/**
 * Scans prospects for cold outbound.
 *
 * Type in somebody's website, get back a link to a finished report with every
 * fix visible and the build offered underneath it. The link goes out in an
 * email written by hand.
 *
 * Not a free-scan form with the paywall switched off. Three things are
 * different from the funnel, and all three follow from the prospect not having
 * asked: no email address is collected because there is nobody to collect it
 * from, nothing is ever sent by the system, and nobody is enrolled in the
 * sequence. See the outreach section of lib/scan/db.ts.
 */

export const dynamic = "force-dynamic";
/**
 * The scans run inside the Server Action on this route, not in a background
 * job, so the function has to outlive them. A cold scan is 13 to 25 seconds
 * and a batch is sequential; the action stops starting new ones at 200s and
 * hands the rest back queued, which leaves real headroom under this.
 */
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Outreach",
  robots: { index: false, follow: false },
};

export default async function OutreachAdminPage() {
  // Same call the capture route makes, for the same reason: the outreach column
  // is added by a migration inside it, and this page is the first thing that
  // reads the column on a deployment where nobody has run a scan yet.
  await initScanSchema().catch((error) => {
    console.error("[outreach] schema check failed:", error);
  });

  const scans = await listOutreachScans().catch((error) => {
    console.error("[outreach] could not list scans:", error);
    return [];
  });

  return (
    <main className="min-h-screen bg-[#1b1b1b] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="/admin/outreach" />

        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-[-0.02em] text-[#f2efe6]">
          Scan a prospect
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.7] text-[#a8a599]">
          Paste their websites, get a link each. The page it produces gives them
          the whole report free, fixes included, and offers the{" "}
          {DONE_FOR_YOU_PRICE} build underneath with a refund guarantee they can
          check on any scanner. That link is the thing you send.
        </p>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.7] text-[#7a786f]">
          Nothing here emails anyone and nobody joins the sequence. These are
          people who have not heard of us, so every message they get comes from
          you, out of an inbox you are watching.
        </p>

        <div className="mt-8">
          <OutreachPanel initialScans={scans} origin={siteUrl()} />
        </div>
      </div>
    </main>
  );
}
