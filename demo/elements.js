/*
 * Custom elements for the components that have variants.
 *
 * Light DOM on purpose — each element renders into itself, so every existing
 * `demo.css` selector keeps matching and the `var(--ramp-*)` cascade is
 * untouched. Shadow DOM would encapsulate styles this page doesn't want
 * encapsulated, and would have meant rewriting the stylesheet to gain nothing.
 *
 * Variants come from `dist/component-contract.js` rather than being hardcoded
 * here, so the element, the Figma component and the Code Connect map all read
 * one declaration. An unknown variant is a visible error, not a silent
 * fallback — a typo that renders *something* is worse than one that renders
 * nothing, because it survives review.
 */
import { components } from "/dist/component-contract.js";

const spec = (name) => components.find((c) => c.name === name);

/** Reads an enum prop, falling back to the contract's declared default. */
function variantOf(element, componentSpec) {
	const prop = componentSpec.variantProp;
	const declared = componentSpec.props[prop];
	const value = element.getAttribute(prop) ?? declared.default;

	if (!declared.values.includes(value)) {
		throw new RangeError(
			`<${componentSpec.name} ${prop}="${value}"> is not a legal variant. ` +
				`Choose one of: ${declared.values.join(", ")}`,
		);
	}

	return value;
}

/* ---------- Gha ---------- */

/*
 * Octicon-alikes, one per keyword. They live here rather than in the contract
 * because a path is a rendering detail — Figma will get real vectors, not
 * these strings.
 */
const GHA_ICONS = {
	NOTE: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.2v4M8 4.6v.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
	TIP: '<path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2v1.6h5.2V9.7A4.5 4.5 0 0 0 8 1.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.4 13.2h3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
	IMPORTANT:
		'<rect x="1.5" y="2.5" width="13" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 11.5v2.5l3-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 5v2.6M8 9.1v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
	WARNING:
		'<path d="M8 1.8 15 14H1L8 1.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6v3.2M8 11.3v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
	CAUTION:
		'<path d="M5.4 1.5h5.2L14.5 5.4v5.2L10.6 14.5H5.4L1.5 10.6V5.4L5.4 1.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 4.8v3.4M8 10.6v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
};

/** `NOTE` -> `Note`. GitHub uppercases the keyword but title-cases the label. */
const labelFor = (keyword) => keyword.charAt(0) + keyword.slice(1).toLowerCase();

class PmndrsGha extends HTMLElement {
	connectedCallback() {
		const componentSpec = spec("pmndrs-gha");
		const keyword = variantOf(this, componentSpec);
		const label = this.getAttribute("title") ?? labelFor(keyword);

		/* The body is authored as this element's children; lift it before
		   rewriting, so the markup stays readable in index.html. */
		const body = this.innerHTML.trim();

		this.innerHTML = `
			<div class="doc-gha" data-keyword="${keyword.toLowerCase()}">
				<p class="doc-gha-label">
					<span class="doc-gha-icon" aria-hidden="true">
						<svg viewBox="0 0 16 16" width="16" height="16">${GHA_ICONS[keyword]}</svg>
					</span>
					${label}
				</p>
				<p>${body}</p>
			</div>`;

		/* `title` on a custom element would otherwise show as a browser tooltip,
		   which is not what the prop means. */
		this.removeAttribute("title");
	}
}

/* ---------- Button ---------- */

/* shadcn variant names -> the brand book's existing classes. Kept as a map
   rather than renaming the CSS, so the stylesheet is untouched and the diff
   stays reviewable. */
const BUTTON_CLASS = {
	default: "button button-primary",
	secondary: "button",
	ghost: "button button-quiet",
};

class PmndrsButton extends HTMLElement {
	connectedCallback() {
		const componentSpec = spec("pmndrs-button");
		const variant = variantOf(this, componentSpec);
		const disabled = this.hasAttribute("disabled");
		const label = this.innerHTML.trim();

		this.innerHTML = `<button type="button" class="${BUTTON_CLASS[variant]}"${disabled ? " disabled" : ""}>${label}</button>`;
	}
}

/* ---------- Badge ---------- */

class PmndrsBadge extends HTMLElement {
	connectedCallback() {
		const componentSpec = spec("pmndrs-badge");
		const ramp = variantOf(this, componentSpec);
		const { tint, ink, border } = componentSpec.bindings[ramp];
		const label = this.innerHTML.trim() || ramp;

		const badge = document.createElement("span");
		badge.className = "doc-badge";
		badge.textContent = label;
		/* Bindings come from the contract, so the badge and its Figma
		   counterpart cannot disagree about which step they use. */
		badge.style.setProperty("--badge", `var(--${ink.replace(/\./g, "-")})`);
		badge.style.setProperty("--badge-tint", `var(--${tint.replace(/\./g, "-")})`);
		badge.style.setProperty("--badge-line", `var(--${border.replace(/\./g, "-")})`);

		this.replaceChildren(badge);
	}
}

customElements.define("pmndrs-gha", PmndrsGha);
customElements.define("pmndrs-button", PmndrsButton);
customElements.define("pmndrs-badge", PmndrsBadge);
