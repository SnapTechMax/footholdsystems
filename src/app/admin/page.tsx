import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { getFunnelCounts, getHealth } from "@/lib/overview";
import { getCampaignStats } from "@/lib/campaign";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

function pct(n: number, of: number): string {
  if (of <= 0) return "—";
  return `${((n / of) * 100).toFixed(1)}%`;
}

/** One stage of the funnel, with its conversion from the stage before. */
function Stage({
  label,
  value,
  rate,
  note,
}: {
  label: string;
  value: number | string;
  rate?: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[#33332f] bg-[#232320] p-4">
      <p className={`${mono} text-[#7a786f]`}>{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#f2efe6]">{value}</span>
        {rate && <span className="text-sm text-[#f6be00]">{rate}</span>}
      </div>
      {note && <p className="mt-1 text-[11px] leading-snug text-[#7a786f]">{note}</p>}
    </div>
  );
}

export default async function AdminOverview() {
  const [funnel, campaign] = await Promise.all([
    getFunnelCounts(),
    getCampaignStats(),
  ]);
  const health = getHealth();
  const missing = health.filter((h) => !h.ok);

  const views = funnel?.views ?? 0;
  const downloads = funnel?.downloads ?? 0;
  const optedIn = funnel?.optedIn ?? 0;
  const declined = funnel?.declined ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-1 text-3xl font-black uppercase tracking-tight text-[#f2efe6]">
        Foothold
      </h1>
      <p className={`${mono} mb-6 text-[#8a887f]`}>
        {new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific
      </p>

      <AdminNav current="/admin" />

      {/* The whole funnel, left to right */}
      <h2 className={`${mono} mb-3 text-[#f6be00]`}>The funnel</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stage label="Guide views" value={views} note="Unique visitors, server-counted." />
        <Stage
          label="Downloads"
          value={downloads}
          rate={pct(downloads, views)}
          note="Of viewers."
        />
        <Stage
          label="Opted in"
          value={optedIn}
          rate={pct(optedIn, optedIn + declined)}
          note="Of those who chose."
        />
        <Stage
          label="In sequence"
          value={campaign.runs.total}
          note={campaign.sampled ? "Sample of most recent." : "Enrolled."}
        />
        <Stage
          label="Booked"
          value={campaign.suppressedByBooking}
          rate={pct(campaign.suppressedByBooking, campaign.runs.total)}
          note="Stopped the sequence early."
        />
      </div>

      {declined > 0 && (
        <p className="mt-3 text-xs text-[#7a786f]">
          {declined} took the guide without opting in. They are not in the
          sequence, which is the arrangement working rather than a leak.
        </p>
      )}

      {/* Where to go next */}
      <h2 className={`${mono} mt-8 mb-3 text-[#f6be00]`}>Detail</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/campaign"
          className="rounded-lg border border-[#33332f] bg-[#232320] p-5 transition-colors hover:border-[#f6be00]"
        >
          <p className="font-bold text-[#f2efe6]">Campaign →</p>
          <p className="mt-1 text-sm leading-relaxed text-[#8a887f]">
            Per-email progress through the 22, who stopped where, and consent
            counts.
          </p>
        </Link>
        <Link
          href="/admin/cro"
          className="rounded-lg border border-[#33332f] bg-[#232320] p-5 transition-colors hover:border-[#f6be00]"
        >
          <p className="font-bold text-[#f2efe6]">CRO →</p>
          <p className="mt-1 text-sm leading-relaxed text-[#8a887f]">
            Clarity signals, running experiments, and the engine&apos;s run log.
          </p>
        </Link>
      </div>

      {/* Configuration, because everything here fails silently */}
      <h2 className={`${mono} mt-8 mb-3 text-[#f6be00]`}>
        Configuration
        {missing.length > 0 && (
          <span className="ml-2 normal-case tracking-normal text-[#ff9d7a]">
            {missing.length} not set
          </span>
        )}
      </h2>
      <div className="overflow-hidden rounded-lg border border-[#33332f] bg-[#232320]">
        {health.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-start gap-3 px-5 py-3 ${
              i > 0 ? "border-t border-[#33332f]" : ""
            }`}
          >
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                item.ok ? "bg-[#7fbf9f]" : "bg-[#ff9d7a]"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-[#e6e3d9]">{item.label}</p>
              <p className="text-xs leading-relaxed text-[#7a786f]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[#7a786f]">
        Every number here is counted on our own server, so ad blockers do not
        touch it. Opens and clicks are absent because Resend exposes neither for
        automations; every link carries UTM parameters instead, so click-through
        is in GA4.
      </p>
    </main>
  );
}
