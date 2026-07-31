/**
 * Holds the capture open and keeps redrawing until the scene has settled.
 *
 * `<ThreeCanvas>` draws the frame once, from a passive effect, and then
 * releases the handle that was holding the render. Anything that arrives after
 * that — a decoded video frame, an image texture, an environment map that
 * bakes on the first frame — updates React state but never reaches the
 * framebuffer, because with `frameloop="never"` nothing asks three.js to draw
 * again. The card is captured as it looked before its content loaded, which
 * for a video source is an empty plate.
 *
 * Reacting to React commits does not work, and the reason is worth recording:
 * the video texture is state *inside* the plate component, so when it resolves
 * only that component re-renders. A sibling watching for commits never hears
 * about it.
 *
 * So this does not try to observe anything. It takes one `delayRender` handle
 * at mount — before any other handle can close and let the screenshot through
 * — and redraws on every animation frame for a fixed window, then lets go.
 * Content that lands inside the window is drawn; the window is chosen per
 * source, because only media has to wait on a decode.
 *
 * The window alone is not enough, and it took an empty frame to learn that. A
 * timer says how long to wait, not whether anything happened: on a cold start
 * the WebGL context can still be coming up on SwiftShader when the last tick
 * fires, every `advance` in the window draws nothing, and the capture takes a
 * blank canvas with the HTML overlay sitting on top of it. Rare, and a race —
 * so it lands on whichever frame is captured first, which for an animation is
 * frame zero, which is the frame a platform shows as the card.
 *
 * So the window is the *minimum* now, and the release also waits for the
 * renderer to say it has drawn geometry. `gl.info.render` counts the triangles
 * of the draw that just happened, so a tick that painted something is
 * distinguishable from a tick that painted nothing — the one fact a timer
 * cannot report. `maxMs` bounds the whole thing well under `delayRender`'s own
 * timeout, so a card with genuinely nothing to draw still finishes rather than
 * hanging for 28 seconds to say so.
 *
 * The cost is real and bounded: a media card spends `windowMs` of wall clock
 * that a scene card does not.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { continueRender, delayRender, useRemotionEnvironment } from 'remotion'

/** Draws that must have put geometry on screen before a capture is allowed. */
const requiredDraws = 2

/** Hard stop, whatever the canvas is doing. `delayRender` gives up at 28s. */
const maxMs = 8000

export function Settle({ windowMs }: { windowMs: number }) {
	const advance = useThree((state) => state.advance)
	const gl = useThree((state) => state.gl)
	const { isRendering } = useRemotionEnvironment()

	useEffect(() => {
		// The Studio runs the loop continuously and repaints on its own.
		if (!isRendering) return

		const handle = delayRender('Settling the canvas before capture')

		let frame = 0
		let released = false
		let drawn = 0
		const startedAt = performance.now()

		const release = () => {
			if (released) return
			released = true
			continueRender(handle)
		}

		const tick = () => {
			advance(performance.now())

			// Counts the draw that just happened, so this is "did that tick
			// paint", not "has anything ever painted".
			if (gl.info.render.triangles > 0) drawn += 1

			const elapsed = performance.now() - startedAt

			if ((elapsed >= windowMs && drawn >= requiredDraws) || elapsed >= maxMs) release()
			else frame = requestAnimationFrame(tick)
		}

		frame = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(frame)
			release()
		}
	}, [advance, gl, isRendering, windowMs])

	return null
}
