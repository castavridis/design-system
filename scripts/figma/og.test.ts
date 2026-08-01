import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
	DEFAULTS,
	DEFAULT_EFFECTS,
	SCENES,
	SIZES,
	THEMES,
	applyEdits,
	decodeEffects,
	decodeSize,
	decodeSource,
	encodeEffects,
	encodeSize,
	encodeSource,
	fieldsOf,
	keyOf,
	normalise,
	parseKey,
	patchFor,
	renderPlan,
	templatesFrom,
	valuesOf,
} from './og.js'

const root = resolve(import.meta.dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The generator's own source, read as text.
 *
 * The tests below are the reason `og.ts` is allowed to restate `resolveSpec`'s
 * defaults. Importing the real module would pull the scene registry and all of
 * three.js into a Node test; reading it as text costs nothing and still fails
 * the moment the two disagree.
 */
const specSource = read('og/src/lib/spec.ts')
const registrySource = read('og/src/scenes/registry.ts')
const paletteSource = read('og/src/lib/palette.ts')

/** Fails with the pattern rather than `null` when the source shape changes. */
function extract(source: string, pattern: RegExp, what: string) {
	const found = pattern.exec(source)
	if (!found) throw new Error(`could not read ${what} out of the generator's source — ${pattern}`)
	return found
}

test('the restated defaults match resolveSpec', () => {
	const defaultOf = (field: string) =>
		extract(specSource, new RegExp(`input\\.${field} \\?\\? '?([\\w.-]+)'?`), `the default ${field}`)[1]

	assert.equal(defaultOf('accent'), DEFAULTS.accent)
	assert.equal(defaultOf('theme'), DEFAULTS.theme)
	assert.equal(defaultOf('size'), DEFAULTS.size)
	assert.equal(Number(defaultOf('seed')), DEFAULTS.seed)
	assert.equal(Number(defaultOf('atSeconds')), DEFAULTS.atSeconds)
	assert.equal(Number(defaultOf('loopSeconds')), DEFAULTS.loopSeconds)

	assert.equal(extract(specSource, /source\.name \?\? '([\w-]+)'/, 'the default scene')[1], DEFAULTS.scene)
})

test('the restated effect defaults match defaultEffects', () => {
	const block = extract(specSource, /defaultEffects[^=]*= \{([^}]*)\}/, 'defaultEffects')[1] ?? ''
	const found = Object.fromEntries([...block.matchAll(/(\w+): ([\d.]+)/g)].map(([, name, value]) => [name, Number(value)]))

	assert.deepEqual(found, DEFAULT_EFFECTS)
})

test('the restated sizes match the generator', () => {
	const block = extract(specSource, /export const sizes[^=]*= \{([\s\S]*?)\n\}/, 'the size table')[1] ?? ''
	const found = Object.fromEntries(
		[...block.matchAll(/(\w+): \{ width: (\d+), height: (\d+) \}/g)].map(([, name, width, height]) => [
			name,
			{ width: Number(width), height: Number(height) },
		]),
	)

	assert.deepEqual(found, SIZES)
})

test('the restated scene names match the registry', () => {
	const block = extract(registrySource, /export const scenes = \{([\s\S]*?)\n\} satisfies/, 'the scene registry')[1] ?? ''
	const found = [...block.matchAll(/^\s*'?([\w-]+)'?:/gm)].map(([, name]) => name)

	assert.deepEqual(found, SCENES)
})

test('the restated theme names match ThemeName', () => {
	const line = extract(paletteSource, /export type ThemeName = ([^\n]+)/, 'ThemeName')[1] ?? ''
	const found = [...line.matchAll(/'([\w-]+)'/g)].map(([, name]) => name)

	assert.deepEqual(found, THEMES)
})

test('renderPlan reads every render out of the demo script', () => {
	const plan = renderPlan(read('og/package.json'))

	assert.ok(plan.length >= 5, `expected the demo to run several renders, got ${plan.length}`)
	assert.deepEqual(
		plan.map((c) => c.spec),
		['specs/demo-loop.json', 'specs/demo-loop.json', 'specs/demo-gif.json', 'specs/demo.json', 'specs/demo-media.json'],
	)

	const [mp4, poster, gif, manifest] = plan
	assert.deepEqual(mp4, { spec: 'specs/demo-loop.json', manifest: false, out: '../demo/og/loop.mp4', kind: 'mp4' })
	assert.equal(poster?.kind, 'still')
	assert.equal(poster?.out, '../demo/og/loop-poster.jpg')
	assert.equal(gif?.kind, 'gif')
	assert.equal(manifest?.manifest, true)
	assert.equal(manifest?.out, undefined)
})

test('renderPlan says so when the demo script is gone', () => {
	assert.throws(() => renderPlan('{"scripts":{}}'), /no `demo` script/)
	assert.throws(() => renderPlan('{"scripts":{"demo":"echo nope"}}'), /runs no renders/)
})

/** The real plan, used by several tests below. */
const templates = templatesFrom(
	renderPlan(read('og/package.json')),
	Object.fromEntries(
		readdirSync(join(root, 'og', 'specs')).map((name) => [`specs/${name}`, read(join('og', 'specs', name))]),
	),
)

test('every card the demo renders becomes one template', () => {
	/* The ten in the manifest, the two media cards, the loop and the GIF. */
	assert.equal(templates.length, 14)

	const keys = templates.map((t) => t.key)
	assert.ok(keys.includes('demo/minimal'), keys.join(', '))
	assert.ok(keys.includes('demo-media/source-video'))
	assert.ok(keys.includes('demo-loop'))
	assert.ok(keys.includes('demo-gif'))

	/* One template per card, never one per render command. */
	assert.equal(new Set(keys).size, keys.length)
})

test('a manifest card resolves its outDir, and every render is on disk', () => {
	const minimal = templates.find((t) => t.key === 'demo/minimal')
	assert.equal(minimal?.art, 'demo/og/minimal.jpg')
	assert.equal(minimal?.card, 0)
	assert.equal(minimal?.source, 'og/specs/demo.json')

	for (const template of templates) {
		assert.ok(template.art, `${template.key} has no artwork`)
		assert.doesNotThrow(() => read(template.art as string), `${template.key}: ${template.art} is not on disk`)
	}
})

test('the mp4 template wears the poster still rendered beside it', () => {
	const loop = templates.find((t) => t.key === 'demo-loop')

	assert.equal(loop?.kind, 'mp4')
	assert.equal(loop?.out, 'demo/og/loop.mp4', 'the real output is still the video')
	assert.equal(loop?.art, 'demo/og/loop-poster.jpg', 'but Figma is shown the still')
})

test('a GIF is its own artwork', () => {
	const gif = templates.find((t) => t.key === 'demo-gif')
	assert.equal(gif?.art, 'demo/og/loop.gif')
	assert.equal(gif?.width, 400)
	assert.equal(gif?.height, 210)
})

test('a named size and an explicit box are both one field', () => {
	assert.equal(encodeSize({}), 'og')
	assert.equal(encodeSize({ size: 'square' }), 'square')
	assert.equal(encodeSize({ width: 800, height: 420 }), '800x420')
	/* Half a box still has a resolved answer: the other half comes from `size`. */
	assert.equal(encodeSize({ width: 800 }), '800x630')

	assert.deepEqual(decodeSize('wide'), { size: 'wide' })
	assert.deepEqual(decodeSize('800x420'), { width: 800, height: 420 })
	assert.deepEqual(decodeSize(' 1200 × 630 '), { width: 1200, height: 630 })
	assert.throws(() => decodeSize('enormous'), /not a size/)
})

test('a source round trips through its flat spelling', () => {
	assert.equal(encodeSource({}), 'scene:ramp-orbit')
	assert.equal(encodeSource({ source: { kind: 'scene', name: 'prism' } }), 'scene:prism')
	assert.equal(encodeSource({ source: { kind: 'image', src: '../a.jpg' } }), 'image:../a.jpg')

	assert.deepEqual(decodeSource('scene:prism'), { kind: 'scene', name: 'prism' })
	assert.deepEqual(decodeSource('video:../demo/og/loop.mp4'), { kind: 'video', src: '../demo/og/loop.mp4' })
	assert.throws(() => decodeSource('scene:nope'), /Unknown scene/)
	assert.throws(() => decodeSource('hologram:x'), /Unknown source kind/)
	assert.throws(() => decodeSource('image:'), /needs a `src`/)
	assert.throws(() => decodeSource('ramp-orbit'), /not a source/)
})

test('effects are shown resolved, so every one of them is editable', () => {
	assert.equal(encodeEffects({}), 'bloom=0.9, chromaticAberration=0.0016, noise=0.045, vignette=0.5')
	assert.equal(
		encodeEffects({ effects: { bloom: 1.15 } }),
		'bloom=1.15, chromaticAberration=0.0016, noise=0.045, vignette=0.5',
	)

	assert.deepEqual(decodeEffects('bloom=0, vignette=0.25'), { bloom: 0, vignette: 0.25 })
	assert.throws(() => decodeEffects('glow=1'), /Unknown effect/)
	assert.throws(() => decodeEffects('bloom=lots'), /needs a number/)
})

test('fields are resolved, so an unset knob still shows what the render used', () => {
	const fields = fieldsOf({ title: 'Only a title' })

	assert.equal(fields.title, 'Only a title')
	assert.equal(fields.eyebrow, '', 'a card with no eyebrow says so')
	assert.equal(fields.accent, 'purple', 'but an unset accent shows the default the render actually used')
	assert.equal(fields.seed, '1')
	assert.equal(fields.source, 'scene:ramp-orbit')
})

test('keys survive a template name that contains a dot', () => {
	assert.equal(keyOf('demo/minimal', 'title'), 'og.demo/minimal.title')
	assert.deepEqual(parseKey('og.demo/minimal.title'), { template: 'demo/minimal', field: 'title' })
	assert.deepEqual(parseKey('og.a.b.c.seed'), { template: 'a.b.c', field: 'seed' })
	assert.equal(parseKey('og.demo/minimal.wordmark'), null, 'a field we do not sync is not ours')
	assert.equal(parseKey('brand.purple'), null)
})

test('valuesOf flattens every template into the map reconcile takes', () => {
	const values = valuesOf(templates)

	assert.equal(Object.keys(values).length, templates.length * 12)
	assert.equal(values['og.demo/minimal.title'], 'Only a title')
	assert.equal(values['og.demo-gif.meta'], '--gif')
})

test('patchFor validates against the book rather than accepting a typo', () => {
	assert.deepEqual(patchFor('accent', 'teal'), { accent: 'teal' })
	assert.throws(() => patchFor('accent', 'chartreuse'), /Unknown accent/)
	assert.throws(() => patchFor('theme', 'sepia'), /Unknown theme/)
	assert.throws(() => patchFor('title', '   '), /non-empty `title`/)
	assert.throws(() => patchFor('seed', 'seven'), /needs a number/)

	/* One field, two spellings — and only ever one of them left behind. */
	assert.deepEqual(patchFor('size', 'square'), { size: 'square', width: null, height: null })
	assert.deepEqual(patchFor('size', '800x420'), { size: null, width: 800, height: 420 })

	/* Cleared copy drops the key instead of leaving an empty string. */
	assert.deepEqual(patchFor('eyebrow', ''), { eyebrow: null })
})

test('applying no edits returns every checked-in spec byte for byte', () => {
	for (const name of readdirSync(join(root, 'og', 'specs'))) {
		const text = read(join('og', 'specs', name))
		const cards = (JSON.parse(text) as { cards?: unknown[] }).cards

		if (Array.isArray(cards)) {
			for (let i = 0; i < cards.length; i++) {
				assert.equal(applyEdits(text, [], i), text, `${name} card ${i} was reformatted`)
			}
		} else {
			assert.equal(applyEdits(text, [], null), text, `${name} was reformatted`)
		}
	}
})

test('an applied edit changes one value and nothing else', () => {
	const before = read('og/specs/demo.json')
	const after = applyEdits(before, [{ field: 'title', value: 'Only a headline' }], 0)

	assert.match(after, /"title": "Only a headline"/)
	assert.equal(after.split('\n').length, before.split('\n').length, 'the file did not change shape')
	assert.equal(
		after.replace('Only a headline', 'Only a title'),
		before,
		'nothing but the one value moved',
	)
})

test('an applied size edit removes the spelling it replaces', () => {
	const before = read('og/specs/demo-gif.json')
	const after = applyEdits(before, [{ field: 'size', value: 'square' }], null)

	assert.match(after, /"size": "square"/)
	assert.doesNotMatch(after, /"width"/)
	assert.doesNotMatch(after, /"height"/)
})

test('an applied source edit stays on one line', () => {
	const after = applyEdits(read('og/specs/demo.json'), [{ field: 'source', value: 'scene:prism' }], 1)
	assert.match(after, /"source": \{ "kind": "scene", "name": "prism" \}/)
})

test('an applied effects edit writes all four, on one line', () => {
	const after = applyEdits(read('og/specs/demo.json'), [{ field: 'effects', value: encodeEffects({}) }], 0)
	assert.match(after, /"effects": \{ "bloom": 0\.9, "chromaticAberration": 0\.0016, "noise": 0\.045, "vignette": 0\.5 \}/)
})

test('normalise resolves the dots a manifest outDir introduces', () => {
	assert.equal(normalise('og/specs/../../demo/og/minimal.jpg'), 'demo/og/minimal.jpg')
	assert.equal(normalise('og/./specs/a.json'), 'og/specs/a.json')
	assert.equal(normalise('../outside'), '../outside')
})
