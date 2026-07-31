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
		'*': { font: 'fixed:fonts.legible' },
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
		/*
		 * Syntax colours, shared by both languages. These were missing until the
		 * drift audit found Figma binding five slots the contract never declared —
		 * the contract described the block's chrome and forgot the code inside it.
		 */
		'*': {
			langLabel: 'accent-orange',
			keyword: 'accent-purple',
			string: 'accent-green',
			fn: 'accent-yellow',
			type: 'accent-blue',
			tag: 'accent-teal',
			number: 'accent-orange',
			punctuation: 'text-faint',
			plain: 'text-body',
		},
	},
}

/**
 * Site masthead. No variants — it is one instance — so every binding is keyed
 * `'*'`. It is in the contract anyway, because that is what subjects it to the
 * mode guard; a component left out of the contract can be built dark-locked
 * and nothing will say so.
 *
 * The wordmark's gradient is `fixed:`. Those three brand colours are the
 * identity, not a theme decision, and a mark that changes hue with the OS
 * setting is a different mark.
 */
const header: ComponentSpec = {
	name: 'pmndrs-header',
	react: 'Header',
	source: 'pmndrs-docs',
	description: 'Masthead: wordmark, section links, search affordance.',
	props: {
		active: {
			type: 'string',
			description: 'Which section link reads as current.',
		},
	},
	bindings: {
		'*': {
			surface: 'surface-raised',
			border: 'line',
			wordmark: 'text',
			wordmarkMuted: 'text-muted',
			link: 'text-muted',
			linkActive: 'text',
			linkRule: 'accent-teal',
			searchSurface: 'surface-sunken',
			searchBorder: 'line',
			searchInk: 'text-muted',
			searchKbd: 'text-faint',
			markFrom: 'fixed:brand.yellow',
			markVia: 'fixed:brand.teal',
			markTo: 'fixed:brand.purple',
		},
	},
}

/**
 * Sidebar navigation, grouped by category.
 *
 * No variant property. The states that look like variants — a category open or
 * closed, a page current or not — belong to *items* inside one instance, and a
 * variant axis can only describe the whole component. Modelling "open" as a
 * variant would mean a set of 2^n members for n categories, which is how a
 * component set stops being usable at the third category.
 *
 * The current item is the only place chrome takes an accent: teal, matching the
 * Header's active-link rule, so "you are here" reads the same in the masthead
 * and in the sidebar.
 */
const nav: ComponentSpec = {
	name: 'pmndrs-nav',
	react: 'Nav',
	source: 'pmndrs-docs',
	description: 'Sidebar, grouped by category. Categories collapse; the current page is marked.',
	props: {
		active: {
			type: 'string',
			description: 'Which page reads as current.',
		},
	},
	bindings: {
		'*': {
			category: 'text',
			chevron: 'text-faint',
			rule: 'line-soft',
			link: 'text-muted',
			linkHover: 'surface-raised',
			currentSurface: 'tint-teal',
			currentInk: 'accent-teal',
		},
	},
}

/**
 * The search modal.
 *
 * Two accents doing different jobs, which is why they are separate slots rather
 * than one `accent`: teal marks the selected result, the way it marks the
 * current page everywhere else, and yellow highlights the matched term. A
 * matched term is not a selection, and collapsing them would make the modal
 * argue with itself the moment both appear on one row.
 */
const search: ComponentSpec = {
	name: 'pmndrs-search',
	react: 'Search',
	source: 'pmndrs-docs',
	description: 'Modal with matched-term highlighting and a breadcrumb path.',
	props: {
		query: {
			type: 'string',
			description: 'The typed query. Shown in the field, and what the results are matched against.',
		},
	},
	bindings: {
		'*': {
			surface: 'surface-raised',
			border: 'line',
			divider: 'line-soft',
			icon: 'text-faint',
			query: 'text',
			caret: 'accent-teal',
			kbd: 'text-muted',
			kbdSurface: 'surface',
			kbdBorder: 'line',
			activeSurface: 'surface',
			activeRule: 'accent-teal',
			title: 'text',
			markTint: 'tint-yellow',
			markInk: 'accent-yellow',
			path: 'text-muted',
			excerpt: 'text-muted',
			/* The query and the breadcrumb are code, and set like it. */
			mono: 'fixed:fonts.mono',
		},
	},
}

/**
 * Table of contents.
 *
 * The same "you are here" teal as `Nav`, but as a rule on the margin rather
 * than a filled row: the ToC sits beside body copy, and a filled highlight
 * there competes with the text it is indexing.
 */
const toc: ComponentSpec = {
	name: 'pmndrs-toc',
	react: 'Toc',
	source: 'pmndrs-docs',
	description: 'Table of contents built from the headings, with the section in view marked.',
	props: {
		active: {
			type: 'string',
			description: 'Which heading is in view.',
		},
	},
	bindings: {
		'*': {
			label: 'text-muted',
			rule: 'line-soft',
			link: 'text-muted',
			linkHover: 'text',
			currentInk: 'accent-teal',
			currentRule: 'accent-teal',
			/* The "On this page" label is set in mono, like every other eyebrow. */
			mono: 'fixed:fonts.mono',
		},
	},
}

export const components: readonly ComponentSpec[] = [gha, button, badge, code, header, nav, search, toc]

/**
 * **Every component binds theme slots, not ramp steps.**
 *
 * A bare name (`tint-blue`, `text-body`) is a *theme slot*: it must exist in
 * both the `light` and `dark` scopes, and therefore follows the mode wherever
 * it is used.
 *
 * `fixed:<path>` marks a token that is deliberately the same in both modes —
 * a font family, or a brand mark whose colours are the identity rather than a
 * theme choice. The prefix is required rather than inferred, because "this one
 * doesn't change" is a decision someone should have to write down.
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

				if (value.startsWith('fixed:')) {
					/* Deliberately mode-invariant, and said so. */
					paths.add(value.slice('fixed:'.length))
					continue
				}

				if (value.includes('.')) {
					throw new Error(
						`${spec.name} binds ${value} for ${variant}.${slot}. Bind a theme slot so it ` +
							`follows the mode, or write \`fixed:${value}\` if it genuinely must not change.`,
					)
				}

				/* A theme slot has to exist in both modes or the switch is a no-op. */
				paths.add(`light.${value}`)
				paths.add(`dark.${value}`)
			}
		}
	}

	return [...paths].sort()
}
