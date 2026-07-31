/**
 * Seeded pseudo-randomness.
 *
 * A still is rendered by seeking straight to one frame, so nothing in a scene
 * may depend on how many frames came before it — including `Math.random()`,
 * which would hand back a different layout on every render and make the same
 * spec produce a different card each time. Every scene draws its jitter from
 * one of these instead, seeded by `spec.seed`, so a spec and its image stay
 * the same pair forever.
 */

/**
 * mulberry32 — a 32-bit generator that is small, fast and well-distributed
 * enough for placing geometry. Returns values in [0, 1).
 */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0

	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** A generator's next value, mapped onto `[min, max)`. */
export function between(random: () => number, min: number, max: number): number {
	return min + random() * (max - min)
}

/**
 * `count` draws from `random`, pre-rolled into an array.
 *
 * Scenes build their instance tables with this during render rather than
 * pulling from the generator inside a `useFrame`: the array is a function of
 * the seed alone, so it survives re-renders and frame seeks unchanged.
 */
export function rolls(random: () => number, count: number): number[] {
	return Array.from({ length: count }, () => random())
}
