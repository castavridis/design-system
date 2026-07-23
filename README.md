# pmndrs-design-tokens

Design tokens defined once in TypeScript, built by Node into artifacts any
framework can consume: plain CSS custom properties, plain JSON, the
[W3C Design Tokens](https://www.designtokens.org/tr/drafts/format/) format, and
a dependency-free ESM module with types.

Nothing in the published output imports a framework — or even
[`design-book`](https://github.com/meodai/design-book), which is a build-time
dependency only.

## Layout

| Path | Role |
| --- | --- |
| `src/pmndrs-design-book.ts` | Source of truth — the token definitions |
| `scripts/build.ts` | Node build; renders the book into `dist/` |
| `scripts/site.ts` | Assembles the deployable site into `public/` |
| `scripts/serve.ts` | Dependency-free static server for the demo |
| `demo/` | Landing page that consumes the build output |
| `dist/` | Generated artifacts (git-ignored, published to npm) |
| `public/` | Assembled static site (git-ignored, deployed) |

## Usage

```bash
pnpm install
pnpm build      # render dist/
pnpm demo       # build, then serve the demo at http://localhost:5173
pnpm preview    # assemble public/ and serve it exactly as the host will
pnpm watch      # re-render on change
pnpm typecheck
```

## Deploying

The repo deploys to Vercel with no configuration beyond the committed
`vercel.json`: import it and accept the defaults.

```
buildCommand    pnpm run build:site
outputDirectory public
framework       none (static)
```

`build:site` renders the tokens and then assembles `public/` — `index.html` at
the root, with `/demo/` and `/dist/` beneath it. The demo's asset paths are
root-absolute, so nothing is rewritten during assembly and the deployed site is
byte-identical to what `pnpm preview` serves locally. Only that assembled
directory is published, so `src/`, `scripts/` and `node_modules/` never leave
your machine.

Both `dist/` and `public/` are git-ignored and regenerated on every deploy, so
a fresh clone builds the same site from `src/` alone.

## Demo

`demo/index.html` is plain HTML with no framework and no bundler. It links
`dist/tokens.css` for styling and imports `dist/tokens.js` to generate the
palette swatches at runtime — so it exercises both halves of the output the way
a real consumer would.

It also demonstrates the live-reference behaviour: dragging the
`--brand-space` slider re-renders every dependent token, including
`--brand-radius`, without a rebuild — and includes an interactive gradient
generator that disables any option which would break the adjacency rule.

## Colour notation

Brand colours are authored in `oklch()` — `L% C H`, the polar form of OKLAB —
with the original sRGB hex kept in a trailing comment. Every value round-trips
to its hex exactly, so this was a change of notation, not of appearance.

OKLCH is perceptually uniform: a given change in `L` shifts any hue by the same
apparent amount, which is what makes derived ramps and mixes behave
predictably. Because chroma and hue are separate numbers, deriving a muted
variant or rotating a hue is a one-value edit.

One caveat: `tokens.w3c.json` still emits `colorSpace: "srgb"` with components
and a hex, because design-book's W3C renderer converts on the way out. The
values are correct, just not expressed in OKLCH.

## Consuming

**Any framework, via CSS** — one import, then use the custom properties
anywhere:

```js
import 'pmndrs-design-tokens/css'
```

```css
.button {
	background: var(--brand-purple);
	border-radius: var(--brand-radius);
	font-family: var(--fonts-sans);
}
```

**Webfonts (opt-in)** — the `fonts.*` tokens name families but don't load them.
If you aren't self-hosting, pull them from Google Fonts:

```js
import 'pmndrs-design-tokens/fonts'   // before the token stylesheet
```

This is deliberately separate from `/css`: importing the token layer should
never force a third-party request on a consumer who already has these families.
The family list lives in `webfonts` at the top of `scripts/build.ts` and must
be kept in step with the `fonts` scope in the design book.

**JavaScript, when you need a concrete value** — canvas, WebGL, chart libraries,
anything that can't read a CSS variable:

```js
import { tokens, cssVar } from 'pmndrs-design-tokens'

tokens['brand.purple']        // '#D855F9'
tokens['brand.radius']        // '16px'
cssVar('brand.radius')        // 'var(--brand-radius)'
cssVar('fonts.sans', 'serif') // 'var(--fonts-sans, serif)'
```

`tokens` holds **resolved** values; `cssVar()` returns a **live** reference that
still responds to theme overrides. Token paths are a TypeScript union, so a
typo is a compile error rather than an `undefined` at runtime.

**Gradients** — three stops at 16%, 50% and 84%:

```js
import { gradient, gradientColors, randomGradient } from 'pmndrs-design-tokens'

gradient(['brand.purple', 'brand.teal', 'brand.orange'])
// 'linear-gradient(90deg, var(--brand-purple) 16%, var(--brand-teal) 50%, var(--brand-orange) 84%)'

gradient(stops, { angle: '135deg' })   // any CSS angle
gradient(stops, { resolve: true })     // literal oklch() values, for canvas/WebGL
randomGradient()                       // a random legal combination
```

Stops draw from `gradientColors` — every brand colour except `brand.dark` and
`brand.light`. **No two adjacent stops may be the same**, though the first and
last may match, which gives a symmetrical gradient. Picking a neutral or the
wrong number of stops is a *type* error; the adjacency rule is checked at
runtime by `assertGradientStops`, since expressing it in the type system would
need an unusable combinatorial union.

**Other tooling** — Style Dictionary, Figma plugins, native apps:

```js
import w3c from 'pmndrs-design-tokens/w3c'   // W3C Design Tokens
import flat from 'pmndrs-design-tokens/json' // flat path -> value map
```

## Adding tokens

Edit `src/pmndrs-design-book.ts` and re-run `pnpm build`. Every artifact,
including the `TokenPath` union, is regenerated from that one file.

```ts
const ui = book.addScope('ui')
ui.set('surface', ref('brand.light'))
ui.set('text', bestContrastWith(ref('ui.surface'), brand))
```

References survive into CSS (`--brand-radius: var(--brand-space)`) while JSON
and the JS module see them flattened (`brand.radius === '16px'`), so overriding
`--brand-space` in a theme still cascades at runtime.

## Note on licensing

`design-book` is AGPL-3.0-only. It is a `devDependency` here and no part of it
ships in `dist/`, so the generated tokens are unencumbered. If you ever move it
to a runtime `dependency`, revisit the `license` field in `package.json`.
