/**
 * Making motion periodic.
 *
 * A still does not care how fast anything moves, but a GIF does: if a body
 * completes 3.4 turns over the clip, the last frame does not match the first
 * and the loop visibly jumps. The fix is not to slow anything down — it is to
 * round every rate to a whole number of cycles per loop, which is inaudible in
 * a single frame and invisible over a loop.
 *
 * Scenes stay pure functions of `time`; this only constrains which rates they
 * are allowed to pick.
 */

const turn = Math.PI * 2

/**
 * Rounds an angular rate (radians per second) to the nearest whole number of
 * turns per loop, preserving its sign and never rounding down to a standstill.
 *
 * `loopSpeed(0.13, 6)` -> `0.1047…` — one turn every six seconds.
 */
export function loopSpeed(speed: number, loopSeconds: number): number {
	const cycles = Math.max(1, Math.round((Math.abs(speed) * loopSeconds) / turn))
	const sign = speed < 0 ? -1 : 1

	return (sign * cycles * turn) / loopSeconds
}
