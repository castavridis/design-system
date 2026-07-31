/**
 * Drift audit for the page, beside the one `audit.ts` does for the components.
 *
 * Different question, though. The component audit asks whether a component
 * still binds the tokens the contract declares; this one asks whether the page
 * is still *composed* the way the code composes it — same blocks, in the same
 * order, with the same components at the same addresses, still instances rather
 * than copies.
 *
 * The detached-instance finding is the one worth having. A detached instance
 * looks correct: same fills, same text, right until the component changes and
 * one copy of it quietly doesn't. Names alone can't see that, which is why the
 * snapshot reports node type as well as name.
 */
import type { Block, PageSpec } from './page.js'
import { paths } from './page.js'

/** One node from the Figma page, addressed the way the spec addresses blocks. */
export interface SnapshotItem {
	path: string
	kind: 'instance' | 'frame' | 'text'
	/** Component-set name, for an instance. */
	component?: string | null
	/** Variant properties only — the ones a code prop can be compared to. */
	props?: Record<string, string>
}

export interface PageSnapshot {
	page: { frame: string | null; items: SnapshotItem[] } | null
}

export type PageFinding =
	| { kind: 'page-missing' }
	| { kind: 'block-missing'; path: string; expected: string }
	| { kind: 'block-extra'; path: string; found: string }
	| { kind: 'detached-instance'; path: string; component: string }
	| { kind: 'wrong-component'; path: string; expected: string; found: string | null }
	| { kind: 'wrong-variant'; path: string; component: string; prop: string; expected: string; found: string | undefined }

/**
 * Blocks the generator draws as one unit, internals included.
 *
 * Their children are generated from variables or owned by a component, so Figma
 * has nodes the page spec never names — by design, not by drift.
 */
const OPAQUE = new Set(['instance', 'standin', 'swatches', 'ramps', 'typeSpecimens', 'cards', 'snippet', 'note', 'footer'])

/** What the spec says should be at each address. */
export function expected(spec: PageSpec) {
	return paths(spec.blocks).map(({ path, block }) => ({ path, block }))
}

/**
 * Only the props Figma models as variants can be compared.
 *
 * `showLineNumbers` and `highlight` are real props of the code component and
 * deliberately not variant axes — a number and a range can't be enumerated into
 * a variant set. Comparing them against Figma would report drift on every
 * single Code instance, forever, which is how an audit teaches people to ignore
 * it.
 */
const comparable = (block: Extract<Block, { kind: 'instance' }>, found: Record<string, string>) =>
	Object.entries(block.props).filter(([prop]) => prop in found)

export function auditPage(spec: PageSpec, snapshot: PageSnapshot): PageFinding[] {
	if (!snapshot.page || !snapshot.page.frame) return [{ kind: 'page-missing' }]

	const findings: PageFinding[] = []
	const found = new Map(snapshot.page.items.map((item) => [item.path, item]))

	for (const { path, block } of expected(spec)) {
		const item = found.get(path)
		if (!item) {
			findings.push({ kind: 'block-missing', path, expected: block.kind })
			continue
		}
		found.delete(path)

		if (block.kind !== 'instance') continue

		if (item.kind !== 'instance') {
			findings.push({ kind: 'detached-instance', path, component: block.component })
			continue
		}

		if (item.component !== block.component) {
			findings.push({ kind: 'wrong-component', path, expected: block.component, found: item.component ?? null })
			continue
		}

		for (const [prop, value] of comparable(block, item.props ?? {})) {
			const theirs = (item.props ?? {})[prop]
			/* Figma spells a boolean variant `True`/`False`. */
			const ours = typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value)
			if (theirs !== ours) {
				findings.push({ kind: 'wrong-variant', path, component: block.component, prop, expected: ours, found: theirs })
			}
		}
	}

	/*
	 * Anything left is Figma-only.
	 *
	 * Two things are deliberately not reported. Text nodes, because this compares
	 * composition rather than typography — the same restraint `audit.ts` shows
	 * about layout. And everything *inside* a block the generator draws as a unit:
	 * a swatch grid's cells, a card's heading, an instance's own layers. Those
	 * have no counterpart in the page spec because the page has no counterpart for
	 * them either; reporting them would bury the one finding that matters under a
	 * hundred that never can.
	 */
	const opaque = expected(spec)
		.filter(({ block }) => OPAQUE.has(block.kind))
		.map(({ path }) => `${path} > `)

	for (const item of found.values()) {
		if (item.kind === 'text') continue
		if (opaque.some((prefix) => item.path.startsWith(prefix))) continue
		/* `head` and its tag pill are the spec card's own chrome. */
		if (/(^|> )(head|tag)(#\d+)?$/.test(item.path)) continue

		if (item.kind === 'instance') {
			findings.push({ kind: 'block-extra', path: item.path, found: `instance of ${item.component ?? 'unknown'}` })
			continue
		}
		findings.push({ kind: 'block-extra', path: item.path, found: item.kind })
	}

	return findings
}

export function reportPage(findings: PageFinding[]) {
	if (findings.length === 0) return 'No drift: the Figma page matches demo/index.html.'

	const lines = [`${findings.length} page finding${findings.length === 1 ? '' : 's'}:`]
	for (const f of findings) {
		switch (f.kind) {
			case 'page-missing':
				lines.push('  the page has never been pushed — run `pnpm figma:page`')
				break
			case 'block-missing':
				lines.push(`  ${f.path}: in the page, absent from Figma (${f.expected})`)
				break
			case 'block-extra':
				lines.push(`  ${f.path}: in Figma, absent from the page (${f.found})`)
				break
			case 'detached-instance':
				lines.push(`  ${f.path}: ${f.component} is a copy, not an instance — it will not follow the component`)
				break
			case 'wrong-component':
				lines.push(`  ${f.path}: expected an instance of ${f.expected}, found ${f.found ?? 'nothing'}`)
				break
			case 'wrong-variant':
				lines.push(`  ${f.path}: ${f.component}.${f.prop} is "${f.found ?? '—'}" in Figma, "${f.expected}" in the page`)
				break
		}
	}
	return lines.join('\n')
}
