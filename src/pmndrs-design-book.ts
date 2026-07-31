import {
  DesignBook,
  color,
  px,
  rampStops,
  ref,
  string,
} from 'design-book'

export const book = new DesignBook('pmndrs')

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
brand.set('headline', string('Faculty Glyphic'))
brand.set('space', px(16))
brand.set('radius', ref('brand.space'))

// Typography
const fonts = book.addScope('fonts')
fonts.set('mono', string('"Geist Mono", ui-monospace, monospace'))
fonts.set('sans', string('"Geist", system-ui, sans-serif'))
fonts.set('serif', string('"Faculty Glyphic", serif'))

/**
 * Steps of every colour ramp, light to dark. The familiar 50–950 scale, so a
 * consumer coming from Tailwind or Material can reach for a step without
 * learning a second vocabulary.
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

