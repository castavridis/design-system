/*
 * Theme toggle, shared by every page.
 *
 * Extracted rather than copied: two pages with their own copy of the
 * three-state logic is precisely the drift this repo exists to argue against,
 * and the storage-key would be the first thing to diverge.
 */
/*
 * Two states: "light" and "dark". Absent the attribute, `demo.css` renders
 * dark — that is the default now, not the OS's preference, because the brand
 * book is composed on a dark ground and a light-preferring OS would otherwise
 * decide that for the visitor.
 *
 * The attribute is still only written by a click or a stored prior choice, so
 * "no attribute" continues to mean "hasn't chosen" rather than "chose dark".
 * The two look identical today; keeping them distinct is what would let a
 * future default change apply to visitors who never touched the toggle.
 */
const THEME_KEY = "pmndrs-theme";
const DEFAULT_THEME = "dark";
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");

/** The mode actually rendering right now: explicit choice, or the default. */
function activeTheme() {
  return document.documentElement.dataset.theme ?? DEFAULT_THEME;
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

/* A stored choice is an explicit one, so it wins over the default on reload. */
try {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
} catch {
  /* unreadable storage is the same as no choice: take the default */
}

syncToggle();
