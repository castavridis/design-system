/**
 * Type set in the scene, with `troika-three-text` through drei's `<Text>`.
 *
 * Troika builds an SDF atlas for the glyphs it is asked for and renders them
 * as a single mesh, so the wordmark is real geometry: it sits at a depth,
 * takes the scene's colour, and — the reason it is here rather than in the DOM
 * — is picked up by the bloom pass along with everything else. A DOM headline
 * composited afterwards could only ever sit flat on top of the render.
 *
 * The font is a `.woff2` copied out of `@fontsource` by `scripts/fonts.ts`.
 * Troika parses woff2 itself, so nothing has to be converted, and because the
 * file is local the render never waits on a font CDN.
 */

import { Text } from '@react-three/drei'
import type { Palette } from '../lib/palette'

export interface BrandTextProps {
	children: string
	fontUrl: string
	palette: Palette
	position?: [number, number, number]
	fontSize?: number
	opacity?: number
	maxWidth?: number
}

export function BrandText({
	children,
	fontUrl,
	palette,
	position = [0, 0, -3],
	fontSize = 1.6,
	opacity = 0.16,
	maxWidth = 9,
}: BrandTextProps) {
	if (children.trim() === '') return null

	return (
		<Text
			font={fontUrl}
			position={position}
			fontSize={fontSize}
			maxWidth={maxWidth}
			color={palette.ink}
			fillOpacity={opacity}
			anchorX="center"
			anchorY="middle"
			textAlign="center"
			letterSpacing={-0.02}
			lineHeight={0.98}
			// drei suspends on the font load, and `<ThreeCanvas>` wraps its
			// children in a Suspense boundary that holds the render open — so
			// this cannot be captured half-typeset.
		>
			{children}
		</Text>
	)
}
