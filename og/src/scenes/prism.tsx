/**
 * `prism` — a few large polished slabs, turning slowly.
 *
 * Where `ramp-orbit` states the palette literally, this one states it in
 * reflections: the slabs are near-mirrors, so most of what you see is the
 * `Lightformer` environment, which is itself coloured from the accent. It
 * gives the quietest card of the three — good for a release note, poor for
 * anything that needs the palette spelled out.
 */

import { useMemo } from 'react'
import { loopSpeed } from '../lib/loop'
import { accentBand } from '../lib/palette'
import { between, mulberry32 } from '../lib/random'
import { Stage } from '../three/Stage'
import type { SceneProps } from './types'

const COUNT = 6

export function Prism({ time, loopSeconds, palette, seed }: SceneProps) {
	const band = useMemo(() => accentBand(palette, COUNT), [palette])

	const slabs = useMemo(() => {
		const random = mulberry32(seed)

		return Array.from({ length: COUNT }, (_, index) => ({
			position: [
				between(random, -3.2, 3.2),
				between(random, -1.6, 1.6),
				between(random, -2.4, 0.9),
			] as [number, number, number],
			size: [
				between(random, 0.9, 2.6),
				between(random, 0.9, 2.4),
				between(random, 0.08, 0.22),
			] as [number, number, number],
			tilt: between(random, -0.8, 0.8),
			speed: loopSpeed(between(random, 0.05, 0.16) * (random() > 0.5 ? 1 : -1), loopSeconds),
			phase: random() * Math.PI * 2,
			color: band[index % band.length]!,
		}))
	}, [band, loopSeconds, seed])

	return (
		<>
			<Stage palette={palette} />

			{slabs.map((slab, index) => {
				const angle = slab.phase + time * slab.speed

				return (
					<mesh
						key={index}
						position={[
							slab.position[0],
							// A whole multiple of the orbit angle, not 1.3 of it:
							// anything fractional would still be mid-cycle when
							// the slab has come back round.
							slab.position[1] + Math.sin(angle * 2) * 0.22,
							slab.position[2],
						]}
						rotation={[slab.tilt, angle, slab.tilt * 0.4]}
					>
						<boxGeometry args={slab.size} />
						{/* Fully metallic and barely rough: the slab shows the
						    environment rather than its own colour, and `color`
						    acts as the tint of the reflection. */}
						<meshStandardMaterial
							color={slab.color}
							roughness={0.14}
							metalness={0.96}
							envMapIntensity={1.4}
						/>
					</mesh>
				)
			})}

			{/* A soft emissive bar behind the slabs to give them something bright
			    to catch, and the bloom pass a source. */}
			<mesh position={[0, 0, -4]} rotation={[0, 0, 0.5]}>
				<planeGeometry args={[9, 0.6]} />
				<meshBasicMaterial color={palette.accent} toneMapped={false} />
			</mesh>
		</>
	)
}
