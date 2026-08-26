import "server-only";
import { Resend } from "resend";

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
 */
export async function markConverted(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const property = process.env.SEQUENCE_CONVERTED_PROPERTY || "converted";
  try {
    const { error } = await new Resend(apiKey).contacts.update({
      email,
      properties: { [property]: "yes" },
    });
    if (error) {
      console.error(`[converted] could not mark ${email}:`, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[converted] contact update threw:", error);
    return false;
  }
}
