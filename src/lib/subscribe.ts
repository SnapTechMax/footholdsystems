import type { Resend } from "resend";

/**
 * Adds a scan requester to the mailing list and kicks off the nurture sequence.
 *
 * Two separate things, deliberately:
 *
 *  1. The contact is added to an Audience, which is what Broadcasts send to.
 *     Without this the address only ever exists as an automation side effect,
 *     and there is no list to mail when you want to send a one-off.
 *  2. An event is sent, which is what an Automation triggers on.
 *
 * Both are best-effort, and deliberately so. The scan has already been accepted
 * by the time this runs, and a Resend outage must never turn a successful scan
 * request into an error for the person who asked for it. Every failure is
 * collected in `notes` for the caller to log rather than thrown.
 *
 * The sequence itself lives in content/nurture-sequence.mjs and is pushed to
 * Resend by scripts/create-email-sequence.mjs. The event name below has to
 * match TRIGGER_EVENT in that script or the automation never fires, and nothing
 * anywhere will report that it did not.
 */

/**
 * Automation trigger.
 *
 * Renamed from `guide.downloaded` when the offer changed. The old event still
 * exists in Resend and the old automation is still listening to it, which is
 * what keeps anyone mid-sequence on the guide flow undisturbed: they are on a
 * different trigger, so nothing sent from here reaches them.
 */
const EVENT_NAME = "scan.requested";

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
        // Always set, never omitted. FIRST_NAME is a reserved variable in
        // Resend, so a template cannot declare a fallback for it, which makes
        // this the only place a missing name can be handled. Leaving it empty
        // opens every email with "Hi ,".
        firstName: firstName?.trim() || "there",
      });
      // An already-present contact is a success for our purposes. Matched on
      // status rather than message text, because Resend's wording for a conflict
      // varies by endpoint and a phrase match silently stops matching.
      if (error && error.statusCode !== 409) {
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

  // 3. Guarantee the contact has a name.
  //
  // Two ways it otherwise ends up blank, and both are the normal path rather
  // than edge cases:
  //
  //   - With no audience configured, step 1 is skipped entirely and the contact
  //     is created by the event above, which carries no name.
  //   - A contact that already exists makes step 1 return 409 without updating
  //     anything, so a repeat downloader keeps whatever it had, which is
  //     usually nothing.
  //
  // Every email opens "Hi {{{FIRST_NAME}}}," and FIRST_NAME is reserved in
  // Resend, so no template-level fallback is possible. This is the only place
  // it can be fixed. Runs after the event so the contact is certain to exist,
  // which is safe because the first email is a day away.
  //
  // `contacts.update` takes an email and does not require an audience, which is
  // what makes this work where `contacts.create` cannot.
  try {
    const { error } = await resend.contacts.update({
      email,
      firstName: firstName?.trim() || "there",
    });
    if (error) notes.push(`name: ${error.message}`);
  } catch (error) {
    notes.push(`name: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { addedToAudience, eventSent, notes };
}
