/**
 * A texture fitted to the frame.
 *
 * Images and video frames are drawn as geometry rather than as an `<img>`
 * behind the canvas, which is the point of routing them through here: a plate
 * sits inside the scene, so it takes the same bloom, fringing and vignette as
 * a generated scene does. A photo card and a scene card then look like they
 * came off the same press instead of like two different templates.
 */

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { SRGBColorSpace, type Texture } from 'three'
import type { Palette } from '../lib/palette'

export interface PlateProps {
	texture: Texture
	fit: 'cover' | 'contain'
	palette: Palette
}

/** The texture's aspect, or 16:9 if it has not reported a size yet. */
function aspectOf(texture: Texture): number {
	const image = texture.image as { width?: number; height?: number } | undefined
	const width = image?.width ?? 0
	const height = image?.height ?? 0

	return width > 0 && height > 0 ? width / height : 16 / 9
}

export function Plate({ texture, fit, palette }: PlateProps) {
	const viewport = useThree((state) => state.viewport)

	// Loaders hand back textures in linear space. Left that way, a photograph
	// renders washed out and pale — the single most visible thing that can go
	// wrong on a media card.
	useLayoutEffect(() => {
		texture.colorSpace = SRGBColorSpace
		texture.needsUpdate = true
	}, [texture])

	const [width, height] = useMemo(() => {
		const source = aspectOf(texture)
		const frame = viewport.width / viewport.height

		// `cover` matches the axis that would otherwise leave a gap; `contain`
		// matches the other one. The two cases are exact mirrors.
		const matchHeight = fit === 'cover' ? source > frame : source <= frame

		return matchHeight
			? [viewport.height * source, viewport.height]
			: [viewport.width, viewport.width / source]
	}, [fit, texture, viewport.height, viewport.width])

	return (
		<group>
			<mesh>
				<planeGeometry args={[width, height]} />
				{/* Unlit and untone-mapped: the source is already a finished
				    image, so the only grade it should get is the composer's. */}
				<meshBasicMaterial map={texture} toneMapped={false} />
			</mesh>

			{/* A wash of the accent over the media, held very low. It is what
			    ties an arbitrary screenshot to the palette without reading as a
			    colour cast. */}
			<mesh position={[0, 0, 0.01]}>
				<planeGeometry args={[width, height]} />
				<meshBasicMaterial color={palette.accent} transparent opacity={0.07} toneMapped={false} />
			</mesh>
		</group>
	)
}
