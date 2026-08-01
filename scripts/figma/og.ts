/**
 * Reads the OG card generator into a set of Figma-shaped templates — the fourth
 * artifact in the round trip, beside the tokens, the component contract and the
 * demo page.
 *
 * An OG card is not like a Button. A Button's Figma counterpart is a drawing of
 * the same thing the code draws, and the round trip's job is to stop the two
 * drawings disagreeing. A card's artwork is a three.js render: bloom, fringing,
 * a wordmark set in 3D by troika. Figma cannot draw that, and a hand-made
 * approximation would be exactly the second, unowned definition the rest of
 * this directory exists to prevent.
 *
 * So the split here is between output and input. The render is *output* — it
 * arrives in Figma as the image it is, and nothing done to it there could be
 * read back. The spec is *input* — a dozen plain fields, and every one of them
 * is something a designer has an opinion about. Those fields are what round
 * trips: change the title or the accent on the card in Figma, pull it, and the
 * edit lands in `og/specs/*.json`, where the next render reads it.
 *
 * Which cards exist is read rather than restated. `og/package.json`'s `demo`
 * script is the render plan — it names every spec file, whether it is a
 * manifest, and where the output lands — so the templates are, by construction,
 * exactly the cards `pnpm og:demo` produces. A card added to the demo appears
 * in Figma on the next push without anything here being told about it.
 *
 * Pure and offline, like `page.ts` and `reconcile.ts`: strings in, data out, so
 * every decision is testable without Figma, a browser or a GPU.
 */

import { rampNames } from '../../src/pmndrs-design-book.js'

/* ---------------------------------------------------------------- the spec */

/**
 * The defaults `resolveSpec` applies, restated.
 *
 * Duplicated from `og/src/lib/spec.ts` for the same reason `page.ts` restates
 * the Button variant table: that file is part of a browser bundle whose imports
 * reach the React scene registry and from there all of three.js, and dragging
 * that into a Node script to read four numbers would be a poor trade. The
 * duplication is safe because `og.test.ts` reads the real file and fails if
 * these drift — the two cannot quietly disagree.
 */
export const DEFAULTS = {
	accent: 'purple',
	theme: 'dark',
	size: 'og',
	scene: 'ramp-orbit',
	seed: 1,
	atSeconds: 2,
	loopSeconds: 6,
} as const

export const DEFAULT_EFFECTS = {
	bloom: 0.9,
	chromaticAberration: 0.0016,
	noise: 0.045,
	vignette: 0.5,
} as const

/** Effect names in the order the panel lists them. */
export const EFFECT_NAMES = Object.keys(DEFAULT_EFFECTS) as Array<keyof typeof DEFAULT_EFFECTS>

export const SIZES: Record<string, { width: number; height: number }> = {
	og: { width: 1200, height: 630 },
	square: { width: 1200, height: 1200 },
	wide: { width: 1920, height: 1080 },
}

export const THEMES = ['dark', 'light']
export const SCENES = ['ramp-orbit', 'token-grid', 'prism']
export const SOURCE_KINDS = ['scene', 'image', 'video']

/**
 * The fields that round trip, in the order the Figma panel lists them.
 *
 * Everything a spec can say, minus what a person cannot usefully edit as text.
 * `wordmark` is left out on purpose: it defaults to the title behind a scene
 * and to nothing over media, so a panel showing it would print the title twice
 * and invite someone to desynchronise the two by editing one of them.
 */
export const FIELDS = [
	'eyebrow',
	'title',
	'subtitle',
	'meta',
	'accent',
	'theme',
	'size',
	'source',
	'effects',
	'seed',
	'atSeconds',
	'loopSeconds',
] as const

export type Field = (typeof FIELDS)[number]

/** The scope every OG key sits under, for `reconcile`'s per-scope policy. */
export const SCOPE = 'og'

/* --------------------------------------------------------- the render plan */

/** One `tsx scripts/render.ts …` invocation out of `og/package.json`. */
export interface RenderCommand {
	/** Path relative to `og/` — `specs/demo.json`. */
	spec: string
	manifest: boolean
	/** `--out`, relative to `og/`. Absent for a manifest, which names its own. */
	out?: string
	/** What the command writes. */
	kind: 'still' | 'gif' | 'mp4'
}

/**
 * The demo render plan, read out of `og/package.json`.
 *
 * The `demo` script is where the single-spec cards' output paths are actually
 * declared — `render.ts` only reads `out` from a manifest, so `demo-loop.json`
 * has no way to say where it lands. Parsing the script means that path is read
 * from the one place that states it rather than copied into a table here, the
 * same reason `page.ts` reads a Code block's props out of the markup instead of
 * taking them from an attribute someone has to remember to update.
 */
export function renderPlan(packageJson: string): RenderCommand[] {
	const script = (JSON.parse(packageJson) as { scripts?: Record<string, string> }).scripts?.demo
	if (!script) throw new Error('og/package.json has no `demo` script — nothing to read the card list from.')

	const commands: RenderCommand[] = []

	for (const step of script.split('&&')) {
		const argv = step.trim().split(/\s+/)
		const at = argv.indexOf('scripts/render.ts')
		if (at === -1) continue

		/* The first bare argument after the script itself is the spec file. */
		const spec = argv.slice(at + 1).find((a) => !a.startsWith('--'))
		if (!spec) continue

		const outAt = argv.indexOf('--out')
		const out = outAt === -1 ? undefined : argv[outAt + 1]

		commands.push({
			spec,
			manifest: argv.includes('--manifest'),
			...(out ? { out } : {}),
			kind: argv.includes('--gif') ? 'gif' : argv.includes('--mp4') ? 'mp4' : 'still',
		})
	}

	if (!commands.length) throw new Error('og/package.json `demo` script runs no renders. Has it been rewritten?')
	return commands
}

/* -------------------------------------------------------------- the fields */

/** A card spec as authored, before `resolveSpec` fills anything in. */
export interface RawSpec {
	title?: string
	eyebrow?: string
	subtitle?: string
	meta?: string
	accent?: string
	theme?: string
	size?: string
	width?: number
	height?: number
	source?: { kind?: string; name?: string; src?: string; fit?: string }
	effects?: Partial<Record<keyof typeof DEFAULT_EFFECTS, number>>
	seed?: number
	atSeconds?: number
	loopSeconds?: number
}

export interface Manifest {
	outDir?: string
	cards?: Array<RawSpec & { out?: string }>
}

/**
 * The card's pixel box.
 *
 * `width`/`height` override `size` in the spec, so a card that sets them has no
 * named size at all — the loop is 800×420 and the GIF 400×210. Both spellings
 * collapse into one field below; this is the resolved answer either way.
 */
export function boxOf(spec: RawSpec) {
	const named = SIZES[spec.size ?? DEFAULTS.size] ?? SIZES.og ?? { width: 1200, height: 630 }
	return {
		width: Math.round(spec.width ?? named.width),
		height: Math.round(spec.height ?? named.height),
	}
}

/**
 * `og`, `square`, `wide` — or `800x420` when the spec gives exact pixels.
 *
 * One field rather than three, because "how big is this card" is one question.
 * A designer types either a name or a box, and `decodeSize` sorts out which of
 * `size` and `width`/`height` the spec should end up carrying.
 */
export function encodeSize(spec: RawSpec): string {
	if (spec.width != null || spec.height != null) {
		const box = boxOf(spec)
		return `${box.width}x${box.height}`
	}
	return spec.size ?? DEFAULTS.size
}

export function decodeSize(value: string): { size?: string; width?: number; height?: number } {
	const trimmed = value.trim()
	/* `1200x630`, and the × someone will paste back from the caption beside it. */
	const box = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(trimmed)
	if (box) return { width: Number(box[1]), height: Number(box[2]) }

	if (!(trimmed in SIZES)) {
		throw new Error(
			`\`${value}\` is not a size. Expected one of ${Object.keys(SIZES).join(', ')}, or a box like 1200x630.`,
		)
	}
	return { size: trimmed }
}

/** `scene:ramp-orbit`, `image:../demo/og/minimal.jpg` — the tagged union, flat. */
export function encodeSource(spec: RawSpec): string {
	const source = spec.source
	if (!source || !source.kind || source.kind === 'scene') return `scene:${source?.name ?? DEFAULTS.scene}`
	return `${source.kind}:${source.src ?? ''}`
}

export function decodeSource(value: string): NonNullable<RawSpec['source']> {
	const at = value.indexOf(':')
	if (at === -1) throw new Error(`\`${value}\` is not a source. Expected \`kind:value\`, e.g. scene:${DEFAULTS.scene}.`)

	const kind = value.slice(0, at).trim()
	const rest = value.slice(at + 1).trim()

	if (!SOURCE_KINDS.includes(kind)) {
		throw new Error(`Unknown source kind \`${kind}\`. Expected one of: ${SOURCE_KINDS.join(', ')}.`)
	}
	if (kind === 'scene') {
		if (!SCENES.includes(rest)) throw new Error(`Unknown scene \`${rest}\`. Expected one of: ${SCENES.join(', ')}.`)
		return { kind, name: rest }
	}
	if (!rest) throw new Error(`A ${kind} source needs a \`src\`.`)
	return { kind, src: rest }
}

/**
 * Every effect, resolved — `bloom=0.9, chromaticAberration=0.0016, …`.
 *
 * Resolved rather than only the overrides, because a panel reading `default`
 * gives a designer nothing to change. The cost is that editing one effect
 * writes all four into the spec, which is honest: after that edit they *are*
 * all pinned.
 */
export function encodeEffects(spec: RawSpec): string {
	const effects = { ...DEFAULT_EFFECTS, ...(spec.effects ?? {}) }
	return EFFECT_NAMES.map((name) => `${name}=${effects[name]}`).join(', ')
}

export function decodeEffects(value: string): Record<string, number> {
	const out: Record<string, number> = {}

	for (const pair of value.split(',')) {
		if (!pair.trim()) continue
		const [rawName, rawValue] = pair.split('=')
		const name = (rawName ?? '').trim()
		if (!EFFECT_NAMES.includes(name as keyof typeof DEFAULT_EFFECTS)) {
			throw new Error(`Unknown effect \`${name}\`. Expected one of: ${EFFECT_NAMES.join(', ')}.`)
		}
		const number = Number((rawValue ?? '').trim())
		if (!Number.isFinite(number)) throw new Error(`Effect \`${name}\` needs a number, received \`${rawValue}\`.`)
		out[name] = number
	}

	return out
}

/** Every syncable field of one card, resolved, as the strings both sides compare. */
export function fieldsOf(spec: RawSpec): Record<Field, string> {
	return {
		eyebrow: spec.eyebrow ?? '',
		title: spec.title ?? '',
		subtitle: spec.subtitle ?? '',
		meta: spec.meta ?? '',
		accent: spec.accent ?? DEFAULTS.accent,
		theme: spec.theme ?? DEFAULTS.theme,
		size: encodeSize(spec),
		source: encodeSource(spec),
		effects: encodeEffects(spec),
		seed: String(spec.seed ?? DEFAULTS.seed),
		atSeconds: String(spec.atSeconds ?? DEFAULTS.atSeconds),
		loopSeconds: String(spec.loopSeconds ?? DEFAULTS.loopSeconds),
	}
}

/**
 * The edit one field implies, as the keys and values a spec file should carry.
 *
 * Returns a patch rather than writing one, so `applyEdits` stays the only thing
 * that touches a file and this stays testable. A field that resolves to more
 * than one key — `size` becomes either `size` or `width` + `height` — says so
 * by returning `null` for the keys it wants removed.
 */
export function patchFor(field: Field, value: string): Record<string, unknown> {
	switch (field) {
		case 'eyebrow':
		case 'subtitle':
		case 'meta':
			/* Empty means the card genuinely has none, so drop the key rather than
			   leave `"eyebrow": ""` behind for the next reader to wonder about. */
			return { [field]: value === '' ? null : value }

		case 'title':
			if (value.trim() === '') throw new Error('A card needs a non-empty `title`.')
			return { title: value }

		case 'accent':
			if (!rampNames.includes(value)) {
				throw new Error(`Unknown accent \`${value}\`. Expected one of: ${rampNames.join(', ')}.`)
			}
			return { accent: value }

		case 'theme':
			if (!THEMES.includes(value)) throw new Error(`Unknown theme \`${value}\`. Expected one of: ${THEMES.join(', ')}.`)
			return { theme: value }

		case 'size': {
			const box = decodeSize(value)
			/* Exactly one spelling survives: a spec holding both would have a named
			   size its own pixels contradict. */
			return { size: box.size ?? null, width: box.width ?? null, height: box.height ?? null }
		}

		case 'source':
			return { source: decodeSource(value) }

		case 'effects':
			return { effects: decodeEffects(value) }

		case 'seed':
		case 'atSeconds':
		case 'loopSeconds': {
			const number = Number(value.trim())
			if (!Number.isFinite(number)) throw new Error(`\`${field}\` needs a number, received \`${value}\`.`)
			return { [field]: number }
		}
	}
}

/* ----------------------------------------------------------- the templates */

export interface Template {
	/** Stable identity — `demo/minimal`, `demo-loop`. Names the Figma component. */
	key: string
	/** Repo-relative spec file the card is authored in. */
	source: string
	/** Index into the manifest's `cards`, or `null` for a single-spec file. */
	card: number | null
	/** Repo-relative artefact Figma can show, or `null` if nothing is rendered. */
	art: string | null
	/** What the card renders as — a still, a GIF, an mp4. */
	kind: RenderCommand['kind']
	/** Repo-relative path of the real output, which for an mp4 is not `art`. */
	out: string | null
	width: number
	height: number
	fields: Record<Field, string>
}

/** Figma can place an image; anything else needs a still standing in for it. */
const DISPLAYABLE = /\.(png|jpe?g|gif|webp)$/i

const stem = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')

/**
 * Every card the demo renders, in the order the plan renders them.
 *
 * `specFiles` is keyed by path relative to `og/` — the CLI reads them, so this
 * stays a pure function of its inputs.
 */
export function templatesFrom(commands: readonly RenderCommand[], specFiles: Record<string, string>): Template[] {
	/* Keyed, because one spec file can be rendered by several commands: the loop
	   is written once as an mp4 and once as the poster still beside it. */
	const byKey = new Map<string, Template>()

	for (const command of commands) {
		const text = specFiles[command.spec]
		if (text === undefined) throw new Error(`${command.spec} is in the demo plan but was not read.`)

		let parsed: unknown
		try {
			parsed = JSON.parse(text)
		} catch (error) {
			throw new Error(`og/${command.spec} is not valid JSON — ${(error as Error).message}`)
		}

		const cards = command.manifest
			? manifestCards(parsed, command.spec)
			: [{ spec: parsed as RawSpec, index: null as number | null }]

		for (const { spec, index } of cards) {
			const out = outPathFor(command, parsed as Manifest, spec, index)
			const key = index === null ? stem(command.spec) : `${stem(command.spec)}/${stem(out ?? String(index))}`

			const existing = byKey.get(key)
			if (existing) {
				/* A later command with a displayable output wins the artwork, which is
				   how the poster still becomes the face of the mp4 template. */
				if (out && DISPLAYABLE.test(out)) existing.art = out
				continue
			}

			const box = boxOf(spec)
			byKey.set(key, {
				key,
				source: `og/${command.spec}`,
				card: index,
				art: out && DISPLAYABLE.test(out) ? out : null,
				kind: command.kind,
				out,
				width: box.width,
				height: box.height,
				fields: fieldsOf(spec),
			})
		}
	}

	return [...byKey.values()]
}

function manifestCards(parsed: unknown, spec: string) {
	const manifest = parsed as Manifest
	if (!Array.isArray(manifest.cards)) {
		throw new Error(`og/${spec} is rendered with --manifest but has no \`cards\` array.`)
	}
	return manifest.cards.map((card, index) => ({ spec: card as RawSpec, index: index as number | null }))
}

/**
 * Where a card's output lands, repo-relative.
 *
 * Both spellings resolve against `og/`: a manifest's `outDir` is relative to
 * the manifest file, and `--out` is relative to the directory the demo script
 * runs in, which is the same place.
 */
function outPathFor(
	command: RenderCommand,
	manifest: Manifest,
	spec: RawSpec & { out?: string },
	index: number | null,
) {
	if (index === null) return command.out ? normalise(`og/${command.out}`) : null
	if (!spec.out) return null
	return normalise(`og/${dirOf(command.spec)}/${manifest.outDir ?? '.'}/${spec.out}`)
}

const dirOf = (path: string) => path.split('/').slice(0, -1).join('/') || '.'

/** Collapses `a/./b` and `a/b/../c`, so the path matches what is on disk. */
export function normalise(path: string) {
	const out: string[] = []
	for (const part of path.split('/')) {
		if (part === '' || part === '.') continue
		if (part === '..' && out.length && out[out.length - 1] !== '..') out.pop()
		else out.push(part)
	}
	return out.join('/')
}

/** `og.demo/minimal.title` — the key `reconcile` compares on. */
export const keyOf = (template: string, field: string) => `${SCOPE}.${template}.${field}`

/** Splits a key back into its parts. A template key may itself contain dots. */
export function parseKey(key: string) {
	const parts = key.split('.')
	if (parts.length < 3 || parts[0] !== SCOPE) return null
	const field = parts[parts.length - 1] as Field
	if (!FIELDS.includes(field)) return null
	return { template: parts.slice(1, -1).join('.'), field }
}

/** Every template's fields, flattened into the map `reconcile` takes. */
export function valuesOf(templates: readonly Template[]): Record<string, string> {
	const out: Record<string, string> = {}
	for (const template of templates) {
		for (const field of FIELDS) out[keyOf(template.key, field)] = template.fields[field]
	}
	return out
}

/* --------------------------------------------------------- writing it back */

/**
 * The spec file, with the edits applied and its formatting intact.
 *
 * Re-serialised rather than spliced textually — a hand-rolled JSON patcher is a
 * parser waiting to be written badly — and then re-collapsed to the house
 * style, where a `source` or an `effects` object sits on one line. `og.test.ts`
 * round trips every checked-in spec through this with no edits and asserts the
 * bytes come back identical, so it cannot quietly reformat the repo on the
 * first pull that changes a title.
 */
export function applyEdits(
	text: string,
	edits: readonly { field: Field; value: string }[],
	card: number | null,
): string {
	const parsed = JSON.parse(text) as Manifest | RawSpec

	const target = (card === null ? parsed : (parsed as Manifest).cards?.[card]) as
		| (RawSpec & Record<string, unknown>)
		| undefined
	if (!target) throw new Error(`no card at index ${card}`)

	for (const { field, value } of edits) {
		for (const [key, patch] of Object.entries(patchFor(field, value))) {
			if (patch === null) delete target[key]
			else target[key] = patch
		}
	}

	return `${collapse(JSON.stringify(parsed, null, '\t'))}\n`
}

/**
 * Puts `source` and `effects` back on one line.
 *
 * They are small flat records rather than nested structure, and every
 * checked-in spec writes them inline; expanding them over five lines each would
 * turn the first applied edit into a diff across every card in the file.
 */
function collapse(json: string) {
	return json.replace(/"(source|effects)": \{[^{}]*\}/g, (match) =>
		match.replace(/\s*\n\s*/g, ' ').replace(/\{ +/, '{ ').replace(/ +\}/, ' }'),
	)
}

/* ------------------------------------------------------------- the summary */

export function describe(templates: readonly Template[]) {
	const missing = templates.filter((t) => !t.art)
	const lines = [
		`${templates.length} templates from ${new Set(templates.map((t) => t.source)).size} spec files`,
		`  ${templates.filter((t) => t.art).length} with a render on disk`,
	]
	if (missing.length) {
		lines.push(`  ${missing.length} not rendered yet (run \`pnpm og:demo\`): ${missing.map((t) => t.key).join(', ')}`)
	}
	return lines.join('\n')
}
