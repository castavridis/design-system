/**
 * The bridge from design tokens to the card.
 *
 * Everything visible — the ground, the ink, the colour of every instanced mesh
 * in a scene — resolves from `pmndrs-design-tokens` here and nowhere else. No
 * component below this file names a colour, so re-seeding a ramp in
 * `src/pmndrs-design-book.ts` re-colours every card on the next build.
 *
 * Two details of the token API do real work:
 *
 * - `rampSeeds` maps a ramp to the step that holds the brand colour *exactly*.
 *   The engine places a seed by perceived lightness, so that is `500` for
 *   `purple` but `300` for the much lighter `teal`. Reading the seed through
 *   this map rather than hard-coding `500` is what keeps an accent looking
 *   like itself across hues.
 * - Ramp steps are plain hex, while the `brand.*` tokens are authored in
 *   OKLCH. `THREE.Color` cannot parse `oklch()`, so anything bound for WebGL
 *   is taken from a ramp step. CSS gets whichever is more useful.
 */

import {
	rampPath,
	rampSeeds,
	rampShades,
	tokens,
	type RampName,
	type RampShade,
} from 'pmndrs-design-tokens'

/** Which neutral ramp is the page ground. Not the same axis as a ramp name. */
export type ThemeName = 'dark' | 'light'

export interface Palette {
	theme: ThemeName
	/** The ramp the card is accented with. */
	accentName: RampName
	/** Page ground — the colour the card fades out to. */
	ground: string
	/** A slightly raised ground, for the scrim and chrome fills. */
	groundRaised: string
	/** Primary text. */
	ink: string
	/** Secondary text and hairlines. */
	inkMuted: string
	/** The accent at its exact brand value. */
	accent: string
	/** A lighter and a deeper step either side of the accent. */
	accentSoft: string
	accentDeep: string
	/** The full accent ramp, light to dark — 11 hex strings. */
	scale: string[]
	/** Type stacks, straight from the token file. */
	fonts: { serif: string; sans: string; mono: string }
}

/** `'purple'` -> `'#d855f9'`. Always a hex string, so WebGL-safe. */
export function rampHex(name: RampName, shade: RampShade): string {
	return tokens[rampPath(name, shade)]
}

/** The step of `name` that holds the brand colour exactly. */
export function seedHex(name: RampName): string {
	return rampHex(name, rampSeeds[name])
}

/**
 * Steps either side of a ramp's seed, clamped to the ends of the scale — used
 * for the lighter/deeper accents so they stay relative to wherever the seed
 * actually sits.
 */
function neighbour(name: RampName, offset: number): string {
	const seedIndex = rampShades.indexOf(rampSeeds[name])
	const index = Math.min(rampShades.length - 1, Math.max(0, seedIndex + offset))
	return rampHex(name, rampShades[index]!)
}

/**
 * Builds the palette a card renders from.
 *
 * The neutral ramps carry the ground and the ink. Both `brand.dark` and
 * `brand.light` are warm (hue ~87), so a dark card's greys stay warm against
 * the accent instead of drifting blue.
 */
export function buildPalette(accentName: RampName, theme: ThemeName): Palette {
	const isDark = theme === 'dark'

	// The neutral ramp that supplies ground and ink. On a dark card the ground
	// comes from the deep end of `dark` and the ink from the light end of
	// `light`; on a light card the two swap.
	const ground = isDark ? rampHex('dark', '950') : rampHex('light', '100')
	const groundRaised = isDark ? rampHex('dark', '900') : rampHex('light', '200')
	const ink = isDark ? rampHex('light', '100') : rampHex('dark', '900')
	const inkMuted = isDark ? rampHex('dark', '400') : rampHex('light', '500')

	return {
		theme,
		accentName,
		ground,
		groundRaised,
		ink,
		inkMuted,
		accent: seedHex(accentName),
		accentSoft: neighbour(accentName, -2),
		accentDeep: neighbour(accentName, 2),
		scale: rampShades.map((shade) => rampHex(accentName, shade)),
		fonts: {
			serif: tokens['fonts.serif'],
			sans: tokens['fonts.sans'],
			mono: tokens['fonts.mono'],
		},
	}
}

/**
 * `count` colours sampled across the middle of the accent ramp.
 *
 * The very ends of a ramp are near-white and near-black, which read as
 * blown-out highlights and holes once bloom is applied, so scenes sample the
 * band between them rather than the whole scale.
 */
export function accentBand(palette: Palette, count: number): string[] {
	const first = 2
	const last = 8

	if (count === 1) return [palette.scale[(first + last) >> 1]!]

	return Array.from({ length: count }, (_, i) => {
		const step = first + ((last - first) * i) / (count - 1)
		return palette.scale[Math.round(step)]!
	})
}
