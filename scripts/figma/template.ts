/**
 * The card *template* — the layout itself, as something a designer can move.
 *
 * `og.ts` round-trips what a card says: title, accent, seed. This round-trips
 * where it says it. The two are deliberately separate artifacts, because they
 * fail differently: a wrong title is one bad card, a wrong layout is every card
 * the generator will ever produce.
 *
 * The whole thing rests on one property of `og/layout/card.json` — it is
 * authored at the reference box, 1200×630, and the renderer scales from there.
 * So the Figma template frame is exactly 1200×630, and the numbers in the JSON
 * *are* the coordinates in Figma's inspector. There is no unit conversion to
 * get wrong in either direction, and a template someone has resized is a loud
 * error rather than a silently rescaled layout.
 *
 * What comes back from geometry and what comes back from a typed field is a
 * deliberate split, not a limitation:
 *
 *   geometry  where a block sits, how wide it is, what size the type is —
 *             everything a designer expresses by dragging.
 *   fields    which edge a block hangs from, how its children stack, and the
 *             rule that shrinks a long headline. None of these are visible in
 *             a single frame's geometry: a block drawn 68px from the left of a
 *             1200px frame and 68px from the right of it is the same rectangle,
 *             and only the anchor says which of those the designer meant.
 *
 * Both halves flatten into one map of dotted keys, so the same three-way
 * `reconcile` that settles a colour settles a layout.
 *
 * Pure and offline, like the rest of `scripts/figma/`.
 */

/** Every scalar in the layout, as `layout.blocks.message.offset.x -> "68"`. */
export type Values = Record<string, string>

export const SCOPE = 'layout'

export const ANCHORS = [
	'top-left',
	'top-center',
	'top-right',
	'middle-left',
	'middle-center',
	'middle-right',
	'bottom-left',
	'bottom-center',
	'bottom-right',
]

export const ALIGNS = ['left', 'center', 'right']
export const DIRECTIONS = ['row', 'column']
export const FONTS = ['serif', 'sans', 'mono']
export const INKS = ['ink', 'inkMuted', 'accent', 'ground']

/**
 * Keys a designer changes by dragging rather than by typing.
 *
 * Matched as a suffix, so `blocks.brand.offset.x` and `blocks.message.offset.x`
 * are both geometry without either being named. The push draws these; the
 * snapshot measures them back off the canvas.
 */
const GEOMETRY = [
	/\.offset\.(x|y)$/,
	/\.measure$/,
	/^layout\.type\.\w+\.size$/,
	/^layout\.type\.\w+\.tracking$/,
	/^layout\.type\.\w+\.leading$/,
	/^layout\.marks\.dot\.(size|glow)$/,
	/^layout\.marks\.rule\.(width|height|radius)$/,
	/^layout\.marks\.chip\.(padX|padY|radius)$/,
]

export const isGeometry = (key: string) => GEOMETRY.some((pattern) => pattern.test(key))

/** Fields that accept "nothing" as an answer. A measure means hug the content. */
const NULLABLE = /\.measure$/

/* ------------------------------------------------------------- flattening */

/**
 * Every leaf of the layout, keyed by its path.
 *
 * `null` flattens to the empty string, which is also how a cleared field comes
 * back from Figma — and `measure: null` genuinely means "no measure, hug the
 * content", so the two agree on what emptiness is.
 */
export function flatten(value: unknown, prefix = SCOPE): Values {
	if (value === null) return { [prefix]: '' }
	if (typeof value !== 'object') return { [prefix]: String(value) }

	const out: Values = {}
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		Object.assign(out, flatten(child, `${prefix}.${key}`))
	}
	return out
}

/**
 * The value a key should take, typed by what the layout already holds there.
 *
 * The current layout is the schema. Reading the existing leaf tells us whether
 * a key is a number, a string or a nullable measure, so nothing here restates a
 * type that `layout.ts` already declares — and a key with no counterpart is an
 * error rather than a new field invented by a typo in a layer name.
 */
export function coerce(layout: unknown, key: string, value: string): string | number | null {
	const path = key.split('.').slice(1)
	let current: unknown = layout

	for (const step of path) {
		if (current === null || typeof current !== 'object' || !(step in (current as object))) {
			throw new Error(`\`${key}\` is not a field of og/layout/card.json.`)
		}
		current = (current as Record<string, unknown>)[step]
	}

	const trimmed = value.trim()

	/*
	 * Nullability is a property of the *field*, not of what it happens to hold.
	 * Deciding it from the current value looks equivalent and is not: a measure
	 * standing at 1064 would read as a plain number, `Number('')` would come
	 * back 0, and a block a designer had set to hug would silently collapse to
	 * nothing wide instead.
	 */
	if (NULLABLE.test(key)) {
		if (trimmed === '') return null
		const number = Number(trimmed)
		if (!Number.isFinite(number)) throw new Error(`\`${key}\` takes a number or nothing, received \`${value}\`.`)
		return number
	}

	if (typeof current === 'number') {
		const number = Number(trimmed)
		if (!Number.isFinite(number)) throw new Error(`\`${key}\` takes a number, received \`${value}\`.`)
		return number
	}

	/* Strings are all closed sets, and every one of them is worth checking:
	   an anchor Figma cannot express is a layout the renderer cannot draw. */
	const allowed = allowedFor(key)
	if (allowed && !allowed.includes(trimmed)) {
		throw new Error(`\`${key}\` cannot be \`${value}\`. Expected one of: ${allowed.join(', ')}.`)
	}
	return trimmed
}

function allowedFor(key: string): string[] | null {
	if (key.endsWith('.anchor')) return ANCHORS
	if (key.endsWith('.align')) return ALIGNS
	if (key.endsWith('.direction')) return DIRECTIONS
	if (key.endsWith('.font')) return FONTS
	if (key.endsWith('.ink')) return INKS
	if (key.endsWith('.case')) return ['upper']
	return null
}

/**
 * The layout file with the edits applied and its formatting intact.
 *
 * Re-serialised and then re-collapsed to the house style, the same way
 * `og.ts` writes a card spec back — and guarded by the same test, which round
 * trips the checked-in file through here with no edits and asserts the bytes
 * come back identical.
 */
export function applyEdits(text: string, edits: readonly { key: string; value: string }[]): string {
	const layout = JSON.parse(text) as Record<string, unknown>

	for (const { key, value } of edits) {
		const typed = coerce(layout, key, value)
		const path = key.split('.').slice(1)
		let node = layout as Record<string, unknown>
		for (const step of path.slice(0, -1)) node = node[step] as Record<string, unknown>
		node[path[path.length - 1] as string] = typed
	}

	return `${collapse(JSON.stringify(layout, null, '\t'))}\n`
}

/**
 * Puts the small flat records back on one line.
 *
 * `reference`, an `offset`, and every entry under `type` and `marks` is a
 * handful of scalars that reads better as a row than as a five-line stanza —
 * which is how the file is authored, so expanding them would turn the first
 * dragged block into a diff across the whole file. `blocks` entries stay
 * expanded: they are long enough that one line would run off the screen.
 */
function collapse(json: string) {
	return json.replace(/\{[^{}]*\}/g, (match) => {
		const inline = match.replace(/\s*\n\s*/g, ' ').replace(/\{ +/, '{ ').replace(/ +\}/, ' }')
		return inline.length <= 96 ? inline : match
	})
}

/* --------------------------------------------------------- the block boxes */

export interface Reference {
	width: number
	height: number
}

/**
 * Where a block's rectangle sits in the template frame.
 *
 * The inverse of the renderer's `blockPosition`, and it has to stay the
 * inverse: `template.test.ts` round trips every anchor through `boxOf` and
 * `offsetFrom` and fails if the pair ever disagree, because a push that drew a
 * block somewhere the pull would read differently is a layout that walks across
 * the card a little further on every sync.
 */
export function boxOf(
	block: { anchor: string; offset: { x: number; y: number }; measure: number | null },
	size: { width: number; height: number },
	reference: Reference,
) {
	const [vertical, horizontal] = block.anchor.split('-')

	const x =
		horizontal === 'left'
			? block.offset.x
			: horizontal === 'right'
				? reference.width - block.offset.x - size.width
				: (reference.width - size.width) / 2 + block.offset.x

	const y =
		vertical === 'top'
			? block.offset.y
			: vertical === 'bottom'
				? reference.height - block.offset.y - size.height
				: (reference.height - size.height) / 2 + block.offset.y

	return { x, y, width: size.width, height: size.height }
}

/** The offset a block's drawn rectangle implies, given the anchor it hangs from. */
export function offsetFrom(
	anchor: string,
	box: { x: number; y: number; width: number; height: number },
	reference: Reference,
) {
	const [vertical, horizontal] = anchor.split('-')

	const x =
		horizontal === 'left'
			? box.x
			: horizontal === 'right'
				? reference.width - box.x - box.width
				: box.x - (reference.width - box.width) / 2

	const y =
		vertical === 'top'
			? box.y
			: vertical === 'bottom'
				? reference.height - box.y - box.height
				: box.y - (reference.height - box.height) / 2

	return { x: round(x), y: round(y) }
}

/** Figma hands back sub-pixel floats; the layout is authored to 0.1px. */
export const round = (n: number) => Math.round(n * 10) / 10

/* ---------------------------------------------------------------- summary */

export function describe(values: Values) {
	const geometry = Object.keys(values).filter(isGeometry)
	return [
		`${Object.keys(values).length} layout values`,
		`  ${geometry.length} from geometry, ${Object.keys(values).length - geometry.length} from typed fields`,
	].join('\n')
}
