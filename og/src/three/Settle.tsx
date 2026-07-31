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
 * The cost is real and bounded: a media card spends `windowMs` of wall clock
 * that a scene card does not.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { continueRender, delayRender, useRemotionEnvironment } from 'remotion'

export function Settle({ windowMs }: { windowMs: number }) {
	const advance = useThree((state) => state.advance)
	const { isRendering } = useRemotionEnvironment()

	useEffect(() => {
		// The Studio runs the loop continuously and repaints on its own.
		if (!isRendering) return

		const handle = delayRender('Settling the canvas before capture')

		let frame = 0
		let released = false
		const startedAt = performance.now()

		const release = () => {
			if (released) return
			released = true
			continueRender(handle)
		}

		const tick = () => {
			advance(performance.now())

			if (performance.now() - startedAt < windowMs) frame = requestAnimationFrame(tick)
			else release()
		}

		frame = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(frame)
			release()
		}
	}, [advance, isRendering, windowMs])

	return null
}
