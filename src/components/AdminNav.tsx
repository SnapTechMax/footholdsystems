import Link from "next/link";

/**
 * Shared nav across the admin pages.
 *
 * The dashboards were reachable only by typing their URLs, which is fine once
 * you know them and useless otherwise.
 */
const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/campaign", label: "Campaign" },
  { href: "/admin/cro", label: "CRO" },
  { href: "/admin/outreach", label: "Outreach" },
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
