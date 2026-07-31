/**
 * sRGB hex -> OKLCH, so a pulled colour can be re-authored in the notation the
 * design book uses.
 *
 * Written out rather than pulled from `culori`, which is a *transitive*
 * dependency of design-book: depending on it directly would make the build
 * quietly hostage to a package we never declared. The conversion is exact and
 * well-specified, and this repo's whole colour argument rests on OKLCH — owning
 * twenty lines of it is cheaper than owning the dependency.
 *
 * Verified against the book's own seeds: `#d855f9` must return the
 * `oklch(68.55% 0.2497 318.9)` that `brand.purple` is authored as.
 */

/** sRGB gamma -> linear light. */
function linearize(channel: number) {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

export interface Oklch {
	/** Lightness, 0–100 (a percentage). */
	l: number
	/** Chroma. */
	c: number
	/** Hue in degrees, 0–360. */
	h: number
}

export function hexToOklch(hex: string): Oklch {
	const clean = hex.replace('#', '')
	const [r, g, b] = [0, 2, 4].map((i) => linearize(parseInt(clean.slice(i, i + 2), 16) / 255)) as [
		number,
		number,
		number,
	]

	/* Linear sRGB -> LMS, then the cube root that makes OKLab perceptual. */
	const lms = [
		0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
		0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
		0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
	].map(Math.cbrt) as [number, number, number]

	const [l_, m_, s_] = lms
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
	const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
	const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

	const hue = (Math.atan2(B, A) * 180) / Math.PI

	return {
		l: L * 100,
		c: Math.hypot(A, B),
		/* atan2 returns -180..180; the CSS hue axis is 0..360. */
		h: (hue + 360) % 360,
	}
}

/**
 * Formats at the precision the design book is authored in — two decimals on
 * lightness and hue, four on chroma. Matching the existing style matters: a
 * pulled value that arrives as `oklch(68.5471% 0.24968 318.902)` is correct and
 * still reads as foreign in a file where every neighbour is `68.55% 0.2497`.
 */
export function formatOklch({ l, c, h }: Oklch) {
	const trim = (n: number, places: number) => String(Number(n.toFixed(places)))
	return `oklch(${trim(l, 2)}% ${trim(c, 4)} ${trim(h, 2)})`
}

/** `#d855f9` -> `oklch(68.55% 0.2497 318.9)` */
export const hexToOklchString = (hex: string) => formatOklch(hexToOklch(hex))
