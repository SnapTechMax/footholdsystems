/**
 * The admin password check, in one place.
 *
 * Split out of proxy.ts because the proxy is not the only thing that needs it,
 * and it was the only thing doing it.
 *
 * Next.js guidance is explicit that a Server Action must authorise itself and
 * must not lean on middleware. An action is dispatched by an id carried in the
 * `Next-Action` header, and the request it rides on does not have to be a POST
 * to the route the action was written for — so a matcher of `/admin/:path*` is
 * not the boundary it looks like. `resetCroEngine` deletes every experiment,
 * event and baseline row with no undo, and its only other guard was a
 * confirmation string that is a constant in this repository.
 *
 * Deliberately no import of `next/server` or `next/headers`: the proxy runtime
 * and the Node runtime both call this, and it takes a header string so neither
 * has to care.
 */

/**
 * Is this Authorization header the admin password?
 *
 * Fails shut. With ADMIN_PASSWORD unset nothing is authorised, which matches
 * the proxy's behaviour of closing the dashboard rather than opening it.
 */
export function isAdminAuthorised(authorizationHeader: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;

  const supplied = passwordFromBasicHeader(authorizationHeader);
  if (supplied === null) return false;

  return timingSafeEqual(supplied, password);
}

/**
 * Pull the password half out of a `Basic base64(user:pass)` header.
 *
 * THE DECODE IS TWO STEPS ON PURPOSE. `atob` alone returns a binary string, one
 * character per byte, which is Latin-1 and not the password. Clients encode the
 * credentials as UTF-8, so any character outside ASCII arrives as several bytes
 * and `atob` hands back one character for each of them: `café` comes out as the
 * five-character `cafÃ©` and is compared against a four-character environment
 * variable. The length check in `timingSafeEqual` then rejects it before
 * comparing anything.
 *
 * That made a non-ASCII admin password impossible to authenticate with — not
 * unreliable, impossible, and with nothing in the response to say why. It cost
 * a real debugging session.
 *
 * `TextDecoder` rather than `Buffer`, because this runs in the proxy as well as
 * in Node and `Buffer` does not exist in that runtime. It is deliberately
 * non-fatal: malformed UTF-8 becomes replacement characters, which cannot match
 * a real password, and failing the comparison is better than throwing.
 *
 * STILL NOT HANDLED: Unicode normalization. `café` typed as NFC and as NFD are
 * different strings and only one of them will match what is stored. Left alone
 * rather than normalized, because making two different secrets both open the
 * door is not a fix to apply quietly. Use ASCII if this ever bites.
 */
export function passwordFromBasicHeader(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const binary = atob(header.slice(6));
    // atob only ever yields code points 0-255, so this is a faithful byte view.
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    // Split on the first colon only: a password may contain colons, a username
    // may not.
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return decoded.slice(separator + 1);
  } catch {
    // Malformed base64.
    return null;
  }
}

/** Constant-time comparison so the response time can't be used to guess. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
