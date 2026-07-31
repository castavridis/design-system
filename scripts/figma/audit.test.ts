import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ComponentSpec } from '../../src/components/contract.js'
import { audit, type FigmaComponent } from './audit.js'

const spec: ComponentSpec = {
	name: 'pmndrs-gha',
	react: 'Gha',
	source: 'pmndrs-docs',
	description: '',
	props: { keyword: { type: 'enum', values: ['NOTE', 'TIP'], description: '' } },
	variantProp: 'keyword',
	bindings: {
		NOTE: { tint: 'tint-blue', accent: 'accent-blue' },
		TIP: { tint: 'tint-green', accent: 'accent-green' },
		'*': { font: 'fixed:fonts.legible' },
	},
}

const ok: FigmaComponent = {
	name: 'Gha',
	variantProps: { keyword: ['NOTE', 'TIP'] },
	paints: [{ node: 'root', kind: 'fills', slot: 'theme/tint-blue' }],
}

test('a matching component reports nothing', () => {
	assert.deepEqual(audit([spec], [ok]), [])
})

test('the theme/ prefix is normalised, not reported as drift', () => {
	const prefixed = { ...ok, paints: [{ node: 'n', kind: 'fills', slot: 'theme/accent-green' }] }
	assert.deepEqual(audit([spec], [prefixed]), [])
})

test('a fixed: binding is allowed without its prefix in Figma', () => {
	const f = { ...ok, paints: [{ node: 'label', kind: 'fills', slot: 'fonts.legible' }] }
	assert.deepEqual(audit([spec], [f]), [])
})

test('an unbound paint is a finding', () => {
	const f = { ...ok, paints: [{ node: 'icon', kind: 'strokes', slot: null }] }
	assert.deepEqual(audit([spec], [f]), [
		{ kind: 'unbound-paint', component: 'Gha', node: 'icon', paintKind: 'strokes' },
	])
})

test('a slot the contract never declares is a finding', () => {
	const f = { ...ok, paints: [{ node: 'root', kind: 'fills', slot: 'theme/accent-red' }] }
	assert.deepEqual(audit([spec], [f]), [
		{ kind: 'slot-not-in-contract', component: 'Gha', node: 'root', slot: 'theme/accent-red' },
	])
})

test('a variant added in Figma is extra; one removed is missing', () => {
	const f = { ...ok, variantProps: { keyword: ['NOTE', 'DANGER'] } }
	assert.deepEqual(audit([spec], [f]), [
		{ kind: 'variant-values-differ', component: 'Gha', prop: 'keyword', missing: ['TIP'], extra: ['DANGER'] },
	])
})

test('a renamed variant property is a finding', () => {
	const f = { ...ok, variantProps: { severity: ['NOTE', 'TIP'] } }
	assert.deepEqual(audit([spec], [f]), [
		{ kind: 'variant-prop-mismatch', component: 'Gha', expected: 'keyword', found: ['severity'] },
	])
})

test('components present on only one side are reported', () => {
	assert.deepEqual(audit([spec], []), [{ kind: 'missing-in-figma', component: 'Gha' }])
	const stray: FigmaComponent = { name: 'Tooltip', variantProps: {}, paints: [] }
	assert.deepEqual(audit([], [stray]), [{ kind: 'unknown-in-figma', component: 'Tooltip' }])
})
