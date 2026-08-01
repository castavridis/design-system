import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
	ANCHORS,
	applyEdits,
	boxOf,
	coerce,
	describe as summarise,
	flatten,
	isGeometry,
	offsetFrom,
	round,
} from './template.js'

const root = resolve(import.meta.dirname, '..', '..')
const layoutText = readFileSync(join(root, 'og', 'layout', 'card.json'), 'utf8')
const layout = JSON.parse(layoutText) as Record<string, never>

test('flatten reaches every leaf, and null is the empty value', () => {
	const values = flatten(layout)

	assert.equal(values['layout.reference.width'], '1200')
	assert.equal(values['layout.blocks.message.anchor'], 'bottom-left')
	assert.equal(values['layout.blocks.message.offset.y'], '68')
	assert.equal(values['layout.type.title.size'], '94.8')
	assert.equal(values['layout.marks.dot.glow'], '22.4')

	/* `measure: null` means hug, and comes back from Figma as an empty string. */
	assert.equal(values['layout.blocks.brand.measure'], '')

	/* No key invents structure the file does not have. */
	assert.equal(values['layout.type.wordmark.leading'], undefined)
})

test('geometry is what a designer drags, and nothing else', () => {
	assert.ok(isGeometry('layout.blocks.message.offset.x'))
	assert.ok(isGeometry('layout.blocks.message.measure'))
	assert.ok(isGeometry('layout.type.title.size'))
	assert.ok(isGeometry('layout.type.title.tracking'))
	assert.ok(isGeometry('layout.marks.rule.width'))
	assert.ok(isGeometry('layout.marks.chip.padX'))

	/* Typed, because a rectangle cannot say which edge it hangs from. */
	assert.ok(!isGeometry('layout.blocks.message.anchor'))
	assert.ok(!isGeometry('layout.blocks.message.align'))
	assert.ok(!isGeometry('layout.blocks.message.direction'))
	assert.ok(!isGeometry('layout.type.title.backoff'))
	assert.ok(!isGeometry('layout.type.title.threshold'))
	assert.ok(!isGeometry('layout.type.title.font'))
})

test('placing a block and measuring it back are exact inverses', () => {
	const reference = { width: 1200, height: 630 }
	const size = { width: 320, height: 96 }

	/* The property that keeps a layout still: if these two ever disagreed, every
	   sync would nudge each block a little further across the card. */
	for (const anchor of ANCHORS) {
		for (const offset of [
			{ x: 68, y: 68 },
			{ x: 0, y: 0 },
			{ x: 12.5, y: 240 },
			{ x: -40, y: -17.5 },
		]) {
			const box = boxOf({ anchor, offset, measure: size.width }, size, reference)
			assert.deepEqual(
				offsetFrom(anchor, box, reference),
				{ x: round(offset.x), y: round(offset.y) },
				`${anchor} at ${offset.x},${offset.y}`,
			)
		}
	}
})

test('a bottom-left block hangs off the bottom, so its content grows upward', () => {
	const reference = { width: 1200, height: 630 }

	const short = boxOf(
		{ anchor: 'bottom-left', offset: { x: 68, y: 68 }, measure: 1064 },
		{ width: 1064, height: 200 },
		reference,
	)
	const tall = boxOf(
		{ anchor: 'bottom-left', offset: { x: 68, y: 68 }, measure: 1064 },
		{ width: 1064, height: 320 },
		reference,
	)

	/* Same bottom edge; the taller block starts higher up. */
	assert.equal(short.y + short.height, tall.y + tall.height)
	assert.equal(short.y + short.height, reference.height - 68)
	assert.ok(tall.y < short.y)
})

test('a top-right block is measured from the right edge', () => {
	const box = boxOf(
		{ anchor: 'top-right', offset: { x: 68, y: 68 }, measure: null },
		{ width: 380, height: 35 },
		{ width: 1200, height: 630 },
	)
	assert.equal(box.x, 1200 - 68 - 380)
	assert.equal(box.y, 68)
})

test('coerce takes its types from the layout rather than restating them', () => {
	assert.equal(coerce(layout, 'layout.type.title.size', '88'), 88)
	assert.equal(coerce(layout, 'layout.blocks.message.anchor', 'top-right'), 'top-right')

	/* A nullable measure: empty is a real value, not a mistake. */
	assert.equal(coerce(layout, 'layout.blocks.brand.measure', ''), null)
	assert.equal(coerce(layout, 'layout.blocks.brand.measure', '480'), 480)

	assert.throws(() => coerce(layout, 'layout.type.title.size', 'big'), /takes a number/)
	assert.throws(() => coerce(layout, 'layout.blocks.message.anchor', 'south'), /Expected one of/)
	assert.throws(() => coerce(layout, 'layout.blocks.message.align', 'justify'), /Expected one of/)
	assert.throws(() => coerce(layout, 'layout.type.title.font', 'comic'), /Expected one of/)
	assert.throws(() => coerce(layout, 'layout.blocks.nowhere.anchor', 'top-left'), /not a field of/)
})

test('applying no edits returns the layout byte for byte', () => {
	assert.equal(applyEdits(layoutText, []), layoutText)
})

test('a dragged block writes one number and reformats nothing', () => {
	const after = applyEdits(layoutText, [{ key: 'layout.blocks.message.offset.y', value: '132' }])

	assert.match(after, /"offset": \{ "x": 68, "y": 132 \}/)
	assert.equal(after.split('\n').length, layoutText.split('\n').length)
	assert.equal(after.replace('"y": 132', '"y": 68'), layoutText)
})

test('a re-anchored block round trips through the writer', () => {
	const after = applyEdits(layoutText, [{ key: 'layout.blocks.message.anchor', value: 'top-right' }])
	assert.match(after, /"anchor": "top-right"/)
	assert.equal(flatten(JSON.parse(after))['layout.blocks.message.anchor'], 'top-right')
})

test('a cleared measure becomes null, not an empty string', () => {
	const after = applyEdits(layoutText, [{ key: 'layout.blocks.message.measure', value: '' }])
	assert.match(after, /"measure": null/)
	assert.equal(JSON.parse(after).blocks.message.measure, null)
})

test('an illegal value stops the write before it touches the file', () => {
	assert.throws(() => applyEdits(layoutText, [{ key: 'layout.blocks.brand.anchor', value: 'diagonal' }]), /Expected one of/)
})

test('the summary counts both halves of the round trip', () => {
	const values = flatten(layout)
	const text = summarise(values)
	assert.match(text, /\d+ layout values/)
	assert.match(text, /from geometry/)
	assert.equal(
		Object.keys(values).filter(isGeometry).length + Object.keys(values).filter((k) => !isGeometry(k)).length,
		Object.keys(values).length,
	)
})
