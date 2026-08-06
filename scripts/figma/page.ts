/**
 * Reads `demo/index.html` into a page spec — the third artifact the round trip
 * needs, beside the tokens and the component contract.
 *
 * The point is the `instance` block. Where the page renders a component the
 * contract declares, the spec records *which component and which variant*, not
 * the markup — so the Figma page is assembled from instances of the component
 * sets already in the file rather than from a second, hand-drawn copy of them.
 * Redrawing them would be the drift this whole directory exists to prevent,
 * except now in the one place nobody diffs: the layout.
 *
 * Everything the contract does *not* declare (the doc-site specimens, the
 * generated swatch and ramp grids, the prose) is recorded as what it is. Some
 * of it can be rebuilt from variables — swatches, ramps, type specimens — and
 * the rest becomes a labelled stand-in. A stand-in is deliberately not a
 * drawing: inventing a Figma version of `doc-search` would create a design with
 * no owner in code, which is exactly how the two sides start disagreeing.
 *
 * Pure and offline, like `audit.ts` and `reconcile.ts` — it takes HTML in and
 * gives data back, so it can be tested without Figma or a browser.
 */
import { components as contractComponents, type ComponentSpec } from '../../src/components/contract.js'
import {
	children,
	classList,
	find,
	findAll,
	findClass,
	findTag,
	hasClass,
	isElement,
	parse,
	rawText,
	text,
	type Element,
} from './html.js'

export type PropValue = string | number | boolean

/** A component instance: what to instantiate, and what to override on it. */
export interface InstanceBlock {
	kind: 'instance'
	/** Custom-element name from the contract — `pmndrs-gha`. */
	name: string
	/** Figma component-set name — `Gha`. */
	component: string
	/** Props, validated against the contract's declared values. */
	props: Record<string, PropValue>
	/**
	 * Text overrides, keyed by the contract's semantic slot rather than by the
	 * Figma layer that carries it. The generator owns that mapping; the page has
	 * no business knowing a Gha's body lives in a layer called `body`.
	 */
	text?: Record<string, string>
	/** Code only: the number its gutter counts from. */
	gutterStart?: number
}

export type Block =
	| { kind: 'hero'; eyebrow: string; heading: string[]; lede: string; children: Block[] }
	| { kind: 'section'; id: string; heading: string; children: Block[] }
	/** An unnamed container the page composes with — a row of snippets, a stage. */
	| { kind: 'row'; name: string; children: Block[] }
	| { kind: 'group'; label: string; children: Block[] }
	| { kind: 'spec'; label: string; tag?: string; description: string; children: Block[] }
	| InstanceBlock
	| { kind: 'standin'; name: string }
	| { kind: 'note'; text: string }
	| { kind: 'swatches' }
	| { kind: 'ramps' }
	| { kind: 'typeSpecimens'; items: Array<{ sample: string; caption: string; font: string }> }
	| { kind: 'snippet'; caption: string; code: string }
	| { kind: 'cards'; items: Array<{ heading: string; body: string }> }
	| { kind: 'footer'; text: string }

export interface PageSpec {
	/** Repo-relative path this was read from. */
	source: string
	title: string
	blocks: Block[]
}

/**
 * How a `<a class="button">` in the hero maps onto a Button variant.
 *
 * The demo's own `BUTTON_CLASS` (in `demo/elements.js`) is the same table read
 * the other way. It is duplicated rather than shared because that file is a
 * browser module importing from `dist/`, and this one is Node importing from
 * `src/` — but a class list that matches no variant throws below, so the two
 * cannot quietly disagree.
 */
const BUTTON_VARIANT_BY_CLASS: Record<string, string> = {
	'button button-primary': 'default',
	button: 'secondary',
	'button button-quiet': 'ghost',
}

const byName = (name: string, specs: readonly ComponentSpec[]) => specs.find((s) => s.name === name)
const byReact = (react: string, specs: readonly ComponentSpec[]) => specs.find((s) => s.react === react)

/**
 * Checks a prop against the contract, the same way `elements.js` checks the
 * element's attribute. A page that renders a variant Figma has no component for
 * should fail here, not produce an instance of whatever the default was.
 */
function validate(spec: ComponentSpec, props: Record<string, PropValue>) {
	for (const [prop, value] of Object.entries(props)) {
		const declared = spec.props[prop]
		if (!declared) {
			throw new Error(`<${spec.name}> has no prop "${prop}" — the contract declares ${Object.keys(spec.props).join(', ')}`)
		}
		if (declared.type === 'enum' && !declared.values?.includes(String(value))) {
			throw new Error(
				`<${spec.name} ${prop}="${value}"> is not a legal variant. Choose one of: ${declared.values?.join(', ')}`,
			)
		}
		if (declared.type === 'number' && typeof value !== 'number') {
			throw new Error(`<${spec.name} ${prop}> is declared a number, received ${JSON.stringify(value)}`)
		}
	}
	return props
}

/** `<pmndrs-gha keyword="TIP">…` — the variant prop, or the contract's default. */
function variantOf(el: Element, spec: ComponentSpec) {
	const prop = spec.variantProp
	if (!prop) return {}
	const declared = spec.props[prop]
	return { [prop]: el.attrs[prop] ?? String(declared?.default ?? '') }
}

/**
 * Reads a `Code` instance out of the markup that renders it.
 *
 * Every prop is derived from what the page actually shows — the language from
 * the caption, the numbering from the class and its `counter-reset`, the
 * highlight range from which lines carry `is-hl`. Nothing is restated in an
 * attribute, so the Figma instance cannot claim a variant the page isn't
 * rendering.
 */
function readCode(el: Element) {
	const lang = text(findClass(el, 'doc-code-lang') ?? { text: '' })
	const pre = findTag(el, 'pre')
	if (!pre) throw new Error('a Code block with no <pre>')

	/* The caption says the language; the contract calls the axis `type`. */
	const props: Record<string, PropValue> = { type: lang }
	let gutterStart: number | undefined

	if (hasClass(pre, 'doc-code-numbered')) {
		/* `style="counter-reset: line 149"` starts the visible numbering at 150. */
		const reset = /counter-reset:\s*line\s+(-?\d+)/.exec(pre.attrs.style ?? '')
		gutterStart = reset ? Number(reset[1]) + 1 : 1
		props.showLineNumbers = gutterStart
	}

	const lines = find(pre, (node) => node.tag === 'code')
	const rows = lines ? children(lines).filter((row) => hasClass(row, 'ln')) : []
	const highlighted = rows.flatMap((row, index) => (hasClass(row, 'is-hl') ? [index + 1] : []))
	if (highlighted.length) props.highlight = ranges(highlighted)

	return { props, gutterStart, lineCount: rows.length }
}

/** `[1, 4, 5, 6]` -> `1,4-6` — the fence syntax the contract's prop takes. */
export function ranges(lines: number[]) {
	const out: string[] = []
	for (let i = 0; i < lines.length; ) {
		let j = i
		while (j + 1 < lines.length && lines[j + 1] === (lines[j] ?? 0) + 1) j++
		out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`)
		i = j + 1
	}
	return out.join(',')
}

/**
 * An element, if it is a component instance.
 *
 * Two ways to be one. A `<pmndrs-*>` custom element *is* the component — the
 * demo already renders it from the contract. A `data-component` marker names a
 * contract component the demo renders as plain markup instead, because there is
 * no custom element for it: the masthead is one instance of static chrome, and
 * a code block's content is syntax-highlighted spans that a custom element
 * would have to re-tokenise to no benefit. The marker says which component the
 * markup *is*, so the Figma page instantiates rather than redraws it.
 */
const isInstance = (el: Element, specs: readonly ComponentSpec[]) =>
	el.tag.startsWith('pmndrs-') || 'data-component' in el.attrs

function asInstance(el: Element, specs: readonly ComponentSpec[]): InstanceBlock | null {
	if (el.tag.startsWith('pmndrs-')) {
		const spec = byName(el.tag, specs)
		if (!spec) throw new Error(`<${el.tag}> is not in the component contract`)
		return fromCustomElement(el, spec)
	}

	const marker = el.attrs['data-component']
	if (!marker) return null

	const spec = byReact(marker, specs)
	if (!spec) {
		throw new Error(
			`data-component="${marker}" names no contract component. ` +
				`Declare it in src/components/contract.ts or drop the marker.`,
		)
	}

	if (spec.react === 'Code') {
		const { props, gutterStart } = readCode(el)
		return { kind: 'instance', name: spec.name, component: spec.react, props: validate(spec, props), gutterStart }
	}

	if (spec.react === 'Mermaid') {
		/*
		 * Read, not restated: the diagram already says which kind it is, in the
		 * `aria-label` a screen reader gets. A `kind="sequence"` attribute beside
		 * it would be a second answer to a question the markup already answers.
		 */
		const svg = findTag(el, 'svg')
		const described = svg?.attrs['aria-label'] ?? ''
		const kind = /^sequence/i.test(described) ? 'sequence' : 'flowchart'
		return { kind: 'instance', name: spec.name, component: spec.react, props: validate(spec, { kind }) }
	}

	if (spec.react === 'Button') {
		const key = classList(el).filter((c) => c.startsWith('button')).join(' ')
		const variant = BUTTON_VARIANT_BY_CLASS[key]
		if (!variant) {
			throw new Error(
				`class="${el.attrs.class}" matches no Button variant. ` +
					`Expected one of: ${Object.keys(BUTTON_VARIANT_BY_CLASS).map((c) => `"${c}"`).join(', ')}`,
			)
		}
		return {
			kind: 'instance',
			name: spec.name,
			component: spec.react,
			props: validate(spec, { variant, disabled: false }),
			text: { label: text(el) },
		}
	}

	if (spec.react === 'Eyebrow') {
		/* One text node, so the marked element's words are the whole override —
		   without it the push would leave whatever the Figma component was drawn
		   saying, and the two sides would disagree about the copy in silence. */
		return {
			kind: 'instance',
			name: spec.name,
			component: spec.react,
			props: validate(spec, {}),
			text: { label: text(el) },
		}
	}

	/* Header and anything else with no variants: one instance, as authored. */
	return { kind: 'instance', name: spec.name, component: spec.react, props: validate(spec, variantOf(el, spec)) }
}

function fromCustomElement(el: Element, spec: ComponentSpec): InstanceBlock {
	const props: Record<string, PropValue> = validate(spec, variantOf(el, spec))
	const label = text(el)

	switch (spec.react) {
		case 'Gha': {
			/* The label follows the keyword unless the page overrides it, and the
			   variant already carries the right one — so only a real `title`
			   becomes an override. */
			const title = el.attrs.title
			if (title) props.title = title
			return {
				kind: 'instance',
				name: spec.name,
				component: spec.react,
				props,
				text: { body: label, ...(title ? { title } : {}) },
			}
		}
		case 'Button':
			props.disabled = 'disabled' in el.attrs
			return { kind: 'instance', name: spec.name, component: spec.react, props: validate(spec, props), text: { label } }
		case 'Badge':
			return {
				kind: 'instance',
				name: spec.name,
				component: spec.react,
				props,
				text: { label: label || String(props.ramp) },
			}
		default:
			return { kind: 'instance', name: spec.name, component: spec.react, props }
	}
}

/** The class a stand-in is named after — `doc-search`, `swatches`, `control`. */
const standinName = (el: Element) => classList(el)[0] ?? el.tag

/**
 * One block per element inside a section or a spec stage.
 *
 * Order is document order throughout: it is the page's own composition, and it
 * is what the audit compares against.
 */
function blockFor(el: Element, specs: readonly ComponentSpec[]): Block | null {
	const instance = asInstance(el, specs)
	if (instance) return instance

	if (el.tag === 'h2' || el.tag === 'h3' || el.tag === 'h4') return null

	if (hasClass(el, 'section-note')) return { kind: 'note', text: text(el) }
	if ('data-swatches' in el.attrs) return { kind: 'swatches' }
	if ('data-ramps' in el.attrs) return { kind: 'ramps' }

	if (hasClass(el, 'specimens')) {
		return {
			kind: 'typeSpecimens',
			items: children(el).map((figure) => {
				const sample = findClass(figure, 'specimen-sample')
				const font = classList(sample ?? figure).find((c) => c.startsWith('font-'))
				return {
					sample: text(sample ?? figure),
					caption: text(findTag(figure, 'figcaption') ?? { text: '' }),
					font: font ? font.slice('font-'.length) : 'sans',
				}
			}),
		}
	}

	if (hasClass(el, 'snippets')) {
		/* A row of snippets; each figure is its own block. */
		return { kind: 'row', name: 'snippets', children: children(el).map(snippet) }
	}
	if (hasClass(el, 'snippet')) return snippet(el)

	if (hasClass(el, 'cards')) {
		return {
			kind: 'cards',
			items: children(el).map((card) => ({
				heading: text(findTag(card, 'h3') ?? { text: '' }),
				body: text(findTag(card, 'p') ?? { text: '' }),
			})),
		}
	}

	if (hasClass(el, 'waterfall')) return { kind: 'row', name: 'waterfall', children: waterfall(el, specs) }

	/*
	 * A wrapper *around* instances is layout, not a specimen: `doc-buttons` is
	 * the row the four buttons sit in. Descend into it, so the components inside
	 * stay components instead of being flattened into one stand-in.
	 */
	if (findAll(el, (child) => child !== el && isInstance(child, specs)).length) {
		return { kind: 'row', name: standinName(el), children: stage(el, specs) }
	}

	return { kind: 'standin', name: standinName(el) }
}

const snippet = (figure: Element): Block => ({
	kind: 'snippet',
	caption: text(findTag(figure, 'figcaption') ?? { text: '' }),
	code: rawText(findTag(figure, 'code') ?? { text: '' }).replace(/^\n+|\s+$/g, ''),
})

/** A spec's stage: instances where the contract has one, stand-ins elsewhere. */
const stage = (el: Element, specs: readonly ComponentSpec[]) =>
	children(el).flatMap((child) => {
		const block = blockFor(child, specs)
		return block ? [block] : []
	})

/**
 * The component waterfall, nested under its `wf-group` headings.
 *
 * In the page the headings are siblings of the specs they introduce; in Figma
 * they become the frame the specs sit in, which is what a reader of either one
 * would say the structure is.
 */
function waterfall(el: Element, specs: readonly ComponentSpec[]): Block[] {
	const groups: Block[] = []
	let current: Extract<Block, { kind: 'group' }> | null = null

	for (const child of children(el)) {
		if (hasClass(child, 'wf-group')) {
			current = { kind: 'group', label: text(child), children: [] }
			groups.push(current)
			continue
		}
		if (!current) throw new Error('a spec before the first wf-group heading')
		if (hasClass(child, 'spec')) current.children.push(specBlock(child, specs))
	}

	return groups
}

function specBlock(el: Element, specs: readonly ComponentSpec[]): Block {
	const head = findClass(el, 'spec-head')
	const heading = head ? findTag(head, 'h4') : undefined
	const tagged = heading ? findClass(heading, 'spec-tag') : undefined

	/* `<h4><code>Hint</code> <span class="spec-tag">deprecated</span></h4>` —
	   the tag is a status, not part of the component's name. */
	const label = heading
		? text({ ...heading, children: heading.children.filter((n) => !isElement(n) || !hasClass(n, 'spec-tag')) })
		: ''

	return {
		kind: 'spec',
		label,
		...(tagged ? { tag: text(tagged) } : {}),
		description: text(head ? (findTag(head, 'p') ?? { text: '' }) : { text: '' }),
		/* The stage is a block of its own: the page has one, the Figma frame has
		   one, and an address that skipped it would name a node that isn't there. */
		children: [{ kind: 'row', name: 'stage', children: stage(findClass(el, 'spec-stage') ?? el, specs) }],
	}
}

export function extractPage(
	html: string,
	{ source = 'demo/index.html', specs = contractComponents }: { source?: string; specs?: readonly ComponentSpec[] } = {},
): PageSpec {
	const tree = parse(html)
	const html_ = find({ tag: '#root', attrs: {}, children: tree }, (el) => el.tag === 'html')
	if (!html_) throw new Error('no <html> element')

	const head = findTag(html_, 'head')
	const body = findTag(html_, 'body')
	if (!body) throw new Error('no <body> element')

	const blocks: Block[] = []

	for (const el of children(body)) {
		if (hasClass(el, 'hero')) {
			const headingEl = findTag(el, 'h1')
			const eyebrowEl = findClass(el, 'eyebrow')

			/*
			 * The eyebrow is a component when the page says so, and loose text when
			 * it doesn't — the marker is what makes it an instance, exactly as it
			 * does for the buttons below it. The copy stays a hero field either way:
			 * it is the page's words, and the instance carries them as an override.
			 */
			const eyebrowBlock = eyebrowEl && 'data-component' in eyebrowEl.attrs ? asInstance(eyebrowEl, specs) : null

			blocks.push({
				kind: 'hero',
				eyebrow: text(eyebrowEl ?? { text: '' }),
				/* `<br />` is a line break in the mark, so it survives as one. */
				heading: headingEl ? lines(headingEl) : [],
				lede: text(findClass(el, 'lede') ?? { text: '' }),
				children: [
					...(eyebrowBlock ? [eyebrowBlock] : []),
					/* The heading and the lede, in the box that holds them. Empty of
					   blocks because the copy is the hero's own — the row exists so the
					   frame Figma draws has an owner here. */
					{ kind: 'row', name: 'hero-intro', children: [] },
					{
						kind: 'row',
						name: 'hero-actions',
						children: stage(findClass(el, 'hero-actions') ?? { tag: 'div', attrs: {}, children: [] }, specs),
					},
				],
			})
			continue
		}

		if (el.tag === 'main') {
			for (const section of children(el)) {
				if (section.tag !== 'section') continue
				blocks.push({
					kind: 'section',
					id: section.attrs.id ?? '',
					heading: text(findTag(section, 'h2') ?? { text: '' }),
					children: children(section).flatMap((child) => {
						const block = blockFor(child, specs)
						return block ? [block] : []
					}),
				})
			}
			continue
		}

		if (el.tag === 'footer') blocks.push({ kind: 'footer', text: text(el) })
	}

	return {
		source,
		title: text(head ? (findTag(head, 'title') ?? { text: '' }) : { text: '' }),
		blocks,
	}
}

/** An `<h1>` split on its `<br>`s. */
function lines(el: Element) {
	const out: string[] = ['']
	for (const node of el.children) {
		if (isElement(node) && node.tag === 'br') out.push('')
		else out[out.length - 1] += rawText(node)
	}
	return out.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** Every block, depth first, with its parent chain. */
export function walk(blocks: readonly Block[], parents: Block[] = []): Array<{ block: Block; parents: Block[] }> {
	return blocks.flatMap((block) => [
		{ block, parents },
		...('children' in block ? walk(block.children, [...parents, block]) : []),
	])
}

export const instancesOf = (spec: PageSpec) =>
	walk(spec.blocks)
		.map(({ block }) => block)
		.filter((block): block is InstanceBlock => block.kind === 'instance')

/**
 * The address of every block, in document order.
 *
 * The generator names Figma nodes with these segments and the audit reads them
 * back, so a moved or deleted block is reported at a path a person can find
 * rather than as "something at index 34 differs".
 */
export function paths(blocks: readonly Block[], prefix = ''): Array<{ path: string; block: Block }> {
	const seen = new Map<string, number>()
	const out: Array<{ path: string; block: Block }> = []

	for (const block of blocks) {
		const base = segment(block)
		const count = (seen.get(base) ?? 0) + 1
		seen.set(base, count)
		const path = `${prefix}${count > 1 ? `${base}#${count}` : base}`
		out.push({ path, block })
		if ('children' in block) out.push(...paths(block.children, `${path} > `))
	}

	return out
}

export function segment(block: Block): string {
	switch (block.kind) {
		case 'hero':
			return 'hero'
		case 'section':
			return `section#${block.id}`
		case 'row':
			return block.name
		case 'group':
			return `group:${block.label}`
		case 'spec':
			return `spec:${block.label}`
		case 'instance':
			return block.component
		case 'standin':
			return `standin:${block.name}`
		case 'snippet':
			return `snippet:${block.caption}`
		default:
			return block.kind
	}
}

/** A short coverage summary, for the CLI. */
export function describe(spec: PageSpec) {
	const all = walk(spec.blocks).map(({ block }) => block)
	const instances = all.filter((b): b is InstanceBlock => b.kind === 'instance')
	const standins = all.filter((b) => b.kind === 'standin') as Array<{ name: string }>

	const perComponent = new Map<string, number>()
	for (const instance of instances) perComponent.set(instance.component, (perComponent.get(instance.component) ?? 0) + 1)

	const lines = [
		`${spec.source}: ${all.filter((b) => b.kind === 'section' && 'id' in b && b.id).length} sections, ` +
			`${all.filter((b) => b.kind === 'spec').length} specs`,
		`  ${instances.length} instances of ${perComponent.size} components: ` +
			[...perComponent].map(([name, n]) => `${name}×${n}`).join(', '),
	]

	const kinds = [...new Set(standins.map((s) => s.name))].sort()
	if (kinds.length) lines.push(`  ${standins.length} stand-ins (no contract component): ${kinds.join(', ')}`)

	return lines.join('\n')
}
