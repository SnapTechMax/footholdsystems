import {
  INTAKE_SECTIONS,
  displayAnswer,
  type IntakeAnswers,
} from "./questions";

/**
 * One submission, rendered as markdown.
 *
 * This is the "easily digestible format" the whole form exists to produce. It
 * is the plain-text half of the notification email and the thing the copy
 * button on the admin screen puts on the clipboard, so a submission can be
 * pasted straight into notes, a brief, or a prompt without anyone
 * reformatting it.
 *
 * Client-safe on purpose — the admin screen's copy button runs in the browser —
 * so no server-only import here.
 *
 * UNANSWERED FIELDS ARE OMITTED. Most of the form is optional and a lot of it
 * will be blank; printing thirty "not answered" lines would bury the twelve
 * answers that matter. A whole section with nothing in it disappears too.
 */

export interface IntakeMeta {
  submittedAt: string;
  /** Absolute link to their scan report, when they came from one. */
  scanUrl?: string | null;
  /** The wording they confirmed. Part of the record, so it is printed. */
  declarationText?: string;
}

export function intakeMarkdown(
  answers: IntakeAnswers,
  meta: IntakeMeta
): string {
  const lines: string[] = [];
  const business = answers.business_name?.trim() || "Unnamed business";

  lines.push(`# Build intake: ${business}`);
  lines.push("");
  lines.push(
    `Submitted ${new Date(meta.submittedAt).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Los_Angeles",
    })} PT`
  );
  if (meta.scanUrl) lines.push(`Their scan report: ${meta.scanUrl}`);
  lines.push("");

  for (const section of INTAKE_SECTIONS) {
    const answered = section.fields.filter(
      (field) => (answers[field.name] ?? "").trim() !== ""
    );
    if (answered.length === 0) continue;

    lines.push(`## ${section.title}`);
    lines.push("");

    for (const field of answered) {
      const value = displayAnswer(field, answers[field.name].trim());
      lines.push(`**${field.label}**`);
      lines.push("");
      // Multi-line answers stay multi-line. A services list typed one per line
      // is a list, and flattening it into a paragraph destroys the only
      // structure the customer gave it.
      lines.push(value);
      lines.push("");
    }
  }

  const missing = INTAKE_SECTIONS.flatMap((section) => section.fields).filter(
    (field) => (answers[field.name] ?? "").trim() === ""
  );
  if (missing.length > 0) {
    lines.push("## Left blank");
    lines.push("");
    // A flat list rather than a section each. It is a checklist for the kickoff
    // call, not content.
    for (const field of missing) lines.push(`- ${field.label}`);
    lines.push("");
  }

  if (meta.declarationText) {
    lines.push("---");
    lines.push("");
    lines.push(`Confirmed on submission: "${meta.declarationText}"`);
    lines.push("");
  }

  return lines.join("\n");
}
