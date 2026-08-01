import type { Resend } from "resend";

/**
 * Adds a lead-magnet subscriber to the mailing list and kicks off the nurture
 * sequence.
 *
 * Two separate things, deliberately:
 *
 *  1. The contact is added to an Audience, which is what Broadcasts send to.
 *     Without this the address only ever exists as an automation side effect,
 *     and there is no list to mail when you want to send a one-off.
 *  2. An event is sent, which is what an Automation triggers on.
 *
 * Both are best-effort. The guide has already been delivered by the time this
 * runs, and failing to enrol someone must never turn a successful download into
 * an error for the person who asked for it.
 *
 * The sequence itself lives in scripts/email-sequence.mjs and is pushed to
 * Resend by scripts/create-email-sequence.mjs.
 */

const EVENT_NAME = "guide.downloaded";

export interface SubscribeInput {
  email: string;
  firstName?: string;
  source: string;
}

export interface SubscribeResult {
  addedToAudience: boolean;
  eventSent: boolean;
  notes: string[];
}

export async function subscribeToSequence(
  resend: Resend,
  { email, firstName, source }: SubscribeInput
): Promise<SubscribeResult> {
  const notes: string[] = [];
  let addedToAudience = false;
  let eventSent = false;

  // 1. Audience membership, so there's a real list for Broadcasts.
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    notes.push("RESEND_AUDIENCE_ID unset — contact not added to an audience");
  } else {
    try {
      const { error } = await resend.contacts.create({
        audienceId,
        email,
        ...(firstName ? { firstName } : {}),
      });
      // An already-present contact is a success for our purposes.
      if (error && !/already exists/i.test(error.message ?? "")) {
        notes.push(`audience: ${error.message}`);
      } else {
        addedToAudience = true;
      }
    } catch (error) {
      notes.push(`audience: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 2. Trigger the automation. Passing `email` rather than a contact id lets
  // Resend create the contact if it doesn't know them yet, so this works even
  // when the audience step above failed.
  try {
    const { error } = await resend.events.send({
      event: EVENT_NAME,
      email,
      payload: {
        first_name: firstName ?? "",
        source,
      },
    });
    if (error) {
      notes.push(`event: ${error.message}`);
    } else {
      eventSent = true;
    }
  } catch (error) {
    notes.push(`event: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { addedToAudience, eventSent, notes };
}
