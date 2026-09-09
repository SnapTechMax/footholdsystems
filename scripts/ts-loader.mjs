/**
 * Lets plain Node run the TypeScript under src/ without a build step or a
 * dependency: `node --import ./scripts/ts-loader.mjs scripts/local-scan.ts`.
 *
 * Node 22 can strip types itself (module.stripTypeScriptTypes); what it
 * cannot do is resolve the two things Next.js resolves for us — the `@/`
 * alias and extension-less relative imports — or the `server-only` marker,
 * which only exists inside a Next build. The hooks in ts-hooks.mjs do those
 * three things and nothing else.
 */
import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);
