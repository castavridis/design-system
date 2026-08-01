/**
 * The card.
 *
 * Four layers, back to front: the WebGL render, a scrim, grain, and the type.
 * The split between the canvas and the DOM is the one real design decision
 * here — the render supplies atmosphere, the DOM supplies the words — and it
 * is what lets the same component be both a Studio preview and a still.
 */

import { ThreeCanvas } from '@remotion/three'
import { useMemo, useRef } from 'react'
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig, Video } from 'remotion'
import { BrandFonts } from '../lib/fonts'
import { mediaUrl } from '../lib/media'
import { buildPalette } from '../lib/palette'
import { resolveSpec, type OgSpec } from '../lib/spec'
import { CardScene } from './CardScene'
import { Grain, Scrim } from './Overlay'
import { Typography } from './Typography'

export function OgCard({ spec: input }: { spec: OgSpec }) {
	const spec = useMemo(() => resolveSpec(input), [input])
	const palette = useMemo(() => buildPalette(spec.accent, spec.theme), [spec.accent, spec.theme])

	const frame = useCurrentFrame()
	const { fps, width, height } = useVideoConfig()
	const { isRendering } = useRemotionEnvironment()

	// The one moving value. Scenes are pure functions of it, and for a video
	// source it is also the timestamp sampled out of the file.
	const time = frame / fps

	const videoRef = useRef<HTMLVideoElement>(null)

	return (
		<AbsoluteFill style={{ backgroundColor: palette.ground }}>
			<BrandFonts />

			{/* Studio-only. During a render the frame comes from the compositor
			    instead, so this element is never mounted — which matters,
			    because the rendering browser could not decode it anyway. */}
			{spec.source.kind === 'video' && !isRendering ? (
				<Video
					ref={videoRef}
					src={mediaUrl(spec.source.src)}
					muted
					style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
				/>
			) : null}

			<ThreeCanvas
				width={width}
				height={height}
				camera={{ position: [0, 0.35, 6.4], fov: 38 }}
				// `preserveDrawingBuffer` is not an optimisation to argue about
				// here — it is the difference between a card and a black
				// rectangle. Without it the browser is free to discard the
				// WebGL buffer once it has composited, and the screenshot,
				// which happens on its own schedule after the draw, gets
				// whatever is left. Content that loads slowly (a decoded video
				// frame) leaves the widest gap between the two and fails most
				// reliably.
				gl={{ antialias: true, preserveDrawingBuffer: true }}
			>
				<CardScene spec={spec} palette={palette} time={time} videoRef={videoRef} />
			</ThreeCanvas>

			<Scrim palette={palette} />
			<Grain amount={spec.effects.noise} />
			{/* A plate is the same card with nothing said on it — the backdrop the
			    Figma layout template puts its own editable type over. */}
			{spec.plate ? null : <Typography spec={spec} palette={palette} />}
		</AbsoluteFill>
	)
}
