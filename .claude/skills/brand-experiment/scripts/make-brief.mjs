/**
 * make-brief — packs the built design tokens into ONE self-contained brand
 * brief you can paste into Claude Chat (or any tool that can't `npm install`).
 *
 * Claude Chat has no access to this repo or the `pmndrs-design-tokens` package,
 * so an on-brand experiment there needs every value inlined: the paste-ready
 * `:root` block, the webfont `@import`, the colour table (OKLCH + hex + role),
 * the gradient rules with worked examples, and the design-language guidance.
 * This script assembles all of that from `dist/` — the generated source of
 * truth — so the brief never drifts from the tokens. Run it AFTER `pnpm build`.
 *
 *   node .claude/skills/brand-experiment/scripts/make-brief.mjs [outFile]
 *
 * Plain Node ESM on purpose — no tsx/esbuild — so it runs anywhere the repo is
 * checked out. Default output: dist/brand-brief.md (git-ignored, regenerated).
 * Pass a path to write elsewhere, or `-` to print to stdout only.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// scripts/ -> skill root -> .claude/skills -> .claude -> repo root
const skillRoot = resolve(here, '..')
const repoRoot = resolve(here, '..', '..', '..', '..')
const distDir = join(repoRoot, 'dist')

async function read(file) {
	try {
		return await readFile(file, 'utf8')
	} catch {
		throw new Error(`${file} not found. Run \`pnpm build\` first.`)
	}
}

// A short, plain-language role for each token so the brief reads as guidance,
// not just a data dump. Keyed by dot path; safe fallback for anything new.
const ROLE = {
	'brand.dark': 'Warm near-black. Page ground in dark layouts; text on light.',
	'brand.light': 'Warm off-white. Page ground in light layouts; text on dark.',
	'brand.purple': 'Signature accent — the pmndrs purple. Primary actions, focus.',
	'brand.red': 'Hot pink-red accent. Alerts, energy, highlights.',
	'brand.orange': 'Warm accent. Secondary highlights, warmth.',
	'brand.yellow': 'Electric yellow accent. Attention, sparks, hover glows.',
	'brand.green': 'Lime accent. Success, growth, fresh state.',
	'brand.teal': 'Neon teal accent. Cool highlights, active state.',
	'brand.blue': 'Cyan accent. Links, info, cool depth.',
	'brand.headline': 'Display family used for headlines. Aliased to family.serif.',
	'brand.space': 'Base spacing unit. Build the rhythm from multiples of this.',
	'brand.radius': 'Corner radius. Aliased to brand.space — soft, generous rounding.',
	'fonts.mono': 'Code, data, numeric/technical labels.',
	'fonts.sans': 'Body copy and UI. The workhorse.',
	'fonts.serif': 'Display / headlines. Distinctive, characterful.',
	'fonts.legible': 'Legibility-first face. Alerts and anything a reader must not miss.',
	// No `family.*` here on purpose. Those hold the same typefaces without the
	// fallback chain, and exist for Figma — which binds one family and has no
	// stack concept. A brief written for CSS should always reach for `fonts.*`.
}

async function main() {
	// dist/tokens.js is dependency-free ESM — import the live helpers so gradient
	// rules in the brief are the real ones, not a transcription.
	const mod = await import(pathToFileURL(join(distDir, 'tokens.js')).href)
	const { tokens, colorPaths, gradientColors, gradientStops, gradient } = mod

	// Hex comes from the W3C artifact — a `pnpm build` output that carries the
	// resolved sRGB `hex` for every colour. (Not `dist/figma-tokens.json`, which
	// is emitted by the separate figma-token-sync skill and may not exist.)
	const w3c = JSON.parse(await read(join(distDir, 'tokens.w3c.json')))
	const hexOf = Object.fromEntries(
		colorPaths.map((p) => {
			const node = p.split('.').reduce((acc, k) => acc?.[k], w3c)
			return [p, String(node.$value.hex).toUpperCase()]
		}),
	)

	const rootCss = (await read(join(distDir, 'tokens.css'))).trim()
	const fontsCss = (await read(join(distDir, 'fonts.css'))).trim()

	// Curated, deterministic gradient examples (no RNG, so output is stable).
	// Each obeys the adjacency rule; the last is intentionally symmetrical.
	const exampleStops = [
		['brand.purple', 'brand.teal', 'brand.orange'],
		['brand.blue', 'brand.purple', 'brand.red'],
		['brand.yellow', 'brand.green', 'brand.teal'],
		['brand.red', 'brand.orange', 'brand.yellow'],
		['brand.teal', 'brand.purple', 'brand.teal'],
	]

	const colorRows = colorPaths
		.map((p) => `| \`${p}\` | \`var(--${p.replace(/\./g, '-')})\` | \`${tokens[p]}\` | ${hexOf[p]} | ${ROLE[p] ?? ''} |`)
		.join('\n')

	const gradientRows = exampleStops
		.map((s) => `| ${s.map((p) => p.split('.')[1]).join(' → ')} | \`${gradient(s)}\` |`)
		.join('\n')

	const guidance = (await read(join(skillRoot, 'references', 'design-language.md')))
		.replace(/^---[\s\S]*?---\n/, '') // strip any frontmatter
		.trim()

	const brief = `# pmndrs brand kit — paste-in brief for Claude Chat

> Generated from this repo's built tokens by
> \`.claude/skills/brand-experiment/scripts/make-brief.mjs\`. Everything below is
> self-contained — no package install needed. Paste the whole document into a
> Claude Chat conversation, then ask for an on-brand artifact (landing page,
> component, generative visual, prototype…). It will have every token, font and
> rule it needs to stay on-brand.

## How to use this brief

Paste this document, then ask for what you want, e.g.:
*"Using the pmndrs brand kit above, build a single-file HTML landing page for a
fictional WebGL library. Use the tokens, the fonts, and one brand gradient."*

**Non-negotiables for staying on-brand:**

- Include the **font @import** and the **\`:root\` token block** below verbatim.
- Style **only** through the \`var(--…)\` custom properties — never hardcode a hex
  that duplicates a token.
- Grounds are \`brand.dark\` / \`brand.light\`; the other seven are **accents**.
- Space and rhythm come from multiples of \`--brand-space\` (16px). Corners use
  \`--brand-radius\`.

## Paste-ready CSS

Webfonts (put this first — it only names families, so it's opt-in):

\`\`\`css
${fontsCss}
\`\`\`

Tokens as CSS custom properties:

\`\`\`css
${rootCss}
\`\`\`

## Colours

Authored in OKLCH (perceptually uniform); hex is the exact sRGB round-trip.

| Token | CSS var | OKLCH | Hex | Role |
| --- | --- | --- | --- | --- |
${colorRows}

## Typography

| Token | Family | Role |
| --- | --- | --- |
| \`fonts.serif\` | \`${tokens['fonts.serif']}\` | ${ROLE['fonts.serif']} |
| \`fonts.sans\` | \`${tokens['fonts.sans']}\` | ${ROLE['fonts.sans']} |
| \`fonts.mono\` | \`${tokens['fonts.mono']}\` | ${ROLE['fonts.mono']} |
| \`fonts.legible\` | \`${tokens['fonts.legible']}\` | ${ROLE['fonts.legible']} |

## Spacing & radius

- \`--brand-space\`: **${tokens['brand.space']}** — the base unit. Compose spacing as
  \`calc(var(--brand-space) * N)\`.
- \`--brand-radius\`: **${tokens['brand.radius']}** — aliased to \`--brand-space\`, so
  overriding the space also rescales corners.

## Gradients

The one house gradient pattern. Rules:

- Exactly **${gradientStops.length} stops** at **${gradientStops.join('% / ')}%** along the line.
- Stops draw **only** from the accents (${gradientColors.map((p) => p.split('.')[1]).join(', ')}) —
  never \`brand.dark\`/\`brand.light\`.
- **No two adjacent stops may match.** First and last *may* match — that yields a
  symmetrical gradient.
- Default angle \`90deg\`; any CSS angle is fine.

Worked examples (drop straight into \`background\`):

| Stops | \`linear-gradient(…)\` |
| --- | --- |
${gradientRows}

For canvas/WebGL that can't read custom properties, use the literal OKLCH values
from the colour table instead of the \`var(--…)\` references.

---

${guidance}
`

	const outArg = process.argv[2]
	if (outArg === '-') {
		process.stdout.write(brief)
		return
	}
	const outPath = outArg ? resolve(process.cwd(), outArg) : join(distDir, 'brand-brief.md')
	await writeFile(outPath, brief, 'utf8')
	console.log(`brand-experiment: brief -> ${outPath}`)
	const fontCount = Object.keys(ROLE).filter((k) => k.startsWith('fonts.')).length
	console.log(
		`  ${colorPaths.length} colours, ${fontCount} font families, ${exampleStops.length} example gradients`,
	)
}

await main()
