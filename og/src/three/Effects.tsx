/**
 * The grade — `pmndrs/postprocessing` by way of `@react-three/postprocessing`.
 *
 * Three passes, in the order light actually meets a lens: bloom where the
 * scene is brightest, fringing at the edges of the frame, then the corner
 * falloff. Together they are most of what makes a card look photographed
 * rather than rasterised.
 *
 * Film grain is deliberately *not* here. `postprocessing`'s noise effect seeds
 * itself from the composer's accumulated time, which depends on how many
 * frames were rendered before this one — fine for a video, wrong for a still
 * that is produced by seeking straight to one frame. The card lays its grain
 * down in the DOM instead, from a fixed seed.
 */

import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useMemo, type ReactElement } from 'react'
import { Vector2 } from 'three'
import type { Effects as EffectsSpec } from '../lib/spec'

export function Effects({ effects }: { effects: Required<EffectsSpec> }) {
	// Slightly less vertical than horizontal offset, which is how a real lens
	// misbehaves and reads as less of a filter than an even split.
	const offset = useMemo(
		() => new Vector2(effects.chromaticAberration, effects.chromaticAberration * 0.6),
		[effects.chromaticAberration],
	)

	// Built as an array rather than with inline `&&`: `EffectComposer` walks its
	// children expecting every one to be an effect, and a `false` in the list
	// throws rather than being skipped.
	const passes: ReactElement[] = []

	if (effects.bloom > 0) {
		passes.push(
			<Bloom
				key="bloom"
				intensity={effects.bloom}
				luminanceThreshold={0.55}
				luminanceSmoothing={0.35}
				mipmapBlur
			/>,
		)
	}

	if (effects.chromaticAberration > 0) {
		passes.push(
			<ChromaticAberration
				key="chromatic-aberration"
				blendFunction={BlendFunction.NORMAL}
				offset={offset}
				radialModulation={false}
				modulationOffset={0}
			/>,
		)
	}

	if (effects.vignette > 0) {
		passes.push(<Vignette key="vignette" eskil={false} offset={0.28} darkness={effects.vignette} />)
	}

	if (passes.length === 0) return null

	return <EffectComposer multisampling={4}>{passes}</EffectComposer>
}
