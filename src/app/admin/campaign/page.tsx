import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN_CONFIGURED, getCampaignStats } from "@/lib/campaign";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campaign",
  robots: { index: false, follow: false },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded border border-[#3a3a37] p-4">
      <p className={`${mono} text-[#7a786f]`}>{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-[#f2efe6]">{value}</p>
      {note && <p className="mt-1 text-[11px] leading-snug text-[#7a786f]">{note}</p>}
    </div>
  );
}

export default async function CampaignDashboard() {
  const stats = await getCampaignStats();
  const { runs, funnel, consent } = stats;

  const optInRate =
    consent.granted + consent.declined > 0
      ? (consent.granted / (consent.granted + consent.declined)) * 100
      : null;

  // Widest bar in the funnel, so the chart scales to what is actually there.
  const peak = Math.max(1, ...funnel.map((f) => f.sent));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#f2efe6]">
          Campaign
        </h1>
        <Link href="/admin/cro" className={`${mono} text-[#f6be00] hover:underline`}>
          CRO dashboard →
        </Link>
      </div>

      {stats.automation ? (
        <p className={`${mono} mt-2 text-[#8a887f]`}>
          {stats.automation.name} ·{" "}
          <span
            className={
              stats.automation.status === "enabled"
                ? "text-[#7fbf9f]"
                : "text-[#ff9d7a]"
            }
          >
            {stats.automation.status}
          </span>
        </p>
      ) : (
        <p className={`${mono} mt-2 text-[#8a887f]`}>no automation connected</p>
      )}

      {stats.errors.length > 0 && (
        <div className="mt-6 rounded-lg border border-[#5c4a1f] bg-[#2a2413] p-4">
          <p className={`${mono} text-[#f6be00]`}>Not configured yet</p>
          <ul className="mt-2 space-y-1 text-sm text-[#cfccc2]">
            {stats.errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Everything before the sequence: our own records, not Resend's */}
      <h2 className={`${mono} mt-8 mb-3 text-[#f6be00]`}>Into the funnel</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Guide downloads" value={stats.downloads} note="Server-side counted, unaffected by ad blockers." />
        <Stat label="Opted in" value={consent.granted} />
        <Stat label="Declined" value={consent.declined} note="Got the guide, not the emails." />
        <Stat
          label="Opt-in rate"
          value={optInRate === null ? "—" : `${optInRate.toFixed(0)}%`}
          note="Only meaningful where the tick is optional."
        />
      </div>

      {/* Sequence state, from Resend */}
      <h2 className={`${mono} mt-8 mb-3 text-[#f6be00]`}>In the sequence</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Enrolled" value={runs.total} />
        <Stat label="Still running" value={runs.running} />
        <Stat label="Finished all 22" value={runs.completed} />
        <Stat
          label="Stopped early"
          value={stats.suppressedByBooking}
          note="Booked a call, so the rest was suppressed."
        />
      </div>
      {runs.failed > 0 && (
        <p className="mt-3 text-sm text-[#ff9d7a]">
          {runs.failed} run{runs.failed === 1 ? "" : "s"} failed. Check the
          automation in Resend.
        </p>
      )}

      {/* Per-email progress */}
      <h2 className={`${mono} mt-8 mb-3 text-[#f6be00]`}>
        Per email
        {stats.sampled && (
          <span className="ml-2 normal-case tracking-normal text-[#7a786f]">
            (sample of {stats.sampleSize} most recent runs)
          </span>
        )}
      </h2>

      <div className="overflow-x-auto rounded-lg border border-[#33332f] bg-[#232320]">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className={`${mono} text-left text-[#7a786f]`}>
              <th className="px-4 py-3 font-normal">#</th>
              <th className="px-4 py-3 font-normal">Day</th>
              <th className="px-4 py-3 font-normal">Subject</th>
              <th className="px-4 py-3 text-right font-normal">Sent</th>
              <th className="px-4 py-3 font-normal">Reach</th>
            </tr>
          </thead>
          <tbody>
            {funnel.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#8a887f]">
                  No runs yet. Numbers appear once someone opts in and the
                  sequence starts.
                </td>
              </tr>
            )}
            {funnel.map((step) => (
              <tr key={step.key} className="border-t border-[#33332f]">
                <td className="px-4 py-2.5 font-mono text-xs text-[#7a786f]">
                  {String(step.position).padStart(2, "0")}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[#7a786f]">
                  {step.day}
                </td>
                <td className="px-4 py-2.5 text-[#e6e3d9]">{step.subject}</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#f2efe6]">
                  {step.sent}
                </td>
                <td className="px-4 py-2.5">
                  <div className="h-2 w-full min-w-[80px] overflow-hidden rounded-sm bg-[#2c2c29]">
                    <div
                      className="h-full rounded-sm bg-[#f6be00]"
                      style={{ width: `${(step.sent / peak) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[#7a786f]">
        Opens and clicks are absent because Resend&apos;s API exposes neither for
        automations. Every link in every email carries{" "}
        <code className="text-[#8a887f]">utm_campaign</code> and{" "}
        <code className="text-[#8a887f]">utm_content</code>, so click-through is
        in GA4 under Acquisition, broken down by which email and which link.
        {!CAMPAIGN_CONFIGURED() &&
          " Sequence numbers stay at zero until RESEND_AUTOMATION_ID is set."}
      </p>
    </main>
  );
}
