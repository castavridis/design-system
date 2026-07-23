/*
 * The page's only JavaScript dependency is the generated token module.
 * No framework, no build step — this file is served as-is to the browser.
 */
import {
  colorPaths,
  gradient,
  gradientColors,
  gradientStops,
  randomGradient,
  tokens,
  tokenPaths,
  varName,
} from "/dist/tokens.js";

/** `brand.purple` -> `purple` */
const label = (path) => path.split(".").pop();

/* ---------- palette, generated from the token map ---------- */

const swatchHost = document.querySelector("[data-swatches]");

for (const path of colorPaths) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.style.setProperty("--swatch", `var(${varName(path)})`);
  swatch.title = `Copy ${varName(path)}`;
  swatch.innerHTML = `
		<span class="swatch-chip"></span>
		<span class="swatch-meta">
			<span class="swatch-path">${path}</span>
			<span class="swatch-value">${tokens[path]}</span>
		</span>`;

  swatch.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`var(${varName(path)})`);
      swatch.dataset.copied = "";
      setTimeout(() => delete swatch.dataset.copied, 1200);
    } catch {
      /* clipboard unavailable (insecure origin, denied permission) — ignore */
    }
  });

  swatchHost.append(swatch);
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

/* ---------- footer ---------- */

document.querySelector("[data-token-count]").textContent = String(
  tokenPaths.length,
);
