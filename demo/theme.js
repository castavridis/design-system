/*
 * Theme toggle, shared by every page.
 *
 * Extracted rather than copied: two pages with their own copy of the
 * three-state logic is precisely the drift this repo exists to argue against,
 * and the storage-key would be the first thing to diverge.
 */
/*
 * Three states, not two: "light", "dark", and *unset* — follow the OS.
 *
 * Unset is the default and matters. `demo.css` resolves the mode through
 * `prefers-color-scheme` when no `data-theme` attribute is present, so leaving
 * it off means the page tracks the system. Writing an explicit value on first
 * load would silently opt every visitor out of that, which is why the
 * attribute is only ever set by a click or by a stored prior choice.
 */
const THEME_KEY = "pmndrs-theme";
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const prefersLight = matchMedia("(prefers-color-scheme: light)");

/** The mode actually rendering right now, explicit choice or OS. */
function activeTheme() {
  return (
    document.documentElement.dataset.theme ??
    (prefersLight.matches ? "light" : "dark")
  );
}

/** Point the control at whatever a click would switch *to*. */
function syncToggle() {
  const target = activeTheme() === "dark" ? "light" : "dark";
  themeToggle.dataset.target = target;
  themeLabel.textContent = target === "light" ? "Light" : "Dark";
  themeToggle.setAttribute("aria-label", `Switch to ${target} mode`);
}

themeToggle.addEventListener("click", () => {
  const next = activeTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;

  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* private mode or storage disabled — the choice just won't outlive the tab */
  }

  syncToggle();
});

/* A stored choice is an explicit one, so it wins over the OS on reload. */
try {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
} catch {
  /* unreadable storage is the same as no choice: follow the OS */
}

/* Track the OS while the visitor hasn't overridden it. */
prefersLight.addEventListener("change", () => {
  if (!document.documentElement.dataset.theme) syncToggle();
});

syncToggle();
