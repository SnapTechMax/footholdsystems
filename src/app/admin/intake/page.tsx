import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { contractUrl } from "@/lib/intake/contract";
import { initIntakeSchema, listIntakes } from "@/lib/intake/db";
import { intakeMarkdown } from "@/lib/intake/digest";
import { INTAKE_SECTIONS, displayAnswer } from "@/lib/intake/questions";
import { reportUrl, siteUrl } from "@/lib/scan/pricing";
import { CopyButton } from "./CopyButton";

/**
 * Everything customers have sent through /start.
 *
 * The notification email is the thing that gets read first, and for most
 * submissions it is the only thing anyone reads. This page exists for the two
 * cases the email cannot cover: an email that did not send, and an answer
 * somebody needs to go back to three weeks later when the email is buried.
 *
 * Newest first, everything expanded on the newest one and collapsed below it,
 * because the one that arrived this morning is the one being looked for.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake",
  robots: { index: false, follow: false },
};

export default async function IntakeAdminPage() {
  // Same call the capture route makes. This page is the first thing to read the
  // table on a deployment where nobody has submitted anything yet.
  await initIntakeSchema().catch((error) => {
    console.error("[intake] schema check failed:", error);
  });

  const intakes = await listIntakes().catch((error) => {
    console.error("[intake] could not list submissions:", error);
    return [];
  });

  const contract = contractUrl();

  return (
    <main className="min-h-screen bg-[#1b1b1b] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="/admin/intake" />

        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-[-0.02em] text-[#f2efe6]">
          Build intake
        </h1>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-[1.7] text-[#a8a599]">
          What customers have sent through the form. Send them{" "}
          <code className="rounded bg-[#26261f] px-1.5 py-0.5 font-mono text-[13px] text-[#f6be00]">
            {siteUrl()}/start
          </code>{" "}
          by hand. It is not linked from anywhere on the site and it is not
          indexed, so the link is the only way in.
        </p>

        {contract ? (
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.7] text-[#7a786f]">
            The agreement they sign before the form:{" "}
            <a
              href={contract}
              className="underline underline-offset-2 hover:text-[#cfccc2]"
            >
              {contract}
            </a>
          </p>
        ) : (
          <p className="mt-4 max-w-[64ch] rounded-lg border border-[#5c2b22] bg-[#2a1a16] px-4 py-3 text-[14px] leading-[1.7] text-[#e8b3a6]">
            <strong className="font-semibold text-[#ff9c88]">
              BUILD_CONTRACT_URL is not set.
            </strong>{" "}
            Customers sign the agreement before they get the form, so nothing
            here breaks, but the admin cannot show the link. Set it in Vercel
            and redeploy to see it here.
          </p>
        )}

        <div className="mt-10 space-y-4">
          {intakes.length === 0 ? (
            <p className="rounded-xl border border-[#33332f] bg-[#211f1b] px-5 py-8 text-center text-[15px] text-[#7a786f]">
              Nothing submitted yet.
            </p>
          ) : null}

          {intakes.map((intake, index) => {
            const submitted = new Date(intake.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Los_Angeles",
            });
            const scanUrl = intake.scanToken ? reportUrl(intake.scanToken) : null;
            const markdown = intakeMarkdown(intake.answers, {
              submittedAt: intake.createdAt,
              scanUrl,
              declarationText: intake.declarationText,
            });

            return (
              <details
                key={intake.token}
                open={index === 0}
                className="rounded-xl border border-[#33332f] bg-[#211f1b] px-5 py-4 sm:px-6"
              >
                <summary className="cursor-pointer list-none">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-lg font-black uppercase tracking-[-0.01em] text-[#f2efe6]">
                      {intake.businessName}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f]">
                      {submitted} PT
                    </span>
                    {intake.notifiedAt === null ? (
                      <span className="rounded bg-[#5c2b22] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff9c88]">
                        Email did not send
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[14px] text-[#a8a599]">
                    {intake.contactName}
                    {intake.contactName && intake.email ? " · " : ""}
                    <a
                      href={`mailto:${intake.email}`}
                      className="underline underline-offset-2 hover:text-[#f6be00]"
                    >
                      {intake.email}
                    </a>
                    {intake.phone ? ` · ${intake.phone}` : ""}
                  </span>
                </summary>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#33332f] pt-4">
                  <CopyButton markdown={markdown} />
                  {scanUrl ? (
                    <a
                      href={scanUrl}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f] underline underline-offset-4 hover:text-[#f6be00]"
                    >
                      Their scan report
                    </a>
                  ) : null}
                </div>

                <div className="mt-6 space-y-8">
                  {INTAKE_SECTIONS.map((section) => {
                    const answered = section.fields.filter(
                      (field) => (intake.answers[field.name] ?? "").trim() !== ""
                    );
                    if (answered.length === 0) return null;

                    return (
                      <section key={section.id}>
                        <h2 className="border-b border-[#33332f] pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#f6be00]">
                          {section.title}
                        </h2>
                        <dl className="mt-4 space-y-5">
                          {answered.map((field) => (
                            <div key={field.name}>
                              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a786f]">
                                {field.label}
                              </dt>
                              {/* Newlines preserved: a services list typed one
                                  per line is a list, and reflowing it into a
                                  paragraph destroys the only structure the
                                  customer gave it. */}
                              <dd className="mt-1.5 whitespace-pre-wrap text-[15px] leading-[1.65] text-[#e4e1d8]">
                                {displayAnswer(
                                  field,
                                  intake.answers[field.name].trim()
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    );
                  })}
                </div>

                <p className="mt-8 border-t border-[#33332f] pt-4 text-[13px] leading-[1.6] text-[#7a786f]">
                  Confirmed on submission: &ldquo;{intake.declarationText}&rdquo;
                </p>
              </details>
            );
          })}
        </div>
      </div>
    </main>
  );
}
