#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

import { loadVoice } from "./lib/voice.mjs";
import { generateSet, randomSeed, STRUCTURES } from "./lib/copy.mjs";
import { ANGLES } from "./lib/angles.mjs";
import { CANVASES, COPY_LIMITS, placementCount } from "./lib/placements.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "public");
const OUT = join(HERE, "out");
const PORT = Number(process.env.PORT) || 4321;

/**
 * Local-only. Nothing here is on footholdsystems.com and nothing here should
 * be: it reads the context files off disk, writes PNGs to a folder, and has no
 * authentication because it is bound to the loopback interface.
 */
const voice = await loadVoice();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
};

const json = (res, code, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "content-type": MIME[".json"], "content-length": Buffer.byteLength(payload) });
  res.end(payload);
};

async function readBody(req, limitBytes = 120 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/api/boot") {
      return json(res, 200, {
        angles: ANGLES.map((a) => ({ id: a.id, name: a.name })),
        structures: STRUCTURES,
        canvases: CANVASES,
        limits: COPY_LIMITS,
        placementCount: placementCount(),
        signaturePhrases: voice.signaturePhrases,
      });
    }

    if (url.pathname === "/api/generate") {
      const seedParam = url.searchParams.get("seed");
      const seed = seedParam ? Number(seedParam) : randomSeed();
      if (!Number.isFinite(seed)) return json(res, 400, { error: "seed must be a number" });
      const angleId = url.searchParams.get("angle") || undefined;
      return json(res, 200, generateSet({ seed, angleId, voice }));
    }

    if (url.pathname === "/api/export" && req.method === "POST") {
      const payload = JSON.parse(await readBody(req));
      const written = await exportSet(payload);
      return json(res, 200, written);
    }

    if (url.pathname === "/api/reference") {
      const md = await readFile(join(HERE, "reference", "becker-swipe.md"), "utf8");
      res.writeHead(200, { "content-type": MIME[".md"] });
      return res.end(md);
    }

    // Static. normalize() then a prefix check, so ../ cannot climb out of public/.
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = normalize(join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403).end("no");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      // Chrome will heuristically cache JS served without headers, which on a
      // tool you are actively editing means rendering with yesterday's layout
      // engine and not being told. Never cache anything here.
      "cache-control": "no-store, max-age=0",
    });
    res.end(body);
  } catch (err) {
    if (err.code === "ENOENT") {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    console.error(err);
    json(res, 500, { error: err.message });
  }
});

/**
 * Write a generated set to disk as a folder you can upload from.
 *
 * The images arrive as data URLs because they were drawn in the browser, which
 * is the only place a canvas exists. Rendering them again server-side would
 * mean a second implementation of the layout engine and a native dependency,
 * and the two would drift.
 */
async function exportSet({ set, images }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const folder = join(OUT, `${stamp}-${set.angle.id}-seed${set.seed}`);
  await mkdir(folder, { recursive: true });

  const saved = [];
  for (const image of images) {
    const base64 = image.dataUrl.split(",")[1] ?? "";
    const dir = join(folder, image.conceptDir);
    await mkdir(dir, { recursive: true });
    const name = `${image.canvasId.replace(/\./g, "-")}.png`;
    const bytes = Buffer.from(base64, "base64");
    await writeFile(join(dir, name), bytes);
    saved.push({ path: join(image.conceptDir, name), bytes: bytes.length });
  }

  await writeFile(join(folder, "copy.txt"), copyTxt(set), "utf8");
  await writeFile(join(folder, "copy.csv"), copyCsv(set), "utf8");
  await writeFile(join(folder, "placements.md"), placementsMd(set, saved), "utf8");

  return { folder, files: saved.length + 3, saved };
}

function copyTxt(set) {
  const L = [];
  L.push("FOOTHOLD AEO · AD CREATIVE SET");
  L.push(`Seed ${set.seed} · angle: ${set.angle.name} · structure: ${set.structure.name}`);
  L.push(`Rebuild this exact set: /api/generate?seed=${set.seed}`);
  L.push("");
  L.push("PRIMARY TEXT");
  L.push("-".repeat(60));
  L.push(set.primaryText);
  L.push("");
  L.push(`HEADLINE (${set.headline.length}/${COPY_LIMITS.headline.soft})`);
  L.push(set.headline);
  L.push("");
  L.push(`DESCRIPTION (${set.description.length}/${COPY_LIMITS.description.soft})`);
  L.push(set.description);
  L.push("");
  L.push("CALL TO ACTION BUTTON");
  L.push(set.ctaLabel);
  L.push("");
  L.push(`FOLD CHECK: first line is ${set.measure.foldLine.length} characters. Meta truncates around ${COPY_LIMITS.primaryText.soft}.`);
  L.push("");
  L.push("VOICE CHECK");
  L.push(set.lint.length ? set.lint.map((p) => `  FAIL ${p.field}: ${p.rule}. ${p.why}`).join("\n") : "  Passes every rule in context/voice.md and context/offer.md.");
  return L.join("\n") + "\n";
}

const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;

function copyCsv(set) {
  const rows = [["field", "value", "characters", "meta_display_limit"]];
  rows.push(["primary_text", set.primaryText, set.primaryText.length, COPY_LIMITS.primaryText.soft]);
  rows.push(["fold_line", set.foldLine, set.foldLine.length, COPY_LIMITS.primaryText.soft]);
  rows.push(["headline", set.headline, set.headline.length, COPY_LIMITS.headline.soft]);
  rows.push(["description", set.description, set.description.length, COPY_LIMITS.description.soft]);
  rows.push(["cta_button", set.ctaLabel, set.ctaLabel.length, ""]);
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

function placementsMd(set, saved) {
  const L = [];
  L.push(`# Placement map · seed ${set.seed}`);
  L.push("");
  L.push(`Angle: **${set.angle.name}**. Structure: **${set.structure.name}**.`);
  L.push("");
  L.push("Same copy on all three. Upload one ad set with the three images as");
  L.push("separate ads, and let Meta pick the size per placement.");
  L.push("");
  for (const canvas of CANVASES) {
    L.push(`## ${canvas.ratio} · ${canvas.width}x${canvas.height} · ${canvas.label}`);
    L.push("");
    L.push(`\`${canvas.id.replace(/\./g, "-")}.png\` in each concept folder. ${canvas.note}`);
    if (canvas.safeZone) {
      L.push("");
      L.push(`Safe zone: top ${canvas.safeZone.top}px and bottom ${canvas.safeZone.bottom}px are covered by Reels chrome. Nothing important is drawn there.`);
    }
    L.push("");
    for (const p of canvas.placements) L.push(`- ${p}`);
    L.push("");
  }
  L.push(`${saved.length} images written.`);
  return L.join("\n") + "\n";
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  FootHold creative generator`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  ${ANGLES.length} angles · ${CANVASES.length} canvases · ${placementCount()} placements`);
  console.log(`  voice: context/voice.md (${voice.banned.length} banned words parsed)\n`);
});
