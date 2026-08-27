import { renderAd, ensureFonts } from "/render.js";

const $ = (id) => document.getElementById(id);

let BOOT = null;
let SET = null;
/** conceptIndex -> { canvasId -> HTMLCanvasElement }. Rebuilt on every generate. */
let RENDERED = [];

const CONCEPT_DIRS = ["01-statement", "02-comparison", "03-answer-panel"];

async function boot() {
  BOOT = await fetch("/api/boot").then((r) => r.json());
  const select = $("angle");
  for (const a of BOOT.angles) {
    const option = document.createElement("option");
    option.value = a.id;
    option.textContent = a.name;
    select.append(option);
  }
  $("bootStat").textContent = `${BOOT.angles.length} angles · ${BOOT.canvases.length} sizes · ${BOOT.placementCount} placements`;
  await ensureFonts();
  await generate();
}

async function generate() {
  const button = $("generate");
  button.disabled = true;
  button.textContent = "Generating";

  const params = new URLSearchParams();
  const seed = $("seed").value.trim();
  if (seed) params.set("seed", seed);
  const angle = $("angle").value;
  if (angle) params.set("angle", angle);

  SET = await fetch(`/api/generate?${params}`).then((r) => r.json());
  $("seed").value = SET.seed;
  $("stage").hidden = false;

  paintCopy(SET);
  paintAds(SET);

  button.disabled = false;
  button.textContent = "Generate a set";
}

/* ----------------------------------------------------------------- copy -- */

function paintCopy(set) {
  $("angleNote").textContent =
    `Angle: ${set.angle.name}. Structure: ${set.structure.name}. ${set.structure.note} Seed ${set.seed}.`;

  paintPrimary(set);

  $("headline").textContent = set.headline;
  $("description").textContent = set.description;
  $("ctaLabel").textContent = set.ctaLabel;

  counter("foldCounter", set.measure.foldLine, "before See more");
  counter("headlineCounter", set.measure.headline);
  counter("descriptionCounter", set.measure.description);

  const lint = $("lint");
  lint.innerHTML = "";
  if (!set.lint.length) {
    lint.innerHTML = `<p class="lintOk">Passes every rule in context/voice.md and context/offer.md.</p>`;
  } else {
    for (const problem of set.lint) {
      const p = document.createElement("p");
      p.className = "lintBad";
      p.textContent = `${problem.field}: ${problem.rule} — ${problem.why}`;
      lint.append(p);
    }
  }
}

/**
 * Show where Meta cuts the copy.
 *
 * The truncation is on the whole primary text, not the first paragraph, so the
 * marker goes at the last word boundary before the limit. Everything after it
 * is dimmed because for most of the audience it does not exist.
 */
function paintPrimary(set) {
  const limit = BOOT.limits.primaryText.soft;
  const text = set.primaryText;
  const el = $("primaryText");
  el.innerHTML = "";

  if (text.length <= limit) {
    el.append(Object.assign(document.createElement("span"), { className: "fold", textContent: text }));
    return;
  }

  let cut = text.lastIndexOf(" ", limit);
  if (cut < limit * 0.6) cut = limit;

  el.append(Object.assign(document.createElement("span"), { className: "fold", textContent: text.slice(0, cut) }));
  el.append(Object.assign(document.createElement("span"), { className: "seemore", textContent: "See more" }));
  el.append(document.createTextNode(text.slice(cut).replace(/^\s+/, "")));
}

function counter(id, measure, suffix = "") {
  const el = $(id);
  el.textContent = `${measure.length} / ${measure.limit}${suffix ? ` ${suffix}` : ""}`;
  el.classList.toggle("over", measure.over);
  el.title = measure.note;
}

/* ------------------------------------------------------------------ ads -- */

function paintAds(set) {
  const host = $("ads");
  host.innerHTML = "";
  RENDERED = [];

  const overlay = $("safeZones").checked;

  set.concepts.forEach((concept, index) => {
    const node = $("adCard").content.cloneNode(true);
    const card = node.querySelector(".ad");
    card.querySelector("h3").textContent = `${index + 1}. ${concept.name}`;
    card.querySelector(".adHead .note").textContent = concept.note;

    const byCanvas = {};
    for (const canvas of BOOT.canvases) {
      byCanvas[canvas.id] = renderAd(concept, canvas, { safeZoneOverlay: overlay });
    }
    RENDERED.push(byCanvas);

    const holder = card.querySelector(".canvasHolder");
    const tabs = card.querySelector(".ratios");
    const dims = card.querySelector(".dims");
    const places = card.querySelector(".places");

    const show = (canvas) => {
      holder.replaceChildren(byCanvas[canvas.id]);
      dims.textContent = `${canvas.width} x ${canvas.height} · ${canvas.ratio}`;
      places.textContent = `${canvas.placements.length} placements: ${canvas.placements.join(", ")}.`;
      for (const b of tabs.children) b.classList.toggle("on", b.dataset.id === canvas.id);
      card.querySelector(".dl").onclick = () => download(byCanvas[canvas.id], concept, canvas);
    };

    for (const canvas of BOOT.canvases) {
      const button = document.createElement("button");
      button.textContent = canvas.ratio;
      button.dataset.id = canvas.id;
      button.title = `${canvas.label} — ${canvas.note}`;
      button.onclick = () => show(canvas);
      tabs.append(button);
    }

    // 4:5 first. It takes the most vertical space on a phone, which is where
    // the delivery is.
    show(BOOT.canvases.find((c) => c.id === "4x5") ?? BOOT.canvases[0]);
    host.append(node);
  });
}

function download(canvas, concept, spec) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foothold-${SET.seed}-${concept.id}-${spec.id.replace(/\./g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/* --------------------------------------------------------------- export -- */

async function exportAll() {
  const button = $("exportAll");
  button.disabled = true;
  button.textContent = "Writing";

  const images = [];
  RENDERED.forEach((byCanvas, index) => {
    for (const canvas of BOOT.canvases) {
      images.push({
        conceptDir: CONCEPT_DIRS[index],
        canvasId: canvas.id,
        dataUrl: byCanvas[canvas.id].toDataURL("image/png"),
      });
    }
  });

  try {
    const result = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ set: SET, images }),
    }).then((r) => r.json());

    if (result.error) throw new Error(result.error);
    $("exportNote").innerHTML = `${result.files} files written to <code>${result.folder}</code>`;
  } catch (err) {
    $("exportNote").textContent = `Export failed: ${err.message}`;
  }

  button.disabled = false;
  button.textContent = "Write all 15 PNGs and the copy files";
}

/* ---------------------------------------------------------------- wiring -- */

$("generate").onclick = () => {
  // A new click means a new set unless a seed was typed on purpose.
  if (document.activeElement !== $("seed")) $("seed").value = "";
  generate();
};
$("angle").onchange = () => { $("seed").value = ""; generate(); };
$("safeZones").onchange = () => SET && paintAds(SET);
$("exportAll").onclick = exportAll;

for (const button of document.querySelectorAll(".copyBtn")) {
  button.onclick = async () => {
    await navigator.clipboard.writeText(SET[button.dataset.copy]);
    const was = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = was), 1200);
  };
}

boot();
