/*
 * The behaviours a documentation block needs, wherever it is rendered.
 *
 * `demo.js` is the brand book's script: it reads elements only that page has —
 * the swatch host, the space slider, the footer's token count — and derefences
 * them without guards, so a second page cannot simply load it. These three are
 * page-agnostic by construction: each wires whatever it finds and does nothing
 * when it finds nothing, which is what lets `docs.html` load this file alone.
 *
 * Extracted rather than duplicated. Two copies of the avatar recipe would agree
 * by luck, and the point of this repo is that they don't have to.
 */
import { cssVar, gradientColors, rampPath } from "/dist/tokens.js";

/** `brand.purple` -> `purple` */
const label = (path) => path.split(".").pop();

const accentRamps = gradientColors.map(label);

/** Copies `text`, flashing `element` via a `data-copied` attribute. */
export async function copyToClipboard(element, text) {
  try {
    await navigator.clipboard.writeText(text);
    element.dataset.copied = "";
    setTimeout(() => delete element.dataset.copied, 1200);
  } catch {
    /* clipboard unavailable (insecure origin, denied permission) — ignore */
  }
}

/*
 * `Contributors` and `Backers` call the GitHub and Open Collective APIs. These
 * pages make no network requests, so they render what those components render
 * without credentials: John Doe, repeated. The avatars cycle the accent ramps
 * rather than loading images.
 */
for (const host of document.querySelectorAll("[data-people]")) {
  const count = host.dataset.people === "backers" ? 5 : 8;

  for (let i = 0; i < count; i++) {
    const name = accentRamps[i % accentRamps.length];

    const avatar = document.createElement("span");
    avatar.className = "doc-avatar";
    avatar.textContent = "JD";
    avatar.title = "John Doe";
    avatar.style.setProperty("--avatar", cssVar(rampPath(name, "400")));
    avatar.style.setProperty("--avatar-ink", cssVar(rampPath(name, "950")));
    host.append(avatar);
  }
}

/* Copy buttons on code blocks. */
for (const button of document.querySelectorAll("[data-copy]")) {
  const code = button.closest("figure")?.querySelector("code");
  if (!code) continue;

  button.addEventListener("click", async () => {
    await copyToClipboard(button, code.innerText);
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = "Copy"), 1200);
  });
}

/* Sandpack file tabs. */
for (const tablist of document.querySelectorAll("[data-sandpack-tabs]")) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute("aria-selected", String(selected));
        document.getElementById(other.getAttribute("aria-controls")).hidden =
          !selected;
      }
    });
  }
}
