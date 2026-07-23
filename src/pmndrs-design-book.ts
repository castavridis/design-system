import {
  DesignBook,
  color,
  px,
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

