/**
 * Drift audit — compares what Figma actually contains against the component
 * contract.
 *
 * Deliberately narrow. It checks only what is *exactly* comparable: whether a
 * paint is bound at all, which slot it binds, and whether the variant
 * properties still match the declared props. It says nothing about layout,
 * spacing or visual quality, because those are judgements and a tool that
 * guesses at them produces noise people learn to ignore.
 *
 * Nothing here talks to Figma. `figma-audit.ts` supplies a snapshot captured
 * through `use_figma`, which keeps this pure and testable offline — the same
 * split as `reconcile.ts`.
 */
import type { ComponentSpec } from '../../src/components/contract.js'

/** One component, as read out of Figma. */
export interface FigmaComponent {
	/** Figma component-set (or component) name. */
	name: string
	/** Variant property -> its values. Empty for a single-instance component. */
	variantProps: Record<string, string[]>
	/** Every paint found, with the theme slot it binds — or null if unbound. */
	paints: Array<{ node: string; kind: string; slot: string | null; variant?: string }>
}

export type Finding =
	| { kind: 'missing-in-figma'; component: string }
	| { kind: 'unknown-in-figma'; component: string }
	| { kind: 'variant-prop-mismatch'; component: string; expected: string; found: string[] }
	| { kind: 'variant-values-differ'; component: string; prop: string; missing: string[]; extra: string[] }
	| { kind: 'unbound-paint'; component: string; node: string; paintKind: string }
	| { kind: 'slot-not-in-contract'; component: string; node: string; slot: string }

/**
 * `theme/tint-blue` -> `tint-blue`. Contract bindings name bare slots; Figma
 * names them with the collection prefix. Comparing without normalising would
 * report every single binding as drift.
 */
const bare = (slot: string) => slot.replace(/^theme\//, '')

export function audit(
	specs: readonly ComponentSpec[],
	figma: readonly FigmaComponent[],
): Finding[] {
	const findings: Finding[] = []
	const byName = new Map(figma.map((f) => [f.name.toLowerCase(), f]))

	for (const spec of specs) {
		/* `pmndrs-gha` in code is `Gha` in Figma. */
		const short = spec.react.toLowerCase()
		const found = byName.get(short)

		if (!found) {
			findings.push({ kind: 'missing-in-figma', component: spec.react })
			continue
		}
		byName.delete(short)

		/* Variant property: the contract names one, Figma may disagree. */
		const figmaProps = Object.keys(found.variantProps)
		if (spec.variantProp) {
			if (!figmaProps.includes(spec.variantProp)) {
				findings.push({
					kind: 'variant-prop-mismatch',
					component: spec.react,
					expected: spec.variantProp,
					found: figmaProps,
				})
			} else {
				const declared = spec.props[spec.variantProp]?.values ?? []
				const actual = found.variantProps[spec.variantProp] ?? []
				const missing = declared.filter((v) => !actual.includes(v))
				const extra = actual.filter((v) => !declared.includes(v))
				if (missing.length || extra.length) {
					findings.push({
						kind: 'variant-values-differ',
						component: spec.react,
						prop: spec.variantProp,
						missing,
						extra,
					})
				}
			}
		}

		/*
		 * Every slot the contract mentions, flattened. Membership is all we can
		 * check: which slot a *particular* node should use is a layout question
		 * the contract doesn't model, and pretending otherwise would mean
		 * inventing a node-to-slot map that drifts on its own.
		 */
		const allowed = new Set<string>()
		for (const slots of Object.values(spec.bindings)) {
			for (const value of Object.values(slots)) {
				if (value === 'transparent') continue
				allowed.add(value.startsWith('fixed:') ? value.slice(6) : value)
			}
		}

		for (const paint of found.paints) {
			if (paint.slot === null) {
				findings.push({
					kind: 'unbound-paint',
					component: spec.react,
					node: paint.node,
					paintKind: paint.kind,
				})
				continue
			}
			if (!allowed.has(bare(paint.slot))) {
				findings.push({
					kind: 'slot-not-in-contract',
					component: spec.react,
					node: paint.node,
					slot: paint.slot,
				})
			}
		}
	}

	/* Anything left in Figma that no spec claims. */
	for (const leftover of byName.values()) {
		findings.push({ kind: 'unknown-in-figma', component: leftover.name })
	}

	return findings
}

/** A short human report. Empty findings render as a single clean line. */
export function report(findings: Finding[]) {
	if (findings.length === 0) return 'No drift: Figma matches the contract.'

	const lines = [`${findings.length} finding${findings.length === 1 ? '' : 's'}:`]
	for (const f of findings) {
		switch (f.kind) {
			case 'missing-in-figma':
				lines.push(`  ${f.component}: in the contract, absent from Figma`)
				break
			case 'unknown-in-figma':
				lines.push(`  ${f.component}: in Figma, absent from the contract`)
				break
			case 'variant-prop-mismatch':
				lines.push(`  ${f.component}: expected variant property "${f.expected}", found [${f.found.join(', ')}]`)
				break
			case 'variant-values-differ':
				lines.push(
					`  ${f.component}.${f.prop}: missing [${f.missing.join(', ') || '—'}], extra [${f.extra.join(', ') || '—'}]`,
				)
				break
			case 'unbound-paint':
				lines.push(`  ${f.component}: ${f.node}.${f.paintKind} is a raw colour, not a token`)
				break
			case 'slot-not-in-contract':
				lines.push(`  ${f.component}: ${f.node} binds ${f.slot}, which the contract doesn't declare`)
				break
		}
	}
	return lines.join('\n')
}
