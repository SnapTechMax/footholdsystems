/**
 * One response shape for every markdown document the site serves.
 *
 * Three headers, and each one is a check that was failing on 2026-08-27:
 *
 *   Content-Type: text/markdown
 *     markdown-negotiation and markdown-url-fallback both require the body to
 *     arrive typed as markdown. Serving the right bytes under text/html reads
 *     to an agent as HTML that happens to contain hashes.
 *
 *   Vary: Accept
 *     markdown-negotiation-vary, 0/1. Without it a CDN is free to hand the
 *     cached HTML variant to an agent that asked for markdown, or the markdown
 *     to a browser, depending only on which one landed in the cache first. The
 *     proxy negotiates on Accept, so every response that could have been
 *     negotiated has to say so — including these, which are the targets it
 *     rewrites to.
 *
 *   Link: rel="canonical"
 *     Points back at the HTML page this is a twin of, so the markdown copy
 *     cannot be mistaken for a second, competing URL for the same content.
 */

export function markdownResponse(
  body: string,
  contentType = "text/markdown; charset=utf-8"
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      Vary: "Accept",
      // Short, because these are generated from constants that change with a
      // deploy anyway, and a stale price is the one thing they must not serve.
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate",
    },
  });
}

/**
 * A /.well-known JSON manifest.
 *
 * Pretty-printed rather than minified, which is not a habit worth having on a
 * hot API but is the right call here: these are read by people debugging why an
 * agent cannot see a site as often as by the agents themselves, and the whole
 * payload is under 4KB.
 */
export function jsonManifestResponse(body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Discovery documents are meant to be fetched by strangers.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate",
    },
  });
}
