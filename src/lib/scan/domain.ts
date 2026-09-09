/**
 * Normalises whatever someone typed into a bare hostname.
 *
 * People paste "https://www.example.com/contact?utm=x", type "example.com", or
 * type "Example.COM ". The scans table dedupes on the domain and the scanner
 * probes it as an origin, so three spellings of one site have to become one
 * string before anything else sees them.
 *
 * Returns null rather than throwing: the caller turns that into a field-level
 * validation message, and an exception here would be caught as a server error.
 */
export function normaliseDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let host: string;
  try {
    const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  // Strip a leading www. so www.x.com and x.com are one row, not two.
  host = host.replace(/^www\./, "");

  // Must look like a real public hostname: at least one dot, a plausible TLD,
  // and no characters that have no business in one.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  if (!/\.[a-z]{2,}$/.test(host)) return null;

  // Nobody is buying AEO for localhost, and scanning internal hosts from our
  // server is a request-forgery shape we simply decline to have.
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null;
  }

  return host;
}
