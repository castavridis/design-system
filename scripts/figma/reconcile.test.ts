import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Policy, type ValueMap, nextBase, reconcile } from './reconcile.js'

const policy: Policy = { prefer: { brand: 'ask', fonts: 'code' }, derived: ['ramp'] }

/** Reconcile one token and return just its verdict. */
function verdictFor(base: ValueMap, ours: ValueMap, theirs: ValueMap, p: Policy = policy) {
	const entries = reconcile(base, ours, theirs, p)
	return entries[0]?.verdict ?? { kind: 'unchanged' as const }
}

const PURPLE = '#d855f9'
const RED = '#ff0000'
const BLUE = '#0000ff'

test('neither side moved', () => {
	assert.deepEqual(reconcile({ 'brand.purple': PURPLE }, { 'brand.purple': PURPLE }, { 'brand.purple': PURPLE }, policy), [])
})

test('hex comparison ignores case', () => {
	assert.deepEqual(reconcile({ 'brand.purple': PURPLE }, { 'brand.purple': '#D855F9' }, { 'brand.purple': PURPLE }, policy), [])
})

test('only the book moved -> push', () => {
	assert.deepEqual(verdictFor({ 'brand.purple': PURPLE }, { 'brand.purple': RED }, { 'brand.purple': PURPLE }), {
		kind: 'push',
		value: RED,
	})
})

test('only Figma moved -> pull', () => {
	assert.deepEqual(verdictFor({ 'brand.purple': PURPLE }, { 'brand.purple': PURPLE }, { 'brand.purple': RED }), {
		kind: 'pull',
		value: RED,
	})
})

test('both moved with prefer:ask -> conflict, never a silent pick', () => {
	assert.deepEqual(verdictFor({ 'brand.purple': PURPLE }, { 'brand.purple': RED }, { 'brand.purple': BLUE }), {
		kind: 'conflict',
		ours: RED,
		theirs: BLUE,
	})
})

test('both moved with a scope preference -> resolved', () => {
	assert.deepEqual(verdictFor({ 'fonts.sans': 'a' }, { 'fonts.sans': 'b' }, { 'fonts.sans': 'c' }), {
		kind: 'resolved',
		winner: 'code',
		value: 'b',
		ours: 'b',
		theirs: 'c',
	})
})

test('--prefer overrides the scope preference', () => {
	const overridden: Policy = { ...policy, override: 'figma' }
	assert.deepEqual(
		verdictFor({ 'fonts.sans': 'a' }, { 'fonts.sans': 'b' }, { 'fonts.sans': 'c' }, overridden),
		{ kind: 'resolved', winner: 'figma', value: 'c', ours: 'b', theirs: 'c' },
	)
})

test('a derived token edited in Figma is reported, never pulled', () => {
	assert.deepEqual(verdictFor({ 'ramp.purple-600': PURPLE }, { 'ramp.purple-600': PURPLE }, { 'ramp.purple-600': RED }), {
		kind: 'derived-drift',
		ours: PURPLE,
		theirs: RED,
	})
})

test('present in the book, absent from Figma -> create', () => {
	assert.deepEqual(verdictFor({}, { 'brand.teal': PURPLE }, {}), { kind: 'create', value: PURPLE })
})

test('present in Figma, absent from the book -> orphan', () => {
	assert.deepEqual(verdictFor({}, {}, { 'brand.mystery': RED }), { kind: 'orphan', value: RED })
})

test('no base: agreement is fine, disagreement is a conflict rather than a guess', () => {
	assert.deepEqual(verdictFor({}, { 'brand.purple': PURPLE }, { 'brand.purple': PURPLE }), { kind: 'unchanged' })
	assert.deepEqual(verdictFor({}, { 'brand.purple': RED }, { 'brand.purple': BLUE }), {
		kind: 'conflict',
		ours: RED,
		theirs: BLUE,
	})
})

/*
 * The regression this whole design exists to prevent. If the base only advanced
 * on pull, the second sync below would see both sides differing from a stale
 * base and report a conflict — every push would poison the next sync.
 */
test('no false conflict: push, then re-sync reports nothing', () => {
	const base: ValueMap = { 'brand.purple': PURPLE }
	const ours: ValueMap = { 'brand.purple': RED } // edited in code
	const theirs: ValueMap = { 'brand.purple': PURPLE } // Figma untouched

	const first = reconcile(base, ours, theirs, policy)
	assert.equal(first[0]?.verdict.kind, 'push')

	const advanced = nextBase(base, first)
	assert.deepEqual(advanced, { 'brand.purple': RED }, 'push must advance the base')

	// The push landed, so Figma now holds what the book holds.
	assert.deepEqual(reconcile(advanced, ours, { 'brand.purple': RED }, policy), [])
})

test('a pull also advances the base', () => {
	const base: ValueMap = { 'brand.purple': PURPLE }
	const entries = reconcile(base, { 'brand.purple': PURPLE }, { 'brand.purple': BLUE }, policy)

	assert.deepEqual(nextBase(base, entries), { 'brand.purple': BLUE })
})

test('unsettled entries leave the base alone so they surface again', () => {
	const base: ValueMap = { 'brand.purple': PURPLE, 'ramp.purple-600': PURPLE }
	const entries = reconcile(
		base,
		{ 'brand.purple': RED, 'ramp.purple-600': PURPLE },
		{ 'brand.purple': BLUE, 'ramp.purple-600': RED },
		policy,
	)

	assert.deepEqual(nextBase(base, entries), base)
})
