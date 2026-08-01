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
| `demo/og/` | Rendered OG cards, checked in — the gallery at `/demo/og.html` |
| `src/components/contract.ts` | Component props and their per-variant token bindings |
| `scripts/figma/` | The Figma round trip's pure logic — reconcile, audit, page, og, template |
| `figma/sync.json` | Committed sync state: variable, component, page, OG-card and template ids |
| `og/layout/card.json` | The card layout, authored at 1200×630 — round-trips with the Figma template |
| `dist/` | Generated artifacts (git-ignored, published to npm) |
| `public/` | Assembled static site (git-ignored, deployed) |
| `og/` | [OG image generator](og/README.md) — a separate workspace package |

The token package at the root stays dependency-light: a contributor who only
touches `src/` should not have to install React, three.js and a headless
browser. The OG generator therefore lives in its own workspace package and
consumes the tokens as `pmndrs-design-tokens: workspace:*` — through exactly
the entry points an outside consumer would use.

## Usage

```bash
pnpm install
pnpm build      # render dist/
pnpm demo       # build, then serve the demo at http://localhost:5173
pnpm preview    # assemble public/ and serve it exactly as the host will
pnpm watch      # re-render on change
pnpm typecheck
```

Open Graph images are rendered from the same tokens — a live three.js scene, a
video sampled at a timestamp, or an image. See [`og/README.md`](og/README.md).

```bash
pnpm og -- specs/site.json --manifest           # render a set of cards
pnpm og -- specs/react-three-fiber.json --gif   # one seamless loop, animated
pnpm og:studio                                  # live preview
pnpm og:demo                                    # re-render the gallery page
```

`/demo/og.html` is the gallery: every card the generator can produce — each
scene, both themes, all three sizes, the effect chain, both media sources and a
loop — next to the spec field it demonstrates, plus the `<meta>` tags that put
one on a page. Its assets are the only binaries in the repo, checked in because
the deploy has no browser to render them with. `pnpm og:demo` regenerates them.

The same fourteen cards are a Figma page, and the spec fields under each one
travel back into `og/specs/`. See [The OG cards in Figma](#the-og-cards-in-figma).

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

Below that is a **component waterfall**: the MDX component vocabulary
documented at [docs.pmnd.rs](https://docs.pmnd.rs/llms-full.txt) — `Intro`,
`Keypoints`, the five `Gha` alert keywords, `Code` with line numbers and diffs,
`Sandpack`, `Mermaid`, `Entries`, `Contributors` and the rest — built as plain
HTML on nothing but these tokens. It's the page's real proof: surfaces,
hairlines and muted text all come from the neutral ramp, and each callout takes
its tint from one accent ramp's `950` and its rule from that ramp's `300`. No
component hard-codes a colour, and the page makes no network requests, so
avatars and thumbnails are drawn from ramp steps rather than fetched.

Two more pages sit beside it, sharing the same stylesheet and theme toggle:

| URL | Page |
| --- | --- |
| `/` | The brand book — palette, ramps, gradients, component waterfall |
| `/demo/og.html` | Every OG card the generator produces, and how to use one |
| `/demo/sync.html` | The Figma round trip, as a quickstart |

`og.html` is the only page that loads images, and it is worth knowing why: they
are checked into `demo/og/` rather than rendered during deployment. Rendering
needs a headless browser and Remotion, neither of which belongs in a static
build — and cards are deterministic, so a committed render is the same file the
build would have produced.

## The page in Figma

`demo/index.html` is part of the Figma round trip, not just its output. `pnpm
figma:page` reads the page into a spec and generates the Plugin API script that
assembles it — and where the page renders a component the contract declares, the
Figma page places an **instance of that component set**:

```bash
pnpm figma:page              # dist/figma-page.json + the script that builds it
pnpm figma:page --snapshot   # also the read-back script the audit consumes
pnpm figma:page --record <result.json>
pnpm figma:audit <snapshot.json>   # components *and* page composition
pnpm figma:audit <snapshot.json> --only=Nav,Search,Toc
```

Components land a few at a time, so `--only` scopes the component half to the
ones named — a snapshot of three would otherwise report the other five as
missing from Figma, which is true of the snapshot and false of the file.

Where the frame lives is Figma's decision, not the script's. The push resolves it
by the node id recorded in `figma/sync.json` first, so dragging it to another
page is a move the next push follows rather than a second copy it makes — the
same rule the token push uses for a renamed variable. Only if that id is gone
does it fall back to the recorded page, then to the page the components are on,
then to the frame's own name. It never creates a page. Which theme mode the
frame is *viewed* in is carried over for the same reason — the tokens define
both modes, and the code has no opinion about which one you are looking at.

A block becomes an instance in one of two ways. A `<pmndrs-gha>` custom element
*is* the component — the demo already renders it from the contract. A
`data-component="Code"` marker names a contract component the page renders as
plain markup instead, because there is no custom element for it. Either way the
props are **read back out of the markup** — a code block's language from its
caption, its numbering from `counter-reset`, its highlight range from which lines
carry `is-hl` — so a Figma instance cannot claim a variant the page isn't
rendering. A variant the contract doesn't declare stops the push.

Everything the contract doesn't declare is recorded as what it is. The swatch and
ramp grids are rebuilt from the `brand` and `ramp` variables; anything else
becomes a labelled **stand-in**. That is deliberate: a hand-drawn Figma design
with no owner in code has nothing to audit it against. A stand-in becomes an
instance the moment its component is declared and built, which is what emptied
the waterfall: all 23 of its components are now instances, and the four
remaining stand-ins are the page's own furniture — the space slider and the
gradient generator's controls — which are demo widgets, not doc components.

The frame is **rebuilt in place**, never replaced. The obvious implementation
deletes it and appends a new one, and it is wrong: someone may have turned the
frame into a component — ours is one — and deleting it would detach every
instance of it.

The audit compares composition rather than typography. It reports a block that
moved or vanished, an instance of the wrong component, a variant swapped in
Figma, and a **detached instance** — the one that looks right until the component
changes and one copy quietly doesn't.

## The OG cards in Figma

The cards round-trip too, but not the way a component does — and the difference
is the whole design. A Button's Figma counterpart is a drawing of the same thing
the code draws, so the round trip's job is to stop the two drawings disagreeing.
A card's artwork is a three.js render: bloom, fringing, a wordmark set in 3D.
Figma cannot draw that, and a hand-made approximation would be exactly the
second, unowned definition the rest of this directory exists to prevent.

So the card is split between output and input. The **render** only ever travels
out — it arrives as the image it is, and nothing done to it in Figma could be
read back. The **spec** only ever travels in: twelve plain fields under the
artwork, every one of them something a designer has an opinion about. Change the
title or the accent on the card in Figma, pull it, and the edit lands in
`og/specs/*.json`, where the next render reads it.

```bash
pnpm figma:og                    # dist/figma-og.json + one script per batch
pnpm figma:og --snapshot         # also the read-back script
pnpm figma:og --record <result.json,…>   # fold the ids in, print the upload plan
pnpm figma:og --uploaded         # stamp the artwork as landed
pnpm figma:og --pull <snapshot.json> [--apply]
```

Which cards exist is **read, not restated**: `og/package.json`'s `demo` script is
the render plan — it names every spec file, whether it is a manifest, and where
the output lands — so the templates are by construction exactly the cards `pnpm
og:demo` produces. Add a card to the demo and it appears in Figma on the next
push without anything being told about it. A spec with no render on disk is
reported rather than pushed as an empty box.

Two fields are folded so that one question has one answer. `size` is `og`,
`square`, `wide` **or** a box like `800x420`, because `width`/`height` override
the named size in a spec and a card cannot have both; `source` is
`scene:ramp-orbit` or `image:…`, the tagged union flattened. Both are validated
on the way back — an accent is checked against the ramps the design book
actually defines, so a typo in Figma stops the pull instead of producing a card
nobody ordered.

A card is **updated in place, never rebuilt**. The demo page can afford to
delete its children and draw them again because everything in it is derived from
the spec; a card cannot. Its `art` node carries an image uploaded separately and
absent from the push payload, so a node dropped and recreated would come back
blank — and the cards are components, so deleting one detaches every instance
and voids its Code Connect mapping. Children are matched by name and reused, and
only their contents are rewritten.

The artwork is the one thing the push cannot deliver itself: the plugin sandbox
has no network back to this repo, and inlining megabytes of JPEG into the
program is not an option. So images travel through `upload_assets`, addressed to
the `art` node id the push hands back, and `figma/sync.json` records a hash of
each file — a re-push that changed no pixels uploads nothing.

Recording a push **advances the sync base**, and it has to. A push makes both
sides agree, so what it wrote is the last agreed state; leaving the base empty
would not merely lose information, because `reconcile` reads a missing base as
"cannot tell who moved" and would report the first real Figma edit as a conflict
needing a human rather than as the pull it plainly is.

One Figma quirk is worth recording, because it cost an afternoon. The push used
to pin the frame to the Dark theme mode, the way the demo page pins Light. Dark
is the theme collection's *default* mode, and pinning a frame to its collection's
default is both redundant and — in this file — enough to stop the renderer
resolving that frame's own bound paints: the frame came back flat `#808080`, the
fallback colour inside every bound paint, while its children rendered correctly.
The push now says nothing when there is nothing to say.

A related one, and the reason both pushes end with a `repaint()`: Figma caches a
frame's resolved variable colours, and rewriting the paints underneath does not
reliably invalidate that cache. A second push would leave the frame flat grey
while the API reported every binding intact and resolved it to the right colour.
Toggling an explicit mode on and off forces the recompute, costs nothing, and
restores whatever pin it found.

## The card layout in Figma

The card round trip moves what a card *says*. This one moves where it says it —
drag the headline block in the Figma template, pull, and every card the
generator will ever render moves with it.

That works because of one property of `og/layout/card.json`: it is authored at
the reference box, 1200×630, and the renderer scales from there. So the template
frame is exactly 1200×630 and the numbers in the JSON *are* the coordinates in
Figma's inspector — no unit conversion to get wrong in either direction, and a
template someone has resized is a loud error rather than a silently rescaled
layout.

```bash
pnpm og:plate                    # the backdrop: a card with no type on it
pnpm figma:template              # dist/figma-template.js + a summary
pnpm figma:template --snapshot   # also the read-back program
pnpm figma:template --record <result.json>
pnpm figma:template --pull <snapshot.json> [--apply]
```

The card is **three anchored blocks** — `brand`, `meta`, `message` — and an
anchor is the load-bearing idea. A block records which edge it hangs from and
how far in, so its text flows *away* from that anchor: the message block hangs
off the bottom, so a three-line headline grows upward and the card still
composes. Pinning each element at an absolute `y` would look identical for the
title it was drawn with and fall apart for the next one, and a generator only
ever renders titles it has not seen.

What comes back from geometry and what comes back from a typed field is a
deliberate split, not a limitation:

| | |
| --- | --- |
| geometry | where a block sits, how wide it is, what size and tracking the type is — everything a designer expresses by dragging |
| fields | which edge a block hangs from, how its children stack, and the rule that shrinks a long headline |

A block drawn 68px from the left of a 1200px frame and 68px from the right of it
is the same rectangle; only the anchor says which of those the designer meant.
So anchors live in a panel beside the template, in the same field rows the cards
use, and everything else is measured off the canvas. Both halves flatten into
one map of dotted keys, so the same three-way `reconcile` that settles a colour
settles a layout — and `template.test.ts` round trips every anchor through the
push's placement and the pull's measurement, because a push that drew a block
somewhere the pull would read differently would walk it across the card a little
further on every sync.

The backdrop is a **plate**: `"plate": true` renders the artwork with the type
layer switched off. A backdrop carrying the finished card's own headline would
put a second, baked-in title under the editable one, and moving the block in
Figma would leave the old title sitting there.

Two things to know when editing. A layout change moves *every* card, so
`pnpm og:demo` and a re-push of the artwork follow a pull. And Figma grows a
hugging block downward from its top edge while the renderer grows a
bottom-anchored one upward — so after resizing type, put the block's *bottom*
edge where you want it, because that is the edge the pull measures.

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

## Colour ramps

Every brand colour — the seven accents **and** the two neutrals — expands into
an eleven-step tonal scale, `50` through `950`, under the `ramp` scope:

```css
.callout {
	background: var(--ramp-blue-950);
	border-inline-start: 3px solid var(--ramp-blue-300);
	color: var(--ramp-dark-200);
}
```

The steps come from `rampStops()`, which drives design-book's dittotones
engine. They're placed by *perceived* lightness rather than mixed toward white
and black, so `purple-300` and `teal-300` read as the same brightness — that's
what makes a ramp usable as a scale instead of nine unrelated tints.

The neutrals are ramped for the same reason the accents are, and arguably a
better one: `brand.dark` and `brand.light` are the page ground, and a ground
colour needs its own greys more than any accent does — surfaces, hairlines,
muted text. Both are warm (hue ≈ 87), so their ramps stay warm instead of
drifting to a blue-grey that would sit oddly against the rest of the palette.

**A seed keeps its own value**, at whichever step it perceptually belongs to —
which is *not* always the middle:

```js
import { rampSeeds, rampPath, tokens } from 'pmndrs-design-tokens'

rampSeeds.purple                  // '500'
rampSeeds.teal                    // '300' — teal is much lighter than purple
rampSeeds.dark                    // '700'

tokens[rampPath('teal', '300')]   // '#00f7a3' === tokens['brand.teal']
```

So `rampSeeds` is how you step *relative to the brand colour* — "two steps
darker than the brand teal" — instead of assuming 500 and landing somewhere
else. The build fails if a seed ever stops round-tripping through its own ramp,
rather than shipping a silently wrong answer.

```js
import { rampNames, rampShades, rampPath, cssVar } from 'pmndrs-design-tokens'

rampNames    // ['dark', 'light', 'purple', 'red', 'orange', ...]
rampShades   // ['50', '100', '200', ..., '950']

cssVar(rampPath('orange', '400'))  // 'var(--ramp-orange-400)'
rampPath('orange', '42')           // RangeError — not a step
```

Ramp names are read off the `brand` scope rather than hand-listed, so adding a
brand colour produces its ramp on the next build.

One thing to know: ramp steps are **computed at build time** and emit as
literal values. Overriding `--brand-purple` in a theme re-renders anything that
references it live (see below), but it will *not* recompute
`--ramp-purple-*` — those are baked. Theme the ramp steps directly if you need
them to move.

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
The families come from `families` in the design book, so the Google Fonts
request cannot fall out of step with the tokens; only the weight axis each face
is requested across lives in `scripts/build.ts`.

**Two shapes per typeface** — `--fonts-*` is the full CSS stack and is what a
stylesheet should use:

```css
h1 { font-family: var(--fonts-serif); } /* "Faculty Glyphic", serif */
```

`--family-*` is the bare family name, with no fallback chain:

```css
--family-serif: Faculty Glyphic;
```

That second form exists for Figma. A Figma text style takes a single
`{ family, style }` and a `FONT_FAMILY` variable bound to it has to resolve to
a font the file has loaded, so a stack cannot be bound — only `family.*` can.
Both are generated from one entry in `families`, so the pair cannot drift.
Reach for `--family-*` in code only when something needs the name by itself
(an `@font-face` reference, a font-loading API); otherwise use `--fonts-*` and
get the fallbacks.

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
