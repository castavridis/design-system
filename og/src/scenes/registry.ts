/**
 * The scene registry.
 *
 * A spec names a scene as a string, so the set of legal names has to exist at
 * runtime for validation and at compile time for `SceneName`. Deriving both
 * from one object keeps them from drifting: adding an entry here is the whole
 * cost of adding a scene.
 */

import { Prism } from './prism'
import { RampOrbit } from './ramp-orbit'
import { TokenGrid } from './token-grid'
import type { Scene } from './types'

export const scenes = {
	'ramp-orbit': RampOrbit,
	'token-grid': TokenGrid,
	prism: Prism,
} satisfies Record<string, Scene>

export type SceneName = keyof typeof scenes

export const sceneNames = Object.keys(scenes) as SceneName[]
