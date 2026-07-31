/**
 * `ramp-orbit` — a shoal of solids circling a lit core.
 *
 * The scene is a direct reading of a ramp: each body takes one step of the
 * accent scale, so a card accented `teal` and one accented `red` differ in
 * every mesh rather than in a tint laid over the top.
 *
 * Orbits are computed from `time` rather than accumulated, so frame 60 is the
 * same picture whether it was rendered on its own or after fifty-nine others.
 */

import { useMemo } from 'react'
import { accentBand } from '../lib/palette'
import { between, mulberry32 } from '../lib/random'
import { InstancedBodies, type Body } from '../three/InstancedBodies'
import { Stage } from '../three/Stage'
import type { SceneProps } from './types'

const COUNT = 34

export function RampOrbit({ time, palette, seed }: SceneProps) {
	const band = useMemo(() => accentBand(palette, 7), [palette])

	// Built once per seed. The array is the scene's entire random content —
	// everything after this is arithmetic on `time`.
	const bodies = useMemo(() => {
		const random = mulberry32(seed)

		return Array.from({ length: COUNT }, (_, index) => ({
			radius: between(random, 2.0, 3.8),
			height: between(random, -1.35, 1.35),
			// Signed, so the shoal counter-rotates against itself and reads as
			// depth rather than as one rigid turntable.
			speed: between(random, 0.06, 0.22) * (random() > 0.35 ? 1 : -1),
			phase: random() * Math.PI * 2,
			scale: between(random, 0.14, 0.46),
			tumble: between(random, -0.5, 0.5),
			color: band[index % band.length]!,
		}))
	}, [band, seed])

	// Positions for this instant. Recomputed whenever `time` moves, and handed
	// to the instanced mesh as a finished table.
	const placed = useMemo<Body[]>(
		() =>
			bodies.map((body) => {
				const angle = body.phase + time * body.speed
				const spin = time * body.tumble

				return {
					position: [
						Math.cos(angle) * body.radius,
						body.height + Math.sin(angle * 2) * 0.18,
						Math.sin(angle) * body.radius,
					],
					rotation: [spin, spin * 0.7, 0],
					scale: body.scale,
					color: body.color,
				}
			}),
		[bodies, time],
	)

	return (
		<>
			<Stage palette={palette} />

			{/* The core. Emissive well above 1 so the bloom pass has something
			    to catch — this is what gives the card its glow. */}
			<mesh position={[0, 0, 0]}>
				<sphereGeometry args={[0.85, 48, 48]} />
				<meshStandardMaterial
					color={palette.accentDeep}
					emissive={palette.accent}
					emissiveIntensity={2.4}
					roughness={0.28}
					metalness={0.15}
				/>
			</mesh>

			<InstancedBodies bodies={placed}>
				<icosahedronGeometry args={[1, 1]} />
				<meshStandardMaterial roughness={0.32} metalness={0.35} />
			</InstancedBodies>
		</>
	)
}
