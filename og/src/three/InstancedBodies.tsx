/**
 * An `InstancedMesh` whose transforms are written during layout, not during a
 * frame.
 *
 * drei's `<Instances>` collects its children's transforms in a `useFrame` and
 * uploads them just before a draw. That is the right design for an animating
 * scene and the wrong one here: `<ThreeCanvas>` drives the single captured
 * frame from a passive effect, and React runs *every* layout effect before
 * *any* passive one — so the draw happens before the frame loop has ever
 * written a matrix. The instance buffer is still zero-filled at that point,
 * every instance collapses to zero scale, and the card renders empty. It is a
 * silent failure: nothing errors, the geometry simply is not there.
 *
 * Writing the buffer in `useLayoutEffect` puts it ahead of the advance no
 * matter what order the components mount in. The transforms are a pure
 * function of the seed and the time anyway, so there is nothing a frame loop
 * was contributing.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'

export interface Body {
	position: [number, number, number]
	rotation?: [number, number, number]
	/** Uniform scale, or per-axis. */
	scale: number | [number, number, number]
	color: string
}

// Reused across every write — one allocation instead of one per instance per
// render, and nothing here escapes the loop.
const scratch = new Object3D()
const scratchColor = new Color()

export function InstancedBodies({ bodies, children }: { bodies: Body[]; children: ReactNode }) {
	const ref = useRef<InstancedMesh>(null)

	useLayoutEffect(() => {
		const mesh = ref.current
		if (!mesh) return

		bodies.forEach((body, index) => {
			scratch.position.set(...body.position)

			if (body.rotation) scratch.rotation.set(...body.rotation)
			else scratch.rotation.set(0, 0, 0)

			if (typeof body.scale === 'number') scratch.scale.setScalar(body.scale)
			else scratch.scale.set(...body.scale)

			scratch.updateMatrix()
			mesh.setMatrixAt(index, scratch.matrix)
			// Allocates `instanceColor` on the first call. Because this happens
			// before the first draw, the material compiles with instancing
			// colour already switched on.
			mesh.setColorAt(index, scratchColor.set(body.color))
		})

		mesh.count = bodies.length
		mesh.instanceMatrix.needsUpdate = true
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
	}, [bodies])

	return (
		// `undefined` for geometry and material: both come from the children.
		<instancedMesh ref={ref} args={[undefined, undefined, bodies.length]}>
			{children}
		</instancedMesh>
	)
}
