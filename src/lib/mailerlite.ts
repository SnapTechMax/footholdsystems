/**
 * MailerLite client.
 *
 * MailerLite owns the nurture sequence. Resend keeps two jobs: delivering the
 * guide itself, which has to be immediate, and telling Max a lead came in.
 *
 * Automations in MailerLite trigger on a subscriber joining a group, so adding
 * someone to the configured group is what starts the sequence. There is no
 * separate event to fire.
 *
 * The subscriber endpoint upserts: an address MailerLite already knows is
 * updated rather than rejected, and omitted fields are left alone. That means
 * this is safe to call for a repeat downloader.
 */

const ENDPOINT = "https://connect.mailerlite.com/api/subscribers";

export const MAILERLITE_CONFIGURED = () =>
  Boolean(process.env.MAILERLITE_API_KEY);

export interface UpsertSubscriberInput {
  email: string;
  /** Merged into MailerLite's fields. Keys must match fields defined there. */
  fields?: Record<string, string>;
  /** Group ids to add them to. Joining a group is what triggers an automation. */
  groups?: string[];
}

export interface UpsertResult {
  ok: boolean;
  /** 201 for a new subscriber, 200 for one MailerLite already had. */
  status: number | null;
  note?: string;
}

export async function upsertSubscriber({
  email,
  fields,
  groups,
}: UpsertSubscriberInput): Promise<UpsertResult> {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) {
    return { ok: false, status: null, note: "MAILERLITE_API_KEY is not set" };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
        ...(groups && groups.length > 0 ? { groups } : {}),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        note: (await response.text()).slice(0, 300),
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: null,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Add a lead-magnet downloader to the nurture group, which starts the sequence.
 *
 * Best-effort by design. The guide has already been delivered by the time this
 * runs, so a MailerLite outage must not turn a successful download into an error
 * for the person who asked for it.
 */
export async function subscribeToNurture(input: {
  email: string;
  firstName?: string;
  source: string;
}): Promise<UpsertResult> {
  const groupId = process.env.MAILERLITE_GROUP_ID;
  return upsertSubscriber({
    email: input.email,
    fields: {
      // MailerLite ships with `name` as a standard field.
      ...(input.firstName ? { name: input.firstName } : {}),
      source: input.source,
    },
    groups: groupId ? [groupId] : undefined,
  });
}
