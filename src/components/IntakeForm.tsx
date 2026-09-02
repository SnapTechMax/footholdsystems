"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTAKE_DECLARATION,
  INTAKE_FIELDS,
  INTAKE_SECTIONS,
  REQUIRED_FIELD_COUNT,
  type IntakeField,
} from "@/lib/intake/questions";
import { HONEYPOT_FIELD } from "@/lib/spam";

/**
 * The build intake form.
 *
 * Every input on this page is generated from INTAKE_SECTIONS. Nothing here
 * knows what any individual question is, which is the point: a question added
 * to that file appears here, in the validator, in the notification email and on
 * the admin screen at the same time, and cannot be added to one and forgotten
 * in the others.
 *
 * IT SAVES A DRAFT TO localStorage ON EVERY KEYSTROKE. Thirty questions is
 * twenty minutes of somebody's evening, and the ways that work gets destroyed
 * are mundane — a closed tab, a dead battery, a phone call, a browser deciding
 * to reload the page it backgrounded an hour ago. Losing it once loses the
 * customer's goodwill and probably the answers for good, because nobody types
 * all that twice. The draft is per-browser and never leaves the device.
 *
 * Deliberately NOT a WebMCP tool, unlike the scan form next door. This one is
 * filled in by a named customer making commitments about their own business
 * after a purchase, and an agent that could submit it on their behalf would be
 * manufacturing exactly the record the declaration exists to make trustworthy.
 */

const DRAFT_KEY = "foothold:build-intake:v1";

const fieldBase =
  "w-full rounded-lg border bg-[var(--ink)] px-4 py-3.5 text-[16px] leading-[1.6] text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

function emptyAnswers(): Record<string, string> {
  return Object.fromEntries(INTAKE_FIELDS.map((field) => [field.name, ""]));
}

export function IntakeForm() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(emptyAnswers);
  const [declaration, setDeclaration] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const renderedAt = useRef<number | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const scanToken = useRef<string | null>(null);

  // Mount work: the clock the spam screen reads, the scan token if they came
  // from a report link, and any draft left from last time.
  useEffect(() => {
    renderedAt.current = Date.now();

    try {
      scanToken.current = new URLSearchParams(window.location.search).get("t");
    } catch {
      // A missing token costs a cross-reference in one email. Never the form.
    }

    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Record<string, unknown>;
      const next = emptyAnswers();
      let found = false;
      for (const field of INTAKE_FIELDS) {
        const value = parsed[field.name];
        if (typeof value === "string" && value !== "") {
          next[field.name] = value;
          found = true;
        }
      }
      if (found) {
        /*
         * The one setState in an effect here, and it is the case the rule
         * exists to permit: reading initial state out of an external system
         * that does not exist while the component is being server-rendered.
         *
         * It cannot move into the useState initializer, because that runs on
         * the server too and would hand the client a first render whose input
         * values differ from the markup it is hydrating. It cannot move behind
         * a button either without making "come back later and pick up where you
         * left off" into a thing the customer has to know to click.
         */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswers(next);
        setRestored(true);
      }
    } catch {
      // Private browsing, a full quota, or a draft written by an older version
      // of this form. An empty form is the correct fallback for all three.
    }
  }, []);

  const setField = useCallback((name: string, value: string) => {
    setAnswers((current) => {
      const next = { ...current, [name]: value };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Storage refused. The form still works; only the safety net is gone.
      }
      return next;
    });
    // Clearing the error on edit rather than on the next submit, so the red
    // outline goes away as soon as the thing it is complaining about changes.
    setErrorField((current) => (current === name ? null : current));
  }, []);

  const requiredDone = INTAKE_FIELDS.filter(
    (field) => field.required && (answers[field.name] ?? "").trim() !== ""
  ).length;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setErrorField(null);

    let response: Response;
    try {
      response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          declaration,
          declarationText: INTAKE_DECLARATION,
          scanToken: scanToken.current ?? undefined,
          elapsedMs:
            renderedAt.current === null
              ? undefined
              : Date.now() - renderedAt.current,
          [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
        }),
      });
    } catch {
      setError(
        "We couldn't reach the server. Your answers are still here and still saved in this browser, so check your connection and press the button again."
      );
      setPending(false);
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      field?: string;
    };

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setErrorField(data.field ?? null);
      setPending(false);

      // Take them to the problem. On a form this long a message at the bottom
      // of the page is a message nobody finds.
      if (data.field) {
        const target = document.getElementById(`intake-${data.field}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.focus({ preventScroll: true });
      }
      return;
    }

    // Only once the server has it. Clearing on submit rather than on success
    // would mean a failed request costs them everything they typed.
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing useful to do, and the submission already succeeded.
    }

    router.push("/start/thanks");
  }

  function renderField(field: IntakeField) {
    const id = `intake-${field.name}`;
    const invalid = errorField === field.name;
    const border = invalid ? "border-[var(--danger)]" : "border-[var(--line)]";
    const value = answers[field.name] ?? "";

    return (
      <div key={field.name}>
        <label
          htmlFor={id}
          className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]"
        >
          {field.label}
          {field.required ? (
            <span className="ml-2 text-[var(--accent)]">required</span>
          ) : null}
        </label>

        {field.hint ? (
          <p
            id={`${id}-hint`}
            className="mb-3 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--dim)]"
          >
            {field.hint}
          </p>
        ) : null}

        {field.kind === "textarea" ? (
          <textarea
            id={id}
            name={field.name}
            rows={field.rows ?? 4}
            maxLength={field.maxLength}
            value={value}
            onChange={(e) => setField(field.name, e.target.value)}
            placeholder={field.placeholder}
            aria-invalid={invalid}
            aria-describedby={field.hint ? `${id}-hint` : undefined}
            className={`${fieldBase} ${border} resize-y`}
          />
        ) : field.kind === "select" ? (
          <select
            id={id}
            name={field.name}
            value={value}
            onChange={(e) => setField(field.name, e.target.value)}
            aria-invalid={invalid}
            aria-describedby={field.hint ? `${id}-hint` : undefined}
            className={`${fieldBase} ${border} appearance-none bg-[image:var(--select-caret)] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-12`}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            name={field.name}
            type={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : "text"}
            inputMode={field.kind === "tel" ? "tel" : undefined}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            value={value}
            onChange={(e) => setField(field.name, e.target.value)}
            placeholder={field.placeholder}
            aria-invalid={invalid}
            aria-describedby={field.hint ? `${id}-hint` : undefined}
            className={`${fieldBase} ${border}`}
          />
        )}

        {invalid && error ? (
          <p role="alert" className="mt-2 text-[14px] leading-snug text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Decoy. Off-screen rather than display:none — some bots skip hidden
          fields, and a positioned input still gets filled. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD}>Company</label>
        <input
          ref={honeypotRef}
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {restored ? (
        <p className="mb-10 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[14px] leading-relaxed text-[var(--muted)]">
          We put back what you had typed last time. It was saved in this browser
          only, and it has not been sent to us yet.
        </p>
      ) : null}

      <div className="space-y-16">
        {INTAKE_SECTIONS.map((section, index) => (
          <section key={section.id} id={`section-${section.id}`}>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              {String(index + 1).padStart(2, "0")} of{" "}
              {String(INTAKE_SECTIONS.length).padStart(2, "0")}
            </p>
            <h2 className="mt-3 font-display text-[1.75rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
              {section.title}
            </h2>
            <p className="mt-3 max-w-[58ch] text-[16px] leading-[1.65] text-[var(--muted)]">
              {section.blurb}
            </p>

            <div className="mt-8 space-y-8 border-l border-[var(--line)] pl-5 sm:pl-7">
              {section.fields.map(renderField)}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
        <label
          htmlFor="intake-declaration"
          className="flex cursor-pointer items-start gap-3 text-left"
        >
          <input
            id="intake-declaration"
            name="declaration"
            type="checkbox"
            checked={declaration}
            onChange={(e) => {
              setDeclaration(e.target.checked);
              setErrorField((current) =>
                current === "declaration" ? null : current
              );
            }}
            aria-invalid={errorField === "declaration"}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
          />
          <span
            className={`text-[15px] leading-[1.6] ${
              errorField === "declaration"
                ? "text-[var(--danger)]"
                : "text-[var(--muted)]"
            }`}
          >
            {INTAKE_DECLARATION}
          </span>
        </label>

        {error && !errorField ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-[14px] leading-relaxed text-[var(--text)]"
          >
            {error}
          </p>
        ) : null}

        {error && errorField && errorField !== "declaration" ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-[14px] leading-relaxed text-[var(--text)]"
          >
            Something above needs fixing. We have scrolled you to it.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
        >
          {pending ? "Sending your answers…" : "Send this"}
          {!pending && (
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          )}
        </button>

        <p className="mt-4 text-center text-[13px] leading-relaxed text-[var(--dim)]">
          {requiredDone} of {REQUIRED_FIELD_COUNT} required answers filled in.
          The rest are optional and can wait for the call.
        </p>
      </div>
    </form>
  );
}
