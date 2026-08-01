/**
 * Screen pixels to world units, for the type that lives inside the scene.
 *
 * The 3D wordmark is the one piece of the card whose native units are not
 * pixels: it is real geometry at a depth, so it is placed in world space and
 * scaled by how far from the camera it sits. That is the right space for the
 * renderer and the wrong one for a designer, who is looking at a 1200×630
 * rectangle and wants the word an inch further left.
 *
 * So the layout authors it in pixels like everything else, and this converts —
 * using the actual camera the card is rendered with, not a restatement of it.
 * That matters more than it sounds: the camera sits slightly above the origin
 * and looks back down at it, so the plane the wordmark occupies is not quite
 * perpendicular to the view axis, and world Y=0 is *not* the middle of the
 * frame. Anything hand-derived would be a few pixels out, in a direction that
 * changes with the card's aspect ratio.
 *
 * The conversion is exact at the anchor point. Across the wordmark's own extent
 * there is a little foreshortening, because a tilted plane is nearer at one end
 * — which is a fact about the render, not a loss in the round trip: the pixels
 * are what round-trips, and the renderer is the only thing that ever sees a
 * world unit.
 */

import { Vector3 } from 'three'
import type { Camera } from 'three'

/**
 * The world point that a screen pixel lands on, at a given depth.
 *
 * Casts the ray the pixel names and walks it to the plane `z = depth`, rather
 * than unprojecting to an arbitrary distance — the wordmark's depth is a
 * decision the layout makes, and it is what puts the type behind the scene's
 * geometry rather than in front of it.
 */
export function worldFromScreen(
	camera: Camera,
	width: number,
	height: number,
	x: number,
	y: number,
	depth: number,
): Vector3 {
	const point = new Vector3((x / width) * 2 - 1, -((y / height) * 2 - 1), 0.5).unproject(camera)
	const direction = point.sub(camera.position).normalize()

	/* Parallel to the plane: nothing sensible to return, so stay put. */
	if (Math.abs(direction.z) < 1e-6) return new Vector3(0, 0, depth)

	const distance = (depth - camera.position.z) / direction.z
	return camera.position.clone().add(direction.multiplyScalar(distance))
}

/**
 * How many world units one screen pixel covers at that depth.
 *
 * Measured rather than derived from the field of view, so it stays correct
 * whatever the camera is doing — a hundred pixels apart is a long enough baseline
 * that floating point noise does not matter and short enough that the plane's
 * tilt does not either.
 */
export function unitsPerPixel(camera: Camera, width: number, height: number, depth: number): number {
	const span = 100
	const a = worldFromScreen(camera, width, height, width / 2, height / 2, depth)
	const b = worldFromScreen(camera, width, height, width / 2, height / 2 + span, depth)
	return a.distanceTo(b) / span
}
