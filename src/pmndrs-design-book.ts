import {
  DesignBook,
  color,
  px,
  rampStops,
  ref,
  spacingScale,
  string,
} from 'design-book'

export const book = new DesignBook('pmndrs')

/**
 * The typefaces, named once.
 *
 * Every other mention of a typeface in this repo derives from this map: the
 * `family` scope below, the CSS stacks in `fonts`, the Google Fonts request in
 * `scripts/build.ts`, and the fonts the page generator loads in
 * `scripts/figma-page.ts`. Before this existed, "Faculty Glyphic" was spelled
 * in four files and nothing kept them in step.
 *
 * These are the names as the *font vendor* spells them, because that is what
 * both `figma.loadFontAsync` and the Google Fonts `css2` endpoint match on. A
 * self-hosted alias that differs from the vendor name does not belong here —
 * it belongs in the fallback list of the matching stack.
 */
export const families = {
  mono: 'Geist Mono',
  sans: 'Geist',
  serif: 'Faculty Glyphic',
  legible: 'Atkinson Hyperlegible Next',
} as const

/**
 * Typography, in the two shapes the two consumers can actually use.
 *
 * `family.*` is one family name and nothing else. This is the shape Figma
 * needs: a text style's `fontName` is a single `{ family, style }`, and a
 * FONT_FAMILY variable bound to it has to resolve to a font the file has
 * loaded. Hand Figma a stack and the binding dangles.
 *
 * `fonts.*` is the full CSS stack, which is the shape a browser needs and the
 * one `demo.css` has always used. It stays a literal rather than a reference
 * because a fallback chain cannot be assembled from `var()` — substitution
 * happens before the value is parsed, so the stack has to be composed here, at
 * author time, by `stack()` below.
 *
 * Declared before the colours because `brand.headline` aliases `family.serif`,
 * and `assertAliasOrder` in the Figma emitter requires a target to appear
 * before whatever points at it.
 */
const family = book.addScope('family')
for (const [key, name] of Object.entries(families)) family.set(key, string(name))

/** `stack('Geist', 'system-ui', 'sans-serif')` -> `"Geist", system-ui, sans-serif`. */
const stack = (head: string, ...fallbacks: string[]) =>
  string([`"${head}"`, ...fallbacks].join(', '))

const fonts = book.addScope('fonts')
fonts.set('mono', stack(families.mono, 'ui-monospace', 'monospace'))
fonts.set('sans', stack(families.sans, 'system-ui', 'sans-serif'))
fonts.set('serif', stack(families.serif, 'serif'))
/*
 * Pulled from Figma, where the Gha alerts were switched to it. Atkinson
 * Hyperlegible is a legibility-first typeface, and an alert is exactly where
 * that matters — it carries the information a reader must not miss. Scoped to
 * that use rather than replacing `fonts.sans`, because the Button labels in the
 * same file were deliberately left on Geist.
 *
 * The extra fallback is the older release of the same face, which is what a
 * machine with the typeface already installed is likely to have.
 */
fonts.set(
  'legible',
  stack(families.legible, '"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'),
)

// Brand colors.
// Authored in OKLCH — `L% C H`, the polar form of OKLAB. Lightness and chroma
// are perceptually uniform, and hue is a single number, so deriving a tint or
// rotating a hue is a one-value edit rather than a recomputation of two axes.
// The trailing hex is the sRGB original; every value round-trips to it exactly.
const brand = book.addScope('brand')
brand.set('dark', color('oklch(32.53% 0.0091 88.75)')) // #36342F
brand.set('light', color('oklch(92.28% 0.0157 86.43)')) // #EAE5DA
brand.set('purple', color('oklch(68.55% 0.2497 318.9)')) // #D855F9
brand.set('red', color('oklch(67.93% 0.2192 7.25)')) // #FF4980
brand.set('orange', color('oklch(84.46% 0.1525 80.6)')) // #FFC043
brand.set('yellow', color('oklch(95.26% 0.215 115.42)')) // #EBFF0F
brand.set('green', color('oklch(90.91% 0.1997 122.5)')) // #CAF543
brand.set('teal', color('oklch(86.11% 0.1957 159.71)')) // #00F7A3
brand.set('blue', color('oklch(82.26% 0.1358 210.55)')) // #2BDCF6
/*
 * The headline face, as an alias rather than a second copy of the name.
 *
 * It predates the `family` scope and is the same value `family.serif` now
 * holds, but it is not deleted: the Figma push only ever upserts, so dropping
 * a token here would strand `brand/headline` in the file — still bound to
 * whatever uses it, no longer reachable from code. Pointing it at the new
 * token keeps the existing variable and its bindings alive and gives Figma a
 * visible link back to the one place the typeface is named.
 */
brand.set('headline', ref('family.serif'))
brand.set('space', px(16))
brand.set('radius', ref('brand.space'))

// Spacing beyond the base rhythm.
//
// Pulled from Figma: the Gha component set was given a vertical auto-layout
// with a 24px gap, which is the space between stacked alerts. 24 is exactly
// 1.5x `brand.space`, so it goes in as a ratio rather than a literal — the
// same reasoning as the radius scale below, and the tell is the same: an exact
// multiple is a system, a near-multiple is a one-off.
//
// It arrived in Figma as a raw number with no variable bound to it. Pushing
// this back and binding it closes that: the gap becomes a token on both sides
// instead of a magic 24 that only agrees by coincidence.
const space = book.addScope('space')
space.set('stack', spacingScale(ref('brand.space'), { multiplier: 1.5 })) // 24px

// Corner radii.
//
// Pulled from Figma, where they were already decided as `Base Radius` 16,
// `Input Radius` 4 and `Input Radius Small` 2 — the first values to travel
// design -> code through the sync.
//
// Kept as *relationships* rather than the three literals they arrived as. A
// radius is not an independent quantity: it belongs to the box it sits on, and
// these three are all fractions of the spacing rhythm. `spacingScale` renders
// to `calc(var(--brand-space) * 0.25)`, so the whole scale still moves when
// `--brand-space` is themed at runtime — the same live-reference behaviour
// `brand.radius` already had, extended to the scale.
//
// The ratios are exact, which is the tell that they were a system already:
// 16 -> 4 is a quarter, 16 -> 2 an eighth.
const radius = book.addScope('radius')
radius.set('base', ref('brand.radius')) // 16px — frames, cards, panels
radius.set('input', spacingScale(ref('brand.space'), { multiplier: 0.25 })) // 4px — 32px-high controls
radius.set('small', spacingScale(ref('brand.space'), { multiplier: 0.125 })) // 2px — tightly packed chrome

/**
 * Steps of every colour ramp, light to dark. The familiar 50–950 scale, so a
 * consumer coming from Tailwind or Material can reach for a step without
 * learning a second vocabulary.
 *
 * Declared before the ramps themselves because the semantic scopes below
 * reference ramp steps, and a reference needs its target to exist.
 */
export const rampShades = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const

/**
 * Names of the ramps — every colour token in the `brand` scope, accents and
 * neutrals alike. Read from the book rather than hand-listed, so adding a
 * brand colour produces its ramp on the next build and removing one takes the
 * ramp with it.
 */
// Annotated rather than inferred: design-book's `.d.ts` files use extensionless
// relative imports, which don't resolve under `moduleResolution: nodenext`, so
// `Scope` — and everything it returns — arrives here as `any`.
const brandKeys: string[] = brand.getAllKeys()

export const rampNames = brandKeys.filter(
  (name) => book.inspect(`brand.${name}`)?.tokenType === 'color',
)

// Colour ramps.
// `rampStops` expands each seed into an 11-step tonal scale through
// design-book's dittotones engine. The steps are placed by perceived
// lightness rather than mixed toward white and black, so `purple-300` and
// `teal-300` read as the same brightness — which is what makes a ramp usable
// as a scale instead of nine unrelated tints.
//
// The seed keeps its exact value at whichever step it perceptually belongs
// to: `brand.purple` is `ramp.purple-500`, `brand.dark` is `ramp.dark-700`,
// `brand.light` is `ramp.light-200`. Each ramp is built *around* its colour,
// not away from it, so the brand value is always reachable from the scale.
//
// The neutrals get the same treatment as the accents. `brand.dark` and
// `brand.light` are the page ground, and a ground colour needs its own greys
// more than any accent does — borders, muted text, raised surfaces. Both are
// warm (hue ~87), so their ramps stay warm rather than drifting to a
// blue-grey that would sit oddly against the rest of the palette.
const ramp = book.addScope('ramp')

for (const name of rampNames) {
  const stops = rampStops(ref(`brand.${name}`), {
    prefix: `${name}-`,
    shades: rampShades,
    description: `${name} ramp, derived from brand.${name}`,
  })

  for (const [step, value] of Object.entries(stops)) ramp.set(step, value)
}


// Semantic surfaces and text — the theme layer.
//
// These used to live in `demo/demo.css` as `:root` aliases, which meant the
// package shipped raw scales while the actual decisions — what counts as a
// page ground, what counts as muted text — were stranded in one stylesheet
// where no consumer could reach them. They belong here.
//
// Modes are modelled the way design-book models them: `light` holds the full
// set, `dark` extends it and overrides only what differs. Every slot resolves
// through the neutral ramps, which is what makes a second mode a re-pointing
// exercise rather than a new palette.
//
// Note the ladders run in opposite directions. On a dark ground, elevation
// goes *lighter* (page 900 -> raised 700); on a light ground it goes *whiter*
// (page 100 -> raised 50). That asymmetry is why light mode is not an
// inversion of dark — a mirrored scale would sink raised surfaces instead of
// lifting them.
const light = book.addScope('light')
light.set('page', ref('ramp.light-100'))
light.set('surface', ref('ramp.light-50'))
light.set('surface-raised', ref('ramp.light-50'))
light.set('surface-sunken', ref('ramp.light-200'))
light.set('line', ref('ramp.light-300'))
light.set('line-soft', ref('ramp.light-200'))
light.set('text', ref('ramp.dark-900'))
light.set('text-muted', ref('ramp.dark-600'))
light.set('text-faint', ref('ramp.dark-500'))
/* Body copy, and copy sitting on a tinted callout ground. Both were hardcoded
   to dark-ramp steps in demo.css, which is invisible until a light mode exists
   and then reads at 1.36:1. */
light.set('text-body', ref('ramp.dark-800'))
light.set('text-strong', ref('ramp.dark-900'))

const dark = book.addScope('dark', { extends: 'light' })
dark.set('page', ref('ramp.dark-900'))
dark.set('surface', ref('ramp.dark-800'))
dark.set('surface-raised', ref('ramp.dark-700'))
dark.set('surface-sunken', ref('ramp.dark-950'))
dark.set('line', ref('ramp.dark-600'))
dark.set('line-soft', ref('ramp.dark-700'))
dark.set('text', ref('brand.light'))
dark.set('text-muted', ref('ramp.dark-400'))
dark.set('text-faint', ref('ramp.dark-500'))
dark.set('text-body', ref('ramp.dark-300'))
dark.set('text-strong', ref('ramp.dark-200'))

/*
 * Accent pairs, per mode.
 *
 * A brand accent is tuned for a dark ground — `brand.yellow` on white is
 * unreadable — so a mode switch cannot just repaint the surface underneath it.
 * Each hue therefore resolves to a different *step* of its own ramp per mode,
 * which is the whole reason the ramps exist.
 *
 * Dark uses 300 on 950, worst case 8.26:1 across the seven hues. Light uses
 * 800 on 50: the obvious mirror, 700 on 50, fails AA on yellow at 4.23:1
 * because the ramps aren't symmetric — seeds sit at different steps per hue.
 * 800 clears every hue at 6.03:1 or better with one rule rather than a
 * per-hue exception table.
 */
for (const hue of ['purple', 'red', 'orange', 'yellow', 'green', 'teal', 'blue']) {
  light.set(`accent-${hue}`, ref(`ramp.${hue}-800`))
  light.set(`tint-${hue}`, ref(`ramp.${hue}-50`))
  dark.set(`accent-${hue}`, ref(`ramp.${hue}-300`))
  dark.set(`tint-${hue}`, ref(`ramp.${hue}-950`))
}

/*
 * The filled action — its own slots, not the accent pair above.
 *
 * A filled button inverts the usual relationship: the accent is the *ground*
 * and the ink sits on top of it, so it needs a fill dark enough to carry pale
 * text in light mode and bright enough to read as an action in dark. The
 * accent pair is built for the opposite case (accent *on* a tint), and reusing
 * it would have made the dark button a pale lavender instead of brand purple.
 *
 * Dark keeps `brand.purple` as the fill. Light drops to `purple-700`, which is
 * the lightest step whose pale ink clears AA (5.51:1) and which still reads as
 * a filled control against a near-white page (5.41:1).
 *
 * The dark ink is `ramp.dark-950`, not `purple-950`. The tinted ink measured
 * 4.47:1 — under AA by a hair, and a pre-existing miss rather than a new one.
 * Near-black takes it to 6.20:1 and costs nothing visually at this size.
 */
light.set('action', ref('ramp.purple-700'))
light.set('action-ink', ref('ramp.purple-50'))
light.set('action-hover', ref('ramp.purple-800'))
dark.set('action', ref('brand.purple'))
dark.set('action-ink', ref('ramp.dark-950'))
dark.set('action-hover', ref('ramp.purple-400'))
