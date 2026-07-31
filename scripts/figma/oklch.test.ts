import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hexToOklchString } from './oklch.js'

/*
 * The design book's own seeds, with the hex each is documented as producing.
 * If the conversion drifts, a pull would rewrite a colour to a value that no
 * longer round-trips — the exact failure the OKLCH guard exists to prevent.
 */
const SEEDS: Array<[string, string]> = [
	['#36342F', 'oklch(32.53% 0.0091 88.75)'],
	['#EAE5DA', 'oklch(92.28% 0.0157 86.43)'],
	['#D855F9', 'oklch(68.55% 0.2497 318.9)'],
	['#FF4980', 'oklch(67.93% 0.2192 7.25)'],
	['#FFC043', 'oklch(84.46% 0.1525 80.6)'],
	['#EBFF0F', 'oklch(95.26% 0.215 115.42)'],
	['#CAF543', 'oklch(90.91% 0.1997 122.5)'],
	['#00F7A3', 'oklch(86.11% 0.1957 159.71)'],
	['#2BDCF6', 'oklch(82.26% 0.1358 210.55)'],
]

for (const [hex, expected] of SEEDS) {
	test(`${hex} -> ${expected}`, () => {
		assert.equal(hexToOklchString(hex), expected)
	})
}

test('lowercase hex and a leading # are both accepted', () => {
	assert.equal(hexToOklchString('d855f9'), hexToOklchString('#D855F9'))
})

test('pure black and white sit at the ends of the lightness axis', () => {
	assert.match(hexToOklchString('#000000'), /^oklch\(0% 0 /)
	assert.match(hexToOklchString('#ffffff'), /^oklch\(100% 0 /)
})
