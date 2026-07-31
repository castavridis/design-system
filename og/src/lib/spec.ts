/**
 * The card spec — the whole public surface of the generator.
 *
 * A spec is plain JSON: it travels from a file on disk, through
 * `renderStill`'s `inputProps`, into the browser, without anything having to
 * serialise a closure. Everything a card can be is expressed here, so adding a
 * capability means adding a field rather than a new entry point.
 *
 * Every field is optional except `title`. `resolveSpec` fills the rest in, and
 * is the only place defaults live — components read a `ResolvedSpec` and never
 * fall back themselves, so there is one answer to "what does this card look
 * like if I say nothing".
 */

import { rampNames, type RampName } from 'pmndrs-design-tokens'
import type { ThemeName } from './palette'
import { sceneNames, type SceneName } from '../scenes/registry'

/** Output dimensions. `og` is the 1.91:1 that Open Graph and Twitter agree on. */
export type SizeName = 'og' | 'square' | 'wide'

export const sizes: Record<SizeName, { width: number; height: number }> = {
	og: { width: 1200, height: 630 },
	square: { width: 1200, height: 1200 },
	wide: { width: 1920, height: 1080 },
}

/** A live three.js scene, generated from the tokens. */
export interface SceneSource {
	kind: 'scene'
	/** Which scene from the registry. Defaults to `ramp-orbit`. */
	name?: SceneName
}

/** A still image, drawn into the scene as a texture so it picks up the grade. */
export interface ImageSource {
	kind: 'image'
	/** Absolute URL, or a path relative to `og/public/` served by Remotion. */
	src: string
	fit?: 'cover' | 'contain'
}

/**
 * A video, sampled at one timestamp.
 *
 * Frames are pulled through Remotion's compositor rather than an HTML `<video>`
 * element: the headless Chromium used for rendering ships without proprietary
 * codecs, so a `<video>` tag would decode nothing for the most common inputs.
 */
export interface VideoSource {
	kind: 'video'
	src: string
	fit?: 'cover' | 'contain'
}

export type Source = SceneSource | ImageSource | VideoSource

export interface Effects {
	/** Bloom on the brightest parts of the scene. `0` disables it. */
	bloom?: number
	/** Lens fringing, in screen-space offset. Small numbers: 0.0005–0.004. */
	chromaticAberration?: number
	/** Film grain. `0` disables it. */
	noise?: number
	/** Corner darkening. `0` disables it. */
	vignette?: number
}

export interface OgSpec {
	/** The headline. The only required field. */
	title: string
	/** Small line above the title — a section, a repo owner, a category. */
	eyebrow?: string
	/** A line below the title. Wraps; keep it to a clause. */
	subtitle?: string
	/** Bottom-right chip — a URL or a version. */
	meta?: string
	/** Which ramp accents the card. Defaults to `purple`. */
	accent?: RampName
	/** Which neutral ramp is the ground. Defaults to `dark`. */
	theme?: ThemeName
	size?: SizeName
	/** Overrides `size` when you need an exact pixel box. */
	width?: number
	height?: number
	source?: Source
	effects?: Effects
	/**
	 * Word set in 3D with `troika-three-text`, so it takes the scene's light
	 * and bloom rather than sitting flat on top of the render.
	 *
	 * Defaults to the title behind a scene, and to nothing over media — where
	 * it would only print the headline a second time. An empty string always
	 * means none.
	 */
	wordmark?: string
	/** Seeds every random placement in the scene. Same seed, same card. */
	seed?: number
	/**
	 * Where on the timeline the card is sampled, in seconds — the card's one
	 * time axis.
	 *
	 * For a scene it is a look-picker rather than a progress bar: scenes are
	 * pure functions of it, so nudge it until the composition sits well. For a
	 * video it is the timestamp sampled out of the file. Keeping both on one
	 * axis is what lets the CLI turn a spec into a single frame number without
	 * having to reconcile two clocks.
	 */
	atSeconds?: number
	/**
	 * The period a scene repeats over, in seconds. Defaults to 6.
	 *
	 * Only animated output reads it directly, but it shapes stills too: scenes
	 * round their rates to whole cycles of this, so changing it changes how
	 * fast everything moves. Shorter loops mean faster motion and smaller GIFs.
	 */
	loopSeconds?: number
}

/**
 * A source with every default already applied.
 *
 * Components read this rather than `Source`, so none of them has to carry a
 * `?? 'cover'` and none of them can disagree with another about what the
 * default is.
 */
export type ResolvedSource =
	| { kind: 'scene'; name: SceneName }
	| { kind: 'image'; src: string; fit: 'cover' | 'contain' }
	| { kind: 'video'; src: string; fit: 'cover' | 'contain' }

export interface ResolvedSpec extends Required<Omit<OgSpec, 'width' | 'height' | 'source' | 'effects'>> {
	width: number
	height: number
	source: ResolvedSource
	effects: Required<Effects>
}

const defaultEffects: Required<Effects> = {
	bloom: 0.9,
	chromaticAberration: 0.0016,
	noise: 0.045,
	vignette: 0.5,
}

/** Thrown for a spec that cannot render, with the offending value named. */
export class SpecError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new SpecError(message)
}

/**
 * Fills in every default and rejects what cannot render.
 *
 * Validation is deliberately loud. A spec usually arrives from a file or a
 * build script rather than a type-checked call site, so a misspelled accent
 * should stop the render with the list of legal values rather than quietly
 * produce a purple card.
 */
export function resolveSpec(input: OgSpec): ResolvedSpec {
	assert(input && typeof input === 'object', 'Spec must be an object.')
	assert(
		typeof input.title === 'string' && input.title.trim() !== '',
		'Spec needs a non-empty `title`.',
	)

	const accent = input.accent ?? 'purple'
	assert(
		rampNames.includes(accent),
		`Unknown accent \`${accent}\`. Expected one of: ${rampNames.join(', ')}.`,
	)

	const theme = input.theme ?? 'dark'
	assert(theme === 'dark' || theme === 'light', `Unknown theme \`${theme}\`.`)

	const sizeName = input.size ?? 'og'
	assert(sizeName in sizes, `Unknown size \`${sizeName}\`. Expected: ${Object.keys(sizes).join(', ')}.`)

	const source = resolveSource(input.source)
	const size = sizes[sizeName]

	return {
		title: input.title,
		eyebrow: input.eyebrow ?? '',
		subtitle: input.subtitle ?? '',
		meta: input.meta ?? '',
		accent,
		theme,
		size: sizeName,
		width: Math.round(input.width ?? size.width),
		height: Math.round(input.height ?? size.height),
		source,
		effects: { ...defaultEffects, ...(input.effects ?? {}) },
		// An empty string is a real choice — "no wordmark" — so only `undefined`
		// falls through to the default.
		//
		// Which differs by source. Behind a generated scene the wordmark reads
		// as depth, and repeating the title there is the effect. Over a photo
		// or a video frame it lands in front of the artwork and simply prints
		// the headline twice, so media starts with none.
		wordmark: input.wordmark ?? (source.kind === 'scene' ? input.title : ''),
		seed: input.seed ?? 1,
		loopSeconds: Math.max(0.5, input.loopSeconds ?? 6),
		atSeconds: input.atSeconds ?? 2,
	}
}

function resolveSource(source: Source | undefined): ResolvedSource {
	if (!source) return { kind: 'scene', name: 'ramp-orbit' }

	assert(typeof source === 'object', 'Spec `source` must be an object.')

	switch (source.kind) {
		case 'scene': {
			const name = source.name ?? 'ramp-orbit'
			assert(
				sceneNames.includes(name),
				`Unknown scene \`${name}\`. Expected one of: ${sceneNames.join(', ')}.`,
			)
			return { kind: 'scene', name }
		}

		case 'image':
			assert(typeof source.src === 'string' && source.src !== '', 'Image source needs a `src`.')
			return { kind: 'image', src: source.src, fit: source.fit ?? 'cover' }

		case 'video':
			assert(typeof source.src === 'string' && source.src !== '', 'Video source needs a `src`.')
			return { kind: 'video', src: source.src, fit: source.fit ?? 'cover' }

		default:
			throw new SpecError(
				// `source` is `never` here, so read the tag back off the raw value.
				`Unknown source kind \`${(source as { kind: string }).kind}\`. Expected: scene, image, video.`,
			)
	}
}
