import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { initScanSchema, listSales, type SaleRow } from "@/lib/scan/db";
import { formatPrice } from "@/lib/scan/pricing";

/**
 * Every sale, and which email earned it.
 *
 * `scan_orders` was written and never read. The only thing that ever touched a
 * paid row was the EXISTS behind the green chip on the outreach panel, which
 * answers "did this one buy" and nothing else — not when, not how much, and not
 * which batch. Money with no listing is money you have to reconstruct from a
 * payment processor.
 *
 * The batch column is the reason this exists at all. Everything else here was
 * always recoverable from the database; `email_key` was not, because until the
 * column was added it lived in Whop's metadata and stopped there.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
  robots: { index: false, follow: false },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

/** Where the buyer came from, in one phrase. */
function origin(sale: SaleRow): string {
  if (sale.outreach) return "Cold outreach";
  if (sale.source === "sequence") return "Nurture sequence";
  return "From the report";
}

/**
 * Revenue, counting only money that actually arrived.
 *
 * Simulated rows are listed but never totalled. A test purchase inside a
 * revenue figure is the one number in here that could be acted on wrongly.
 */
function totals(sales: SaleRow[]) {
  const real = sales.filter((s) => s.provider !== "simulated");
  return {
    count: real.length,
    cents: real.reduce((sum, s) => sum + s.amountCents, 0),
    builds: real.filter((s) => s.product === "done_for_you").length,
    simulated: sales.length - real.length,
  };
}

/** Revenue per cold-email batch, which is the question outbound is asking. */
function byBatch(sales: SaleRow[]) {
  const groups = new Map<string, { count: number; cents: number }>();
  for (const sale of sales) {
    if (sale.provider === "simulated" || !sale.emailKey) continue;
    const current = groups.get(sale.emailKey) ?? { count: 0, cents: 0 };
    groups.set(sale.emailKey, {
      count: current.count + 1,
      cents: current.cents + sale.amountCents,
    });
  }
  return [...groups.entries()].sort((a, b) => b[1].cents - a[1].cents);
}

export default async function SalesAdminPage() {
  // Same call every other admin page makes. This one also adds the two columns
  // the batch grouping below depends on, so it must run before the query.
  await initScanSchema().catch((error) => {
    console.error("[sales] schema check failed:", error);
  });

  const sales = await listSales().catch((error) => {
    console.error("[sales] could not list orders:", error);
    return [] as SaleRow[];
  });

  const summary = totals(sales);
  const batches = byBatch(sales);

  return (
    <main className="min-h-screen bg-[#1b1b1b] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <AdminNav current="/admin/sales" />

        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-[-0.02em] text-[#f2efe6]">
          Sales
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.7] text-[#a8a599]">
          Every paid order, newest first, with the cold-email batch that earned
          it. Whop remains the system of record for the money itself; this is
          the record of who the money came from.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Revenue", formatPrice(summary.cents)],
            ["Orders", String(summary.count)],
            ["Builds", String(summary.builds)],
            ["Batches", String(batches.length)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[#33332f] bg-[#232320] px-4 py-3"
            >
              <p className={`${mono} text-[#5f5e58]`}>{label}</p>
              <p className="mt-1.5 font-display text-2xl font-black text-[#f2efe6]">
                {value}
              </p>
            </div>
          ))}
        </div>

        {summary.simulated > 0 && (
          <p className="mt-3 text-[13px] leading-snug text-[#7a786f]">
            {summary.simulated} simulated{" "}
            {summary.simulated === 1 ? "order is" : "orders are"} listed below
            and excluded from every figure above.
          </p>
        )}

        {batches.length > 0 && (
          <>
            <h2 className={`${mono} mt-12 text-[#5f5e58]`}>By batch</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#33332f] bg-[#232320]">
              {batches.map(([key, group]) => (
                <div
                  key={key}
                  className="flex flex-wrap items-baseline gap-x-3 border-t border-[#33332f] px-5 py-3 first:border-t-0"
                >
                  <span className="font-mono text-[13px] text-[#f6be00]">
                    {key}
                  </span>
                  <span className="text-[14px] text-[#a8a599]">
                    {group.count} {group.count === 1 ? "sale" : "sales"}
                  </span>
                  <span className="ml-auto font-semibold text-[#f2efe6]">
                    {formatPrice(group.cents)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className={`${mono} mt-12 text-[#5f5e58]`}>Orders</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-[#33332f] bg-[#232320]">
          {sales.length === 0 ? (
            <p className="px-5 py-8 text-[15px] leading-relaxed text-[#7a786f]">
              Nothing paid yet. A sale lands here the moment Whop&apos;s webhook
              reports it, which is also when the phone buzzes.
            </p>
          ) : (
            sales.map((sale) => (
              <div
                key={sale.id}
                className="border-t border-[#33332f] px-5 py-4 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <a
                    href={
                      sale.outreach
                        ? `/audit/${sale.token}`
                        : `/scan/${sale.token}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#f2efe6] underline underline-offset-4 hover:text-[#f6be00]"
                  >
                    {sale.domain}
                  </a>
                  <span
                    className={`${mono} rounded-full border px-2.5 py-0.5 ${
                      sale.product === "done_for_you"
                        ? "border-[#f6be00]/50 text-[#f6be00]"
                        : "border-[#4a4a44] text-[#8a887f]"
                    }`}
                  >
                    {sale.product === "done_for_you" ? "Build" : "Fix list"}
                  </span>
                  {sale.provider === "simulated" && (
                    <span
                      className={`${mono} rounded-full border border-[#ff9d7a]/50 px-2.5 py-0.5 text-[#ff9d7a]`}
                    >
                      Simulated
                    </span>
                  )}
                  <span className="ml-auto font-semibold text-[#f2efe6]">
                    {formatPrice(sale.amountCents)}
                  </span>
                </div>

                <div
                  className={`${mono} mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#5f5e58]`}
                >
                  <span>
                    {sale.paidAt
                      ? new Date(sale.paidAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "no date"}
                  </span>
                  <span>{origin(sale)}</span>
                  {sale.emailKey && (
                    <span className="text-[#f6be00]">{sale.emailKey}</span>
                  )}
                  {sale.buyerEmail && (
                    <span className="lowercase tracking-normal">
                      {sale.buyerEmail}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-[#7a786f]">
          A batch tag only appears when the link carried one. Add{" "}
          <code className="rounded bg-[#26261f] px-1.5 py-0.5 font-mono text-[12px] text-[#f6be00]">
            ?e=your-batch-name
          </code>{" "}
          to a pay link on the outreach panel and it arrives here with the sale.
        </p>
      </div>
    </main>
  );
}
