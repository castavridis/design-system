/**
 * Colour helpers for the DOM half of a card.
 *
 * The scrim needs the ground colour at partial alpha, and the ramp steps
 * arrive as six-digit hex. `color-mix()` would do this in CSS, but resolving
 * it here keeps the computed value inspectable in the Studio rather than
 * hiding it behind a function the devtools show unevaluated.
 */

/** `'#0c0a06'` at `alpha` -> `'rgba(12, 10, 6, 0.8)'`. */
export function alpha(hex: string, value: number): string {
	const clean = hex.replace('#', '')

	const expanded =
		clean.length === 3
			? clean
					.split('')
					.map((character) => character + character)
					.join('')
			: clean

	const red = Number.parseInt(expanded.slice(0, 2), 16)
	const green = Number.parseInt(expanded.slice(2, 4), 16)
	const blue = Number.parseInt(expanded.slice(4, 6), 16)

	return `rgba(${red}, ${green}, ${blue}, ${value})`
}
