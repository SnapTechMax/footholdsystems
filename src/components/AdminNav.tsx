import Link from "next/link";

/**
 * Shared nav across the admin pages.
 *
 * The dashboards were reachable only by typing their URLs, which is fine once
 * you know them and useless otherwise.
 *
 * Overview, Campaign and CRO went with the guide funnel they were built to
 * measure: an experiment engine with nothing running in it and a per-email
 * breakdown of a sequence nobody was reading are worse than no dashboard,
 * because a stale number still gets acted on.
 *
 * The three that remain are in the order a customer moves through them:
 * prospect, intake, handover.
 */
const TABS = [
  { href: "/admin/outreach", label: "Outreach" },
  { href: "/admin/intake", label: "Intake" },
  { href: "/admin/handover", label: "Handover" },
] as const;

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-[#33332f] pb-px">
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              active
                ? "border-b-2 border-[#f6be00] text-[#f6be00]"
                : "border-b-2 border-transparent text-[#7a786f] hover:text-[#cfccc2]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
