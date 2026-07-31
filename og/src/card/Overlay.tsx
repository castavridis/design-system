/**
 * The two passes that sit between the render and the type.
 *
 * A scrim, because a headline has to stay legible over artwork the generator
 * has never seen — a bright screenshot would otherwise swallow it. It is
 * anchored to the corner the text occupies and fades to nothing across the
 * frame, so it reads as depth rather than as a panel.
 *
 * Grain, because a WebGL gradient banding across 1200px is the tell that an
 * image was generated. It is laid down here rather than in the effect chain
 * because `postprocessing`'s noise seeds itself from accumulated render time,
 * which a still — rendered by seeking to a single frame — does not have. An
 * `feTurbulence` with a fixed seed is the same field every time.
 */

import { AbsoluteFill } from 'remotion'
import { alpha } from '../lib/color'
import type { Palette } from '../lib/palette'

export function Scrim({ palette }: { palette: Palette }) {
	return (
		<AbsoluteFill
			style={{
				background: [
					// Bottom-up, carrying the text block.
					`linear-gradient(to top, ${alpha(palette.ground, 0.94)} 0%, ${alpha(
						palette.ground,
						0.72,
					)} 26%, ${alpha(palette.ground, 0)} 62%)`,
					// Left-in, so a long title never runs onto busy artwork.
					`linear-gradient(to right, ${alpha(palette.ground, 0.8)} 0%, ${alpha(
						palette.ground,
						0,
					)} 58%)`,
					// Top-down, and much lighter. The header carries only the
					// wordmark and the meta chip, but a scene bright enough to
					// reach the top edge would take both with it.
					`linear-gradient(to bottom, ${alpha(palette.ground, 0.62)} 0%, ${alpha(
						palette.ground,
						0,
					)} 22%)`,
				].join(', '),
			}}
		/>
	)
}

export function Grain({ amount }: { amount: number }) {
	if (amount <= 0) return null

	return (
		<AbsoluteFill style={{ opacity: amount, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
			<svg width="100%" height="100%">
				<filter id="og-grain">
					{/* `seed` is fixed, and `stitchTiles` keeps the field from
					    seaming if the filter region is tiled. */}
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.82"
						numOctaves={3}
						seed={11}
						stitchTiles="stitch"
					/>
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width="100%" height="100%" filter="url(#og-grain)" />
			</svg>
		</AbsoluteFill>
	)
}
