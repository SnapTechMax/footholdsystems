import "server-only";
import type { Resend } from "resend";

/**
 * Reaching a Resend contact by email address, whatever case it was stored in.
 *
 * WHY THIS EXISTS. Resend matches a contact's address byte for byte. It keeps
 * whatever string the contact was created with, and every lookup or update by
 * email compares against that exact string — so a contact created as
 * LIDIA@EASTAXPREP.COM cannot be reached as lidia@eastaxprep.com. The API
 * answers 404 and the SDK reports it as an ordinary error, which is the worst
 * possible shape for this: nothing throws, nothing retries, and the caller
 * carries on believing it updated somebody.
 *
 * `scan_leads` lowercases on write and the scan form does not, so the database
 * and Resend disagree about the same person the moment anyone types their
 * address with caps lock on. Every update driven from a database row was
 * therefore a no-op for that person — `markConverted` after a purchase, the
 * `booked` flag from Calendly — and the visible symptom would have been a
 * customer being sold, for another five weeks, the thing they had just bought.
 *
 * Two halves, and both are needed. `canonicalEmail` stops new contacts being
 * created in a form the database can never match. `findContact` reaches the
 * ones already stored that way, which no amount of writing correctly can fix.
 */

/**
 * The form of an address to hand to Resend.
 *
 * Lowercased, to match what `scan_leads` stores, so a contact created here can
 * be found again from a database row. Addresses are case-insensitive at the
 * domain and in practice at the mailbox too — no mail server anyone sells to
 * treats Lidia@ and lidia@ as two people — so this loses nothing.
 */
export function canonicalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Contacts read per request by the fallback scan. Resend's ceiling is 100. */
const PAGE_SIZE = 100;

/**
 * Pages the fallback scan will read before giving up.
 *
 * 2,000 contacts, which is far past the list today and still bounded, because
 * this runs inside an unsubscribe that somebody is waiting on. A list big
 * enough to exhaust it has outgrown the fallback entirely, and the warning
 * below is what says so rather than a lookup that quietly finds nothing.
 */
const MAX_PAGES = 20;

/**
 * Finds a contact by address, ignoring case.
 *
 * Returns the address **as Resend stored it** along with the id, because that
 * string is the only one that will match on a later call. `events.send` takes
 * an address rather than an id and creates a contact when it does not
 * recognise one, so handing it the canonical form for somebody stored in
 * capitals would enrol a second copy of the same person.
 *
 * Paging the list is the only case-insensitive search Resend offers.
 */
export async function findContact(
  resend: Resend,
  email: string
): Promise<{ id: string; email: string } | null> {
  const wanted = canonicalEmail(email);
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await resend.contacts.list(
      after ? { limit: PAGE_SIZE, after } : { limit: PAGE_SIZE }
    );
    if (error || !data) {
      console.error(
        `[resend-contact] could not list contacts: ${error?.message ?? "no data"}`
      );
      return null;
    }

    for (const contact of data.data) {
      if (canonicalEmail(contact.email) === wanted) {
        return { id: contact.id, email: contact.email };
      }
    }

    const last = data.data[data.data.length - 1];
    if (!data.has_more || !last) return null;
    after = last.id;
  }

  console.warn(
    `[resend-contact] gave up looking for a contact after ${MAX_PAGES * PAGE_SIZE} rows. ` +
      "The list has outgrown the case-insensitive fallback — store contact ids instead."
  );
  return null;
}

/**
 * What happened, told apart because the callers want different things.
 *
 * `not-found` is a normal answer, not a failure: somebody can unsubscribe from
 * a report email without Resend ever having held a contact for them. `failed`
 * is the one worth waking someone for.
 */
export type ContactUpdate = "updated" | "not-found" | "failed";

/** Everything updatable. `id` and `email` are the selector, not part of it. */
export interface ContactPatch {
  unsubscribed?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, string | number | null>;
}

/**
 * Updates a contact found by address, falling back to a case-insensitive scan.
 *
 * The direct call goes first because it is right for every contact created
 * since `canonicalEmail` existed, and costs one request. Only a 404 is worth a
 * second attempt — anything else is Resend being unwell, and paging the whole
 * contact list is not the response to that.
 *
 * Never throws. Every caller runs after the thing that actually mattered has
 * already been recorded.
 */
export async function updateContact(
  resend: Resend,
  email: string,
  patch: ContactPatch
): Promise<ContactUpdate> {
  const address = canonicalEmail(email);

  try {
    const { error } = await resend.contacts.update({ email: address, ...patch });
    if (!error) return "updated";

    if (error.statusCode !== 404) {
      console.error(`[resend-contact] update failed for ${address}:`, error.message);
      return "failed";
    }

    // Not found by address. Either the stored contact differs only in case, or
    // there is no contact. One scan tells the two apart.
    const existing = await findContact(resend, address);
    if (!existing) return "not-found";

    const retry = await resend.contacts.update({ id: existing.id, ...patch });
    if (retry.error) {
      console.error(
        `[resend-contact] update failed for ${address} (id ${existing.id}):`,
        retry.error.message
      );
      return "failed";
    }

    console.info(
      `[resend-contact] ${address} is stored as ${existing.email} and was updated by id.`
    );
    return "updated";
  } catch (error) {
    console.error(`[resend-contact] update threw for ${address}:`, error);
    return "failed";
  }
}
