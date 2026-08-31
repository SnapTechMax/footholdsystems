import "server-only";
import { Resend } from "resend";
import { updateContact } from "@/lib/resend-contact";

/**
 * Flags the Resend contact so the nurture automation's condition step ends
 * their run.
 *
 * Every remaining email in that sequence pitches the thing they have just
 * bought, and the fastest way to turn a new customer into an unsubscribe is to
 * keep selling to them.
 *
 * The property name has to match CONVERTED_PROPERTY in
 * scripts/create-email-sequence.mjs. Resend contact properties are string or
 * number only, hence "yes" rather than a boolean.
 *
 * Lives here rather than inside the webhook route because the purchase
 * simulator needs the same behaviour, and a second copy would be a second thing
 * to keep in step with that script.
 *
 * Never throws. It runs after the money is recorded, and a contact update
 * failing is an annoyance rather than a loss.
 *
 * Goes through `updateContact` rather than the SDK directly because the address
 * arrives from `scan_leads`, which lowercases, while the contact was created in
 * whatever case the buyer typed. Resend matches byte for byte, so the direct
 * call answered 404 for anyone who used capitals and this returned false while
 * the sequence carried on selling them what they had just bought.
 */
export async function markConverted(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const property = process.env.SEQUENCE_CONVERTED_PROPERTY || "converted";

  const outcome = await updateContact(new Resend(apiKey), email, {
    properties: { [property]: "yes" },
  });

  if (outcome === "not-found") {
    // Normal for a cold-outbound buyer: they were sent an audit link by hand
    // and never ran a scan, so there is no contact and no sequence to end.
    console.info(`[converted] no Resend contact for ${email} — nothing to mark.`);
    return false;
  }
  if (outcome === "failed") {
    console.error(`[converted] could not mark ${email} — see the error above.`);
    return false;
  }
  return true;
}
