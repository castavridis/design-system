import type { Palette } from '../lib/palette'

/**
 * What every scene is handed, and the whole of it.
 *
 * The contract is deliberately narrow. A scene may not read a clock, a
 * `useFrame` delta, or `Math.random()` — given the same props it must draw the
 * same pixels, because a still is produced by seeking straight to one frame
 * with no frames rendered before it. `time` is that frame's position in
 * seconds, and it is the only thing that moves.
 *
 * Nothing here is imported from Remotion, so a scene is renderable by any host
 * that can mount React Three Fiber — the Studio, a still render, or a plain
 * `<Canvas>` on a page.
 */
export interface SceneProps {
	/** Seconds along the composition. Every animation is a function of this. */
	time: number
	/** Colours resolved from the design tokens. */
	palette: Palette
	/** Seeds all placement jitter. */
	seed: number
}

export type Scene = (props: SceneProps) => React.ReactElement
