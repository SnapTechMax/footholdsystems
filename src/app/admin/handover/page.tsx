import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { HandoverForm } from "./HandoverForm";

/**
 * Publishes the page a build customer reads when the work is finished.
 *
 * The page it creates is the only place tier 3 is offered. offer.md calls that
 * a separate funnel sold only to existing build customers, and this is what
 * enforces it: nothing anywhere else on the site or in the emails mentions the
 * retainer, so it reaches exactly the people whose handover has been published.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Handover",
  robots: { index: false, follow: false },
};

export default function HandoverAdminPage() {
  return (
    <main className="min-h-screen bg-[#26251f] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="/admin/handover" />

        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-[-0.02em] text-[#f2efe6]">
          Publish a handover
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.7] text-[#a8a599]">
          For a build that is finished and delivered. This creates the page they
          read at the end: what they own, what changed, and the retainer offer
          with the guarantee. Until you publish, that URL returns a 404, so
          there is nothing to stumble onto mid job.
        </p>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.7] text-[#7a786f]">
          It is also the only place the retainer appears. Nothing on the site or in the email sequence mentions it, so
          it reaches the people you publish a handover for and nobody else.
        </p>

        <div className="mt-8">
          <HandoverForm />
        </div>
      </div>
    </main>
  );
}
