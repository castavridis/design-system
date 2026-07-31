/**
 * emit-figma-tokens — flattens the built design tokens into a Figma-ready plan.
 *
 * Reads the generated W3C artifact (`dist/tokens.w3c.json`) — the only artifact
 * that carries resolved sRGB values (`hex` + 0–1 `components`) alongside token
 * `$type` and unresolved `{ref}` links — and emits one flat, ordered entry per
 * token describing exactly how it should exist as a Figma variable:
 *
 *   { key, collection, figmaName, type, scopes, codeSyntax, value | aliasOf }
 *
 * The push script consumes THIS, so colours, aliases and code syntax are never
 * hand-transcribed. Run it AFTER `pnpm build`.
 *
 *   pnpm figma:emit [outFile]
 *
 * Plain Node ESM on purpose — no tsx/esbuild, so it runs anywhere the repo is
 * checked out. Default output: dist/figma-tokens.json (git-ignored,
 * regenerated). Pass a path to write elsewhere, or `-` to print to stdout only.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

/*
 * Resolved from the working directory, not from this file's own location.
 *
 * This script used to live under `.claude/skills/figma-token-sync/scripts/` and
 * walked up four levels to find the repo. That lands on whichever checkout owns
 * the `.claude/` directory — which is the *main* checkout even when invoked from
 * a worktree beneath `.claude/worktrees/`, so it silently emitted the wrong
 * tree's tokens. Anchoring on `cwd` keeps it honest.
 */
const repoRoot = resolve(process.cwd())
const w3cPath = join(repoRoot, 'dist', 'tokens.w3c.json')
const tokensModulePath = join(repoRoot, 'dist', 'tokens.js')

/** Figma variable resolvedType per W3C `$type`. */
const TYPE_MAP = {
	color: 'COLOR',
	dimension: 'FLOAT',
	fontFamily: 'STRING',
	number: 'FLOAT',
	fontWeight: 'FLOAT',
}

/**
 * Figma variable scopes, keyed by leaf token name with a per-type fallback.
 * Never `ALL_SCOPES`. Neutrals (`dark`/`light`) are page grounds, so they scope
 * to fills only; accent colours can also stroke. Tune here if the token set grows.
 */
const SCOPE_BY_NAME = {
	dark: ['FRAME_FILL', 'SHAPE_FILL'],
	light: ['FRAME_FILL', 'SHAPE_FILL'],
	space: ['GAP'],
	radius: ['CORNER_RADIUS'],
}
const SCOPE_BY_TYPE = {
	COLOR: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
	FLOAT: ['GAP'],
	STRING: ['FONT_FAMILY'],
}

/** Ramp leaves are `<name>-<shade>`; the neutral rule keys off `<name>`. */
const RAMP_NEUTRALS = new Set(['dark', 'light'])

/**
 * Scopes for one token.
 *
 * Ramp steps need their own branch: their leaf is `dark-50`, not `dark`, so
 * `SCOPE_BY_NAME` never matches and every step — neutrals included — used to
 * fall through to the COLOR default and pick up `STROKE_COLOR`. That
 * contradicted the fills-only rule the neutrals exist under. A neutral ramp is
 * still a neutral.
 */
function scopesFor(collection, leaf, figmaType) {
	/* Every member of the radius scale is a corner radius, whatever it's called. */
	if (collection === 'radius') return SCOPE_BY_NAME.radius

	if (collection === 'ramp') {
		const base = leaf.slice(0, leaf.lastIndexOf('-'))
		return RAMP_NEUTRALS.has(base)
			? SCOPE_BY_NAME.dark
			: SCOPE_BY_TYPE.COLOR
	}

	return SCOPE_BY_NAME[leaf] ?? SCOPE_BY_TYPE[figmaType] ?? []
}

/** `brand.dark` -> `var(--brand-dark)` — the WEB code syntax Dev Mode shows. */
function codeSyntax(path) {
	return `var(--${path.replace(/\./g, '-')})`
}

/** A node is a token iff it declares a `$type`; otherwise recurse into it. */
function isToken(node) {
	return !!node && typeof node === 'object' && '$type' in node
}

/** `"{brand.space}"` -> `brand.space`; anything else -> null. */
function refTarget(value) {
	if (typeof value !== 'string') return null
	const m = value.match(/^\{(.+)\}$/)
	return m ? m[1] : null
}

function resolveValue(figmaType, raw) {
	if (figmaType === 'COLOR') {
		const [r, g, b] = raw.components
		// Figma's Plugin API wants 0–1 rgb — which is exactly `components`.
		return { r, g, b, a: raw.alpha ?? 1, hex: raw.hex }
	}
	if (figmaType === 'FLOAT') {
		// Dimension: `{ value, unit }`. Figma FLOAT is unitless px.
		if (raw && typeof raw === 'object' && 'value' in raw) return raw.value
		return Number(raw)
	}
	return raw // STRING: font family, verbatim
}

function walk(node, trail, out) {
	for (const [name, child] of Object.entries(node)) {
		const path = [...trail, name]
		if (isToken(child)) {
			const figmaType = TYPE_MAP[child.$type]
			if (!figmaType) {
				throw new Error(`Unmapped $type "${child.$type}" at ${path.join('.')}`)
			}
			const key = path.join('.')
			const entry = {
				key, // dot path — matches dist/tokens.json keys, the round-trip id
				collection: path[0], // top-level scope -> variable collection
				figmaName: path.join('/'), // slash path -> Figma variable name
				type: figmaType,
				scopes: scopesFor(path[0], name, figmaType),
				codeSyntax: codeSyntax(key),
			}
			const alias = refTarget(child.$value)
			if (alias) entry.aliasOf = alias // a Figma VARIABLE_ALIAS target
			else entry.value = resolveValue(figmaType, child.$value)
			out.push(entry)
		} else if (child && typeof child === 'object') {
			walk(child, path, out)
		}
	}
}

/**
 * Re-links each ramp's seed step to the brand colour it was generated from.
 *
 * `rampStops()` bakes the seed's value into its step, so `ramp.purple-500` and
 * `brand.purple` arrive here as two identical, unrelated hex literals — a stale
 * twin waiting to drift the moment someone edits one of them in Figma. The
 * design book knows the correspondence (`rampSeeds`, asserted at build time by
 * `rampSeedShades()` in build.ts); this restores it as a real Figma alias.
 *
 * Note the seed shade is not the same step for every hue — `purple` lands on
 * 500 but the much lighter `teal` on 300 — which is exactly why this is read
 * from the build rather than assumed.
 */
function aliasRampSeeds(tokens, rampSeeds) {
	const byKey = new Map(tokens.map((t) => [t.key, t]))
	const linked = []

	for (const [name, shade] of Object.entries(rampSeeds)) {
		const entry = byKey.get(`ramp.${name}-${shade}`)
		if (!entry) continue

		delete entry.value
		entry.aliasOf = `brand.${name}`
		linked.push(entry.key)
	}

	return linked
}

/**
 * Figma cannot alias a variable that doesn't exist yet, so the push applies
 * these in array order and every alias target must already have been created.
 * Cheaper to catch here than to debug a half-populated collection.
 */
function assertAliasOrder(tokens) {
	const seen = new Set()

	for (const token of tokens) {
		if (token.aliasOf && !seen.has(token.aliasOf)) {
			throw new Error(
				`${token.key} aliases ${token.aliasOf}, which is not defined before it. ` +
					`Reorder the scopes in src/pmndrs-design-book.ts so targets come first.`,
			)
		}
		seen.add(token.key)
	}
}

async function main() {
	let raw
	try {
		raw = await readFile(w3cPath, 'utf8')
	} catch {
		throw new Error(`${w3cPath} not found. Run \`pnpm build\` first.`)
	}
	const tree = JSON.parse(raw)

	const tokens = []
	walk(tree, [], tokens)

	/* Imported rather than recomputed: the design book is the only thing that
	   knows which step a seed landed on. */
	const { rampSeeds } = await import(pathToFileURL(tokensModulePath).href)
	if (!rampSeeds) {
		throw new Error(
			`${tokensModulePath} exports no \`rampSeeds\`. Rebuild with \`pnpm build\`.`,
		)
	}

	const linked = aliasRampSeeds(tokens, rampSeeds)
	assertAliasOrder(tokens)

	const plan = {
		source: 'dist/tokens.w3c.json',
		collections: [...new Set(tokens.map((t) => t.collection))],
		count: tokens.length,
		aliases: tokens.filter((t) => t.aliasOf).length,
		tokens,
	}
	const json = JSON.stringify(plan, null, '\t')

	const outArg = process.argv[2]
	if (outArg === '-') {
		process.stdout.write(json + '\n')
	} else {
		const outPath = outArg
			? resolve(process.cwd(), outArg)
			: join(repoRoot, 'dist', 'figma-tokens.json')
		await writeFile(outPath, json + '\n', 'utf8')
		console.log(
			`figma-token-sync: ${tokens.length} tokens, ${plan.aliases} aliases -> ${outPath}`,
		)
		console.log(`  ramp seeds linked to their brand colour: ${linked.join(', ')}`)
	}
}

await main()
