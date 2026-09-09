import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

/** `server-only` throws by design outside a Next.js server build. Here it is nothing. */
const EMPTY_MODULE = "data:text/javascript,";

function isFile(candidate) {
  return existsSync(candidate) && statSync(candidate).isFile();
}

/** Resolves an extension-less TypeScript path the way `moduleResolution: bundler` does. */
function resolveTs(basePath) {
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    path.join(basePath, "index.ts"),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true };

  let target = null;
  if (specifier.startsWith("@/")) {
    target = fileURLToPath(new URL(specifier.slice(2), SRC));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    target = fileURLToPath(new URL(specifier, context.parentURL));
  }
  if (target) {
    const found = resolveTs(target);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith("file:") && /\.(ts|mts|tsx)$/.test(url)) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: stripTypeScriptTypes(source, { mode: "transform" }),
      shortCircuit: true,
    };
  }
  return next(url, context);
}
