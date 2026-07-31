/**
 * `token-grid` — the ramp as a field of columns.
 *
 * A travelling wave sets each column's height, and the height picks the ramp
 * step it is coloured with, so the scale is read off the geometry rather than
 * applied to it: tall is light, short is dark, and the two can never disagree.
 *
 * Reads as an even, typographic texture, which makes it the better background
 * of the three when a card carries a long title.
 */

import { useMemo } from 'react'
import type { Palette } from '../lib/palette'
import { InstancedBodies, type Body } from '../three/InstancedBodies'
import { Stage } from '../three/Stage'
import type { SceneProps } from './types'

const COLUMNS = 22
const ROWS = 12
const SPACING = 0.44

/** Ramp steps used by the columns — the middle of the scale, light to dark. */
function columnScale(palette: Palette): string[] {
	return palette.scale.slice(1, 9)
}

export function TokenGrid({ time, palette, seed }: SceneProps) {
	const scale = useMemo(() => columnScale(palette), [palette])

	// The grid itself is regular; the seed only shifts the wave's origin, so a
	// different seed re-composes the field without disturbing its rhythm.
	const origin = useMemo(() => {
		const offset = (seed % 97) / 97
		return { x: offset * 6.2, z: offset * 4.1 }
	}, [seed])

	const cells = useMemo(() => {
		const list: { x: number; z: number; distance: number }[] = []

		for (let column = 0; column < COLUMNS; column++) {
			for (let row = 0; row < ROWS; row++) {
				const x = (column - (COLUMNS - 1) / 2) * SPACING
				const z = (row - (ROWS - 1) / 2) * SPACING
				list.push({ x, z, distance: Math.hypot(x + origin.x, z + origin.z) })
			}
		}

		return list
	}, [origin])

	// The wave, evaluated for this instant. Height and colour come from the same
	// number, so a tall column can never be shaded as a short one.
	const columns = useMemo<Body[]>(
		() =>
			cells.map((cell) => {
				// One radial wave crossed with a slower diagonal one, so the field
				// never resolves into an obvious repeat.
				const wave =
					Math.sin(cell.distance * 1.15 - time * 1.25) * 0.6 +
					Math.sin((cell.x - cell.z) * 0.5 + time * 0.45) * 0.4

				const normalised = (wave + 1) / 2
				const height = 0.22 + normalised * 2.1
				const step = Math.min(
					scale.length - 1,
					Math.max(0, Math.round((1 - normalised) * (scale.length - 1))),
				)

				return {
					position: [cell.x, height / 2, cell.z],
					scale: [1, height, 1],
					color: scale[step]!,
				}
			}),
		[cells, scale, time],
	)

	return (
		<>
			<Stage palette={palette} />

			<group rotation={[0.62, 0.42, 0]} position={[0, -0.9, 0]}>
				<InstancedBodies bodies={columns}>
					<boxGeometry args={[SPACING * 0.62, 1, SPACING * 0.62]} />
					<meshStandardMaterial roughness={0.38} metalness={0.3} />
				</InstancedBodies>
			</group>
		</>
	)
}
