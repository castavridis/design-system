/**
 * Everything inside the canvas.
 *
 * The three source kinds converge here: a generated scene, an image or a video
 * frame all end up as geometry in the same camera, under the same effect
 * chain. That is the whole reason media is drawn as a textured plate rather
 * than composited behind the canvas — one grade covers all three, so a card is
 * recognisably from this generator whatever went into it.
 */

import { useRemotionEnvironment } from 'remotion'
import type { RefObject } from 'react'
import type { Palette } from '../lib/palette'
import { mediaUrl } from '../lib/media'
import type { ResolvedSpec } from '../lib/spec'
import { scenes } from '../scenes/registry'
import { ImagePlate, PreviewVideoPlate, RenderedVideoPlate } from '../sources/MediaPlates'
import { BrandText } from '../three/BrandText'
import { Effects } from '../three/Effects'
import { Settle } from '../three/Settle'
import { fontFiles } from '../lib/fonts'

export interface CardSceneProps {
	spec: ResolvedSpec
	palette: Palette
	/** Seconds along the timeline. The scenes' only moving input. */
	time: number
	/** The hidden `<video>` the Studio previews from. Unused during a render. */
	videoRef: RefObject<HTMLVideoElement | null>
}

export function CardScene({ spec, palette, time, videoRef }: CardSceneProps) {
	const { isRendering } = useRemotionEnvironment()
	const { source } = spec

	// Looked up as a component and rendered as an element, not called as a
	// function: a scene owns its own `useMemo`s, and calling it inline would
	// hang them off this component's hook list instead — where switching
	// scenes would reorder them.
	const Scene = source.kind === 'scene' ? scenes[source.name] : null

	return (
		<>
			{Scene ? (
				// Scenes bring their own `<Stage>`, so lighting comes with them.
				<Scene
					time={time}
					loopSeconds={spec.loopSeconds}
					palette={palette}
					seed={spec.seed}
				/>
			) : (
				// Plates are unlit, so a media card needs nothing but a ground
				// colour behind whatever the plate does not cover.
				<color attach="background" args={[palette.ground]} />
			)}

			{source.kind === 'image' ? (
				<ImagePlate src={mediaUrl(source.src)} fit={source.fit} palette={palette} />
			) : null}

			{source.kind === 'video' ? (
				isRendering ? (
					<RenderedVideoPlate src={mediaUrl(source.src)} fit={source.fit} palette={palette} />
				) : (
					<PreviewVideoPlate videoRef={videoRef} fit={source.fit} palette={palette} />
				)
			) : null}

			{/* Behind a scene, in front of a plate — either way it belongs to the
			    render rather than to the overlay, which is what lets bloom catch
			    it and the vignette fall across it. */}
			<BrandText
				fontUrl={fontFiles.serif}
				palette={palette}
				position={source.kind === 'scene' ? [0, 0, -3] : [0, 0, 0.05]}
				fontSize={source.kind === 'scene' ? 1.7 : 1.2}
				opacity={source.kind === 'scene' ? 0.16 : 0.1}
			>
				{spec.wordmark}
			</BrandText>

			<Effects effects={spec.effects} />

			{/* A scene is fully described by its props and needs only enough
			    frames for the environment to bake; media has to wait on a
			    decode before there is anything to draw. */}
			<Settle windowMs={source.kind === 'scene' ? 80 : 700} />
		</>
	)
}
