/**
 * Lighting shared by every scene.
 *
 * The environment is built from `Lightformer` rectangles rather than an HDRI:
 * drei's presets are fetched from a CDN at runtime, which would make a render
 * depend on the network and stall in a sandbox that has none. Lightformers are
 * geometry, so they cost nothing to fetch and — more usefully — they take
 * their colours from the palette, which is what makes a teal card's highlights
 * read as teal instead of as generic studio white.
 *
 * `frames={1}` bakes the environment cube once. The scene is static per frame,
 * so re-rendering it every advance would only cost time.
 */

import { Environment, Lightformer } from '@react-three/drei'
import type { Palette } from '../lib/palette'

export function Stage({ palette }: { palette: Palette }) {
	const isDark = palette.theme === 'dark'

	return (
		<>
			<color attach="background" args={[palette.ground]} />

			{/* Enough ambient to keep the shadow side from going to pure black,
			    which bloom would otherwise carve into hard silhouettes. */}
			<ambientLight intensity={isDark ? 0.35 : 0.9} color={palette.ink} />

			<directionalLight
				position={[4, 6, 5]}
				intensity={isDark ? 2.1 : 2.6}
				color={palette.accentSoft}
			/>
			<directionalLight position={[-6, -2, -4]} intensity={1.1} color={palette.accentDeep} />

			<Environment resolution={128} frames={1}>
				<Lightformer
					form="rect"
					intensity={isDark ? 3.4 : 2.2}
					color={palette.accentSoft}
					position={[-4, 2, 4]}
					scale={[8, 8, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="rect"
					intensity={isDark ? 2.2 : 1.6}
					color={palette.accent}
					position={[5, -1, 3]}
					scale={[6, 6, 1]}
					target={[0, 0, 0]}
				/>
				<Lightformer
					form="ring"
					intensity={isDark ? 1.6 : 1.0}
					color={palette.ink}
					position={[0, 5, -3]}
					scale={[5, 5, 1]}
					target={[0, 0, 0]}
				/>
				{/* A dim floor bounce, so undersides are not flat black. */}
				<Lightformer
					form="rect"
					intensity={0.6}
					color={palette.groundRaised}
					position={[0, -5, 0]}
					rotation={[Math.PI / 2, 0, 0]}
					scale={[10, 10, 1]}
				/>
			</Environment>
		</>
	)
}
