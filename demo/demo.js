/*
 * The page's only JavaScript dependency is the generated token module.
 * No framework, no build step — this file is served as-is to the browser.
 */
import {
  colorPaths,
  cssVar,
  gradient,
  gradientColors,
  gradientStops,
  rampNames,
  rampPath,
  rampSeeds,
  rampShades,
  randomGradient,
  tokens,
  tokenPaths,
  varName,
} from "/dist/tokens.js";

/** `brand.purple` -> `purple` */
const label = (path) => path.split(".").pop();

/**
 * Ink that stays legible on `hex`.
 *
 * The crossover between black and white text sits at a relative luminance of
 * about 0.18 — above it black wins, below it white does. Computed rather than
 * guessed per step, because the ramps are spaced perceptually and the flip
 * point lands on a different step for every hue.
 */
function readableInk(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);

  return luminance > 0.18 ? "ramp.dark-950" : "ramp.light-50";
}

/*
 * The blocks any page can carry — people, copy buttons, sandpack tabs — and the
 * clipboard helper they share with the swatches below. Importing it for the
 * side effect is the point: this page has those blocks too.
 */
import { copyToClipboard } from "./blocks.js";

/* ---------- palette, generated from the token map ---------- */

/*
 * The brand colours only. Every ramp step is a colour token too, so the
 * unfiltered list would bury the nine originals under ninety-nine
 * derivatives — those get their own section below, laid out as scales.
 */
const brandColorPaths = colorPaths.filter((path) => path.startsWith("brand."));

const swatchHost = document.querySelector("[data-swatches]");

for (const path of brandColorPaths) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.style.setProperty("--swatch", `var(${varName(path)})`);
  swatch.title = `Copy ${cssVar(path)}`;
  swatch.innerHTML = `
		<span class="swatch-chip"></span>
		<span class="swatch-meta">
			<span class="swatch-path">${path}</span>
			<span class="swatch-value">${tokens[path]}</span>
		</span>`;

  swatch.addEventListener("click", () =>
    copyToClipboard(swatch, cssVar(path)),
  );

  swatchHost.append(swatch);
}

/* ---------- ramps ---------- */

/*
 * One row per ramp, every row built from `rampNames` × `rampShades`. The page
 * never names a colour: which ramps exist, how many steps they have, and which
 * step holds the brand value all come from the token module, so this section
 * can't drift out of step with the design book.
 */
const rampHost = document.querySelector("[data-ramps]");

for (const name of rampNames) {
  const seed = rampSeeds[name];

  const row = document.createElement("div");
  row.className = "ramp";

  const head = document.createElement("p");
  head.className = "ramp-head";
  head.innerHTML = `
		<span class="ramp-name">ramp.${name}</span>
		<span class="ramp-seed">brand.${name} sits at ${seed}</span>`;

  const steps = document.createElement("div");
  steps.className = "ramp-steps";

  for (const shade of rampShades) {
    const path = rampPath(name, shade);
    const hex = tokens[path];

    const step = document.createElement("button");
    step.type = "button";
    step.className = "ramp-step";
    step.style.setProperty("--step", cssVar(path));
    step.style.setProperty("--step-ink", cssVar(readableInk(hex)));
    step.title = `Copy ${cssVar(path)}`;
    if (shade === seed) step.dataset.seed = "";

    step.innerHTML = `
			<span class="ramp-step-shade">${shade}</span>
			<span class="ramp-step-hex">${hex}</span>`;

    step.addEventListener("click", () => copyToClipboard(step, cssVar(path)));
    steps.append(step);
  }

  row.append(head, steps);
  rampHost.append(row);
}

/* ---------- gradient generator ---------- */

const gradientUi = {
  preview: document.querySelector("[data-gradient-preview]"),
  controls: document.querySelector("[data-gradient-controls]"),
  output: document.querySelector("[data-gradient-css]"),
  randomise: document.querySelector("[data-gradient-random]"),
  copy: document.querySelector("[data-gradient-copy]"),
};

/* Opening selection: the first three palette colours, which are guaranteed
   distinct and therefore already satisfy the adjacency rule. */
let selection = gradientColors.slice(0, gradientStops.length);

const selects = gradientStops.map((stop, index) => {
  const field = document.createElement("label");
  field.className = "gradient-field";
  field.innerHTML = `<span class="gradient-field-label">Stop ${index + 1} · ${stop}%</span>`;

  const select = document.createElement("select");
  select.className = "gradient-select";

  for (const path of gradientColors) {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = label(path);
    select.append(option);
  }

  select.addEventListener("change", () => {
    selection[index] = select.value;
    render();
  });

  field.append(select);
  gradientUi.controls.append(field);
  return select;
});

/*
 * `gradient()` throws on an illegal selection, so the UI never offers one:
 * an option is disabled when picking it would collide with an adjacent stop.
 * The rule lives in the token module — this only reflects it.
 */
function syncOptions() {
  selects.forEach((select, index) => {
    select.value = selection[index];

    const neighbours = new Set([selection[index - 1], selection[index + 1]]);
    for (const option of select.options) {
      option.disabled = neighbours.has(option.value);
    }
  });
}

function render() {
  syncOptions();

  const css = gradient(selection);
  gradientUi.preview.style.backgroundImage = css;
  gradientUi.output.textContent = css.replace(/, /g, ",\n  ");
}

gradientUi.randomise.addEventListener("click", () => {
  /* Re-derive the selection from the generated CSS so the displayed dropdowns
     always agree with what `randomGradient()` actually produced. */
  const css = randomGradient();
  selection = [...css.matchAll(/var\(--([a-z-]+)\)/g)].map(
    (match) => `brand.${match[1].replace(/^brand-/, "")}`,
  );
  render();
});

gradientUi.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`background-image: ${gradient(selection)};`);
    gradientUi.copy.textContent = "Copied";
    setTimeout(() => (gradientUi.copy.textContent = "Copy CSS"), 1200);
  } catch {
    /* clipboard unavailable — ignore */
  }
});

render();

/* ---------- live reference demo ---------- */

/*
 * `--brand-radius` is emitted as `var(--brand-space)`, so overriding the one
 * input cascades to every dependent token without touching them directly.
 */
const slider = document.querySelector("[data-space]");
const readout = document.querySelector("[data-space-value]");

const applySpace = () => {
  const next = `${slider.value}px`;
  document.documentElement.style.setProperty(varName("brand.space"), next);
  readout.textContent = next;
};

slider.addEventListener("input", applySpace);
applySpace();

/* ---------- component waterfall ---------- */

/*
 * Badges used to be generated here. They are now `<pmndrs-badge ramp="teal">`
 * in the markup, rendered by demo/elements.js from the component contract —
 * the same declaration that will drive their Figma variants and Code Connect
 * map. Generating them from a local loop meant the recipe lived in three
 * places and agreed by luck.
 */

/* ---------- footer ---------- */

document.querySelector("[data-token-count]").textContent = String(
  tokenPaths.length,
);
