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
	 * Keyed by variant value, or by `'*'` when the component has no variants.
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
		NOTE: { tint: 'ramp.blue-950', accent: 'ramp.blue-300', body: 'ramp.dark-200' },
		TIP: { tint: 'ramp.green-950', accent: 'ramp.green-300', body: 'ramp.dark-200' },
		IMPORTANT: { tint: 'ramp.purple-950', accent: 'ramp.purple-300', body: 'ramp.dark-200' },
		WARNING: { tint: 'ramp.orange-950', accent: 'ramp.orange-300', body: 'ramp.dark-200' },
		CAUTION: { tint: 'ramp.red-950', accent: 'ramp.red-300', body: 'ramp.dark-200' },
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
		default: { surface: 'brand.purple', ink: 'ramp.purple-950', hover: 'ramp.purple-400', border: 'brand.purple' },
		secondary: { surface: 'transparent', ink: 'brand.light', hover: 'ramp.dark-700', border: 'ramp.dark-600' },
		ghost: { surface: 'transparent', ink: 'ramp.dark-400', hover: 'ramp.dark-700', border: 'transparent' },
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
			{ tint: `ramp.${hue}-950`, ink: `ramp.${hue}-300`, border: `ramp.${hue}-800` },
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
		tsx: { surface: 'ramp.dark-950', chrome: 'ramp.dark-700', gutter: 'ramp.dark-500', highlight: 'ramp.dark-800', rule: 'brand.yellow' },
		diff: { surface: 'ramp.dark-950', chrome: 'ramp.dark-700', gutter: 'ramp.dark-500', add: 'ramp.green-950', remove: 'ramp.red-950' },
	},
}

export const components: readonly ComponentSpec[] = [gha, button, badge, code]

/** Every token path any component binds — the set Figma must have before M4. */
export function boundTokenPaths(specs: readonly ComponentSpec[] = components) {
	const paths = new Set<string>()
	for (const spec of specs) {
		for (const slots of Object.values(spec.bindings)) {
			for (const path of Object.values(slots)) {
				/* `transparent` is a CSS keyword, not a token. */
				if (path !== 'transparent') paths.add(path)
			}
		}
	}
	return [...paths].sort()
}
