/**
 * Image and video, turned into scene textures.
 *
 * Video takes two routes on purpose:
 *
 * - **Rendering.** Frames come from Remotion's compositor, not from an HTML
 *   `<video>` element. The Chromium that renders stills ships without
 *   proprietary codecs, so a `<video>` tag would decode nothing for H.264 —
 *   the format almost every screen recording is in. The compositor decodes out
 *   of process and hands back the exact frame for the current time, which also
 *   makes the sample reproducible rather than dependent on where playback
 *   happened to be.
 * - **Preview.** `useOffthreadVideoTexture` throws outside a render, so the
 *   Studio drives a real `<video>` element instead. Codecs are not a problem
 *   there, because the Studio runs in your own browser.
 *
 * The two are separate components rather than one with a branch, so neither
 * ends up calling hooks conditionally.
 */

import { useTexture } from '@react-three/drei'
import { useOffthreadVideoTexture, useVideoTexture } from '@remotion/three'
import type { RefObject } from 'react'
import type { Palette } from '../lib/palette'
import { Plate } from '../three/Plate'

type Fit = 'cover' | 'contain'

interface PlateSlot {
	fit: Fit
	palette: Palette
}

/**
 * A still image.
 *
 * `useTexture` suspends while the file loads, and `<ThreeCanvas>` holds the
 * render open for the duration — so a card can never be captured with the
 * image missing.
 */
export function ImagePlate({ src, fit, palette }: PlateSlot & { src: string }) {
	const texture = useTexture(src)

	return <Plate texture={texture} fit={fit} palette={palette} />
}

/** A video frame, pulled through the compositor. Render-time only. */
export function RenderedVideoPlate({ src, fit, palette }: PlateSlot & { src: string }) {
	const texture = useOffthreadVideoTexture({ src })

	// Null until the compositor hands back the frame. `<Settle>` is what makes
	// sure the canvas is drawn again once it does.
	if (!texture) return null

	return <Plate texture={texture} fit={fit} palette={palette} />
}

/** A video frame off a live `<video>` element. Studio preview only. */
export function PreviewVideoPlate({
	videoRef,
	fit,
	palette,
}: PlateSlot & { videoRef: RefObject<HTMLVideoElement | null> }) {
	const texture = useVideoTexture(videoRef)

	if (!texture) return null

	return <Plate texture={texture} fit={fit} palette={palette} />
}
