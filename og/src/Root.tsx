/**
 * The composition.
 *
 * There is exactly one, and a spec configures it. The alternative — a
 * composition per card shape — would multiply with every accent, scene and
 * size, and none of those combinations is a different *thing*. `calculateMetadata`
 * reads the size straight off the spec, so one composition still renders a
 * 1200×630 card and a 1200×1200 one.
 */

import { Composition } from 'remotion'
import { OgCard } from './card/OgCard'
import { resolveSpec, type OgSpec } from './lib/spec'

/**
 * What the Studio opens on, and the defaults a partial spec is merged into.
 */
const sample: OgSpec = {
	eyebrow: 'pmndrs',
	title: 'React Three Fiber',
	subtitle: 'A React renderer for three.js — build your scene declaratively with re-usable components.',
	meta: 'github.com/pmndrs/react-three-fiber',
	accent: 'purple',
	theme: 'dark',
	source: { kind: 'scene', name: 'ramp-orbit' },
}

const fps = 30

export function RemotionRoot() {
	return (
		<Composition
			id="og-card"
			component={OgCard}
			defaultProps={{ spec: sample }}
			fps={fps}
			// Placeholders. `calculateMetadata` is what actually decides, but
			// `<Composition>` requires them up front.
			durationInFrames={fps * 6}
			width={1200}
			height={630}
			calculateMetadata={({ props }) => {
				const spec = resolveSpec(props.spec)

				// One loop, offset by wherever the card is sampled. Animated
				// output renders exactly the last `loopSeconds` of this, so a
				// card sampled late still has a whole loop ahead of it.
				const durationInFrames = Math.ceil((spec.atSeconds + spec.loopSeconds) * fps)

				return { width: spec.width, height: spec.height, fps, durationInFrames }
			}}
		/>
	)
}
