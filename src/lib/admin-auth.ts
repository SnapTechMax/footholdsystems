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

/** Pull the password half out of a `Basic base64(user:pass)` header. */
export function passwordFromBasicHeader(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
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
