/**
 * The component contract — one declaration per component, naming its props and
 * the tokens each variant binds.
 *
 * This exists because three things need to agree and currently can't:
 *
 *   the demo        renders the component
 *   Figma           needs variant properties and per-variant fills
 *   Code Connect    needs a prop API to map a Figma component onto
 *
 * Hand-maintaining that agreement is how design systems drift. So the contract
 * is authored once here, emitted as data, and everything downstream reads it.
 *
 * **Prop names are not invented.** Where a component already exists in
 * `@pmndrs/docs` its real API is mirrored exactly — `Gha` genuinely takes
 * `keyword` and `title`, code fences genuinely take `showLineNumbers` and a
 * highlight range. Where it doesn't, shadcn's `cva` convention is followed
 * (`variant`, `size`), because that repo uses cherrypicked shadcn and these
 * will land beside it. Renaming either would guarantee a second migration.
 */

/** Where a component's API comes from, and therefore who owns its naming. */
export type ApiSource =
	/** Mirrors a real `@pmndrs/docs` MDX component. Do not rename these. */
	| 'pmndrs-docs'
	/** Follows shadcn's cva convention, for components that repo will supply. */
	| 'shadcn'
	/** Specific to this brand book — a token specimen, not a product component. */
	| 'brand-book'

export interface PropSpec {
	type: 'enum' | 'string' | 'boolean' | 'number'
	/** Legal values, for `enum`. Order is the order Figma will show variants in. */
	values?: readonly string[]
	default?: string | boolean | number
	description: string
}

export interface ComponentSpec {
	/** Custom element tag in the demo: `pmndrs-gha`. */
	name: string
	/** The React component this maps to once it lands in `@pmndrs/docs`. */
	react: string
	source: ApiSource
	description: string
	props: Record<string, PropSpec>
	/**
	 * The prop that becomes the Figma **variant property**. Must name an `enum`
	 * prop; everything else becomes a Figma text/boolean component property.
	 */
	variantProp?: string
	/**
	 * Token path per semantic slot, per variant value. `bindings.NOTE.accent`
	 * is the token the NOTE variant's rule and label bind to.
	 *
	 * Keyed by variant value, or by `'*'` for slots that apply to every variant
	 * (and for components that have no variants at all).
	 */
	bindings: Record<string, Record<string, string>>
}

/**
 * GitHub-style alerts. The five keywords are GitHub's, and `@pmndrs/docs`
 * passes them through verbatim — including the uppercase, which is why the
 * values are uppercase here rather than normalised.
 *
 * Each keyword maps to one accent ramp on a fixed recipe: tint from `950`,
 * rule and label from `300`. A sixth keyword would only need to name a hue.
 */
const gha: ComponentSpec = {
	name: 'pmndrs-gha',
	react: 'Gha',
	source: 'pmndrs-docs',
	description: 'GitHub-style alert. Five severity keywords, each on one accent ramp.',
	props: {
		keyword: {
			type: 'enum',
			values: ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'],
			default: 'NOTE',
			description: 'Severity. Selects the icon, label and accent ramp.',
		},
		title: {
			type: 'string',
			description: 'Overrides the label derived from `keyword`. Icon and tint still follow the keyword.',
		},
	},
	variantProp: 'keyword',
	bindings: {
		NOTE: { tint: 'tint-blue', accent: 'accent-blue', body: 'text-strong' },
		TIP: { tint: 'tint-green', accent: 'accent-green', body: 'text-strong' },
		IMPORTANT: { tint: 'tint-purple', accent: 'accent-purple', body: 'text-strong' },
		WARNING: { tint: 'tint-orange', accent: 'accent-orange', body: 'text-strong' },
		CAUTION: { tint: 'tint-red', accent: 'accent-red', body: 'text-strong' },
		/* Applies to every keyword — see fonts.legible in the design book. */
		'*': { font: 'fonts.legible' },
	},
}

/**
 * Buttons. `@pmndrs/docs` has no Button of its own — it will come from
 * shadcn — so this follows shadcn's `variant` naming rather than the
 * primary/secondary/quiet the brand book used, to avoid renaming later.
 */
const button: ComponentSpec = {
	name: 'pmndrs-button',
	react: 'Button',
	source: 'shadcn',
	description: 'Action. shadcn variant naming, brand-token surfaces.',
	props: {
		variant: {
			type: 'enum',
			values: ['default', 'secondary', 'ghost'],
			default: 'default',
			description: 'Emphasis. `default` is the filled brand action.',
		},
		disabled: { type: 'boolean', default: false, description: 'Non-interactive state.' },
	},
	variantProp: 'variant',
	bindings: {
		default: { surface: 'action', ink: 'action-ink', hover: 'action-hover', border: 'action' },
		secondary: { surface: 'transparent', ink: 'text', hover: 'surface-raised', border: 'line' },
		ghost: { surface: 'transparent', ink: 'text-muted', hover: 'surface-raised', border: 'transparent' },
		/*
		 * Not a variant — a state override. `.button:disabled` in demo.css
		 * replaces surface, ink and border identically whichever variant is
		 * underneath, so it is one entry rather than three. Figma models it as a
		 * second variant axis because a BOOLEAN component property can toggle
		 * visibility but cannot repaint a fill.
		 */
		disabled: { surface: 'transparent', ink: 'text-faint', border: 'line-soft' },
	},
}

/**
 * A badge per accent ramp. Deliberately `brand-book`, not `shadcn`: shadcn's
 * Badge varies by semantic intent (default/destructive/outline), whereas this
 * one varies by *hue* to demonstrate that the 300/950 pairing holds across the
 * palette. Calling its prop `variant` would imply a compatibility that isn't
 * there.
 */
const badge: ComponentSpec = {
	name: 'pmndrs-badge',
	react: 'Badge',
	source: 'brand-book',
	description: 'Token specimen — one badge per accent ramp, all on the same 300/950 recipe.',
	props: {
		ramp: {
			type: 'enum',
			values: ['purple', 'red', 'orange', 'yellow', 'green', 'teal', 'blue'],
			default: 'purple',
			description: 'Which accent ramp to draw from.',
		},
	},
	variantProp: 'ramp',
	bindings: Object.fromEntries(
		['purple', 'red', 'orange', 'yellow', 'green', 'teal', 'blue'].map((hue) => [
			hue,
			{ tint: `tint-${hue}`, ink: `accent-${hue}`, border: `accent-${hue}` },
		]),
	),
}

/**
 * Code blocks. The props mirror what a `@pmndrs/docs` code fence actually
 * accepts — ```tsx {1,4-6} showLineNumbers=150 — rather than a `mode` enum,
 * which would have been a nicer variant axis but an invented API.
 *
 * `lang` is the variant property because `diff` changes the rendering rules,
 * not just the palette.
 */
const code: ComponentSpec = {
	name: 'pmndrs-code',
	react: 'Code',
	source: 'pmndrs-docs',
	description: 'Syntax-highlighted code, with optional line numbers, highlight ranges and diff rendering.',
	props: {
		lang: {
			type: 'enum',
			values: ['tsx', 'diff'],
			default: 'tsx',
			description: 'Language. `diff` switches to add/remove line rendering.',
		},
		showLineNumbers: {
			type: 'number',
			description: 'Show line numbers, starting at this value. Absent means none.',
		},
		highlight: {
			type: 'string',
			description: 'Lines to emphasise, in fence syntax — e.g. `1,4-6`.',
		},
	},
	variantProp: 'lang',
	bindings: {
		tsx: { surface: 'surface-sunken', chrome: 'surface-raised', gutter: 'text-faint', highlight: 'surface', rule: 'accent-yellow' },
		diff: { surface: 'surface-sunken', chrome: 'surface-raised', gutter: 'text-faint', add: 'tint-green', remove: 'tint-red' },
	},
}

export const components: readonly ComponentSpec[] = [gha, button, badge, code]

/**
 * **Every component binds theme slots, not ramp steps.**
 *
 * A bare name (`tint-blue`, `text-body`) is a *theme slot*: it must exist in
 * both the `light` and `dark` scopes, and therefore follows the mode wherever
 * it is used. A dotted path (`fonts.legible`) is a fixed token that is the same
 * in both modes, and is allowed only where that is genuinely true.
 *
 * The distinction is enforced at build time by `boundTokenPaths`, which
 * expands every bare name into both modes. Binding `ramp.blue-950` directly
 * still resolves — it is a real token — but it silently locks the component to
 * one mode, and that is exactly the mistake this rule exists to prevent: it is
 * invisible until someone flips the theme.
 */
export function boundTokenPaths(specs: readonly ComponentSpec[] = components) {
	const paths = new Set<string>()

	for (const spec of specs) {
		for (const [variant, slots] of Object.entries(spec.bindings)) {
			for (const [slot, value] of Object.entries(slots)) {
				/* `transparent` is a CSS keyword, not a token. */
				if (value === 'transparent') continue

				if (value.includes('.')) {
					/* A fixed token. Legal, but only for genuinely mode-invariant
					   things — a font family, not a colour. */
					if (value.startsWith('ramp.') || value.startsWith('brand.')) {
						throw new Error(
							`${spec.name} binds ${value} for ${variant}.${slot}. Colours must bind a theme ` +
								`slot so they follow the mode — use the matching light/dark slot instead.`,
						)
					}
					paths.add(value)
					continue
				}

				/* A theme slot has to exist in both modes or the switch is a no-op. */
				paths.add(`light.${value}`)
				paths.add(`dark.${value}`)
			}
		}
	}

	return [...paths].sort()
}
