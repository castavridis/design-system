/**
 * The renderer.
 *
 *     tsx scripts/render.ts specs/r3f.json --out out/r3f.png
 *     tsx scripts/render.ts specs/site.json --manifest
 *     tsx scripts/render.ts --title "Postprocessing" --accent teal --out out/pp.png
 *
 * A batch shares one webpack bundle and one browser. That is most of the
 * wall-clock: bundling costs seconds and launching Chromium costs about a
 * second, while a card itself renders in a fraction of one. Rendering ten
 * cards should not pay either cost ten times.
 */

import { bundle } from '@remotion/bundler'
import {
	ensureBrowser,
	openBrowser,
	renderMedia,
	renderStill,
	selectComposition,
} from '@remotion/renderer'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { resolveSpec, type OgSpec } from '../src/lib/spec'
import { browserEnvVar, resolveBrowserExecutable } from './browser'
import { syncFonts } from './fonts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const entryPoint = join(root, 'src', 'index.ts')
const publicDir = join(root, 'public')

/** A spec plus where its PNG goes. */
interface Job {
	spec: OgSpec
	out: string
}

/** A manifest is either a bare array of cards, or that array with an `outDir`. */
interface Manifest {
	outDir?: string
	cards: (OgSpec & { out?: string })[]
}

/**
 * `pnpm og -- --title "…"` forwards the `--` itself, and `parseArgs` reads a
 * bare `--` as "everything after this is positional" — so every flag would
 * arrive as a filename. Dropping a leading one lets the same command work
 * whether it was invoked through pnpm or directly.
 */
const argv = process.argv.slice(2)
const args = argv[0] === '--' ? argv.slice(1) : argv

const { values, positionals } = parseArgs({
	args,
	allowPositionals: true,
	options: {
		out: { type: 'string' },
		manifest: { type: 'boolean', default: false },
		scale: { type: 'string', default: '1' },
		format: { type: 'string', default: 'png' },
		// Forwards the page's own console to this one. The card is a web page,
		// so when it misbehaves that is where it says so.
		verbose: { type: 'boolean', default: false },
		// Animated output. One loop of the scene, which meets itself exactly
		// because every rate is rounded to whole cycles per `loopSeconds`.
		gif: { type: 'boolean', default: false },
		mp4: { type: 'boolean', default: false },
		/** Frames per second of the output. Only thins a GIF; ignored for mp4. */
		fps: { type: 'string' },
		/** GIF repeats. Omit for endless, which is what a card wants. */
		loops: { type: 'string' },
		// Enough inline overrides to render a card without writing a file.
		title: { type: 'string' },
		eyebrow: { type: 'string' },
		subtitle: { type: 'string' },
		meta: { type: 'string' },
		accent: { type: 'string' },
		theme: { type: 'string' },
		scene: { type: 'string' },
		image: { type: 'string' },
		video: { type: 'string' },
		at: { type: 'string' },
		seed: { type: 'string' },
	},
})

/**
 * Which codec, if any, this run produces. `null` means stills.
 *
 * GIF because that is what pastes into a README and animates in a feed; mp4
 * because it is a tenth of the size when the target accepts it.
 */
const animate: 'gif' | 'h264' | null = values.gif ? 'gif' : values.mp4 ? 'h264' : null

const outputExtension = animate === 'gif' ? '.gif' : animate === 'h264' ? '.mp4' : '.png'

/** `'card.png'` -> `'card.gif'`, so a manifest need not know how it is rendered. */
function withExtension(path: string): string {
	return path.replace(/\.[^./\\]+$/, '') + outputExtension
}

function fail(message: string): never {
	console.error(`\n  ${message}\n`)
	process.exit(1)
}

/** `'React Three Fiber'` -> `'react-three-fiber'`, for a default filename. */
function slug(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'card'
	)
}

/** Command-line overrides, layered over whatever came from a file. */
function applyOverrides(spec: OgSpec): OgSpec {
	const next: OgSpec = { ...spec }

	if (values.title !== undefined) next.title = values.title
	if (values.eyebrow !== undefined) next.eyebrow = values.eyebrow
	if (values.subtitle !== undefined) next.subtitle = values.subtitle
	if (values.meta !== undefined) next.meta = values.meta
	if (values.accent !== undefined) next.accent = values.accent as OgSpec['accent']
	if (values.theme !== undefined) next.theme = values.theme as OgSpec['theme']
	if (values.at !== undefined) next.atSeconds = Number(values.at)
	if (values.seed !== undefined) next.seed = Number(values.seed)

	// The three source flags are mutually exclusive; last one named wins, and
	// naming none leaves whatever the file said.
	if (values.scene !== undefined) {
		next.source = { kind: 'scene', name: values.scene as never }
	}
	if (values.image !== undefined) next.source = { kind: 'image', src: values.image }
	if (values.video !== undefined) next.source = { kind: 'video', src: values.video }

	return next
}

async function readSpecFile(path: string): Promise<unknown> {
	if (!existsSync(path)) fail(`No spec at ${path}`)

	try {
		return JSON.parse(await readFile(path, 'utf8')) as unknown
	} catch (error) {
		fail(`${path} is not valid JSON — ${(error as Error).message}`)
	}
}

async function collectJobs(): Promise<Job[]> {
	const outDirDefault = join(root, 'out')
	const specPath = positionals[0]

	if (values.manifest) {
		if (!specPath) fail('--manifest needs a manifest file: render.ts specs/site.json --manifest')

		const raw = (await readSpecFile(specPath)) as Manifest | (OgSpec & { out?: string })[]
		const manifest: Manifest = Array.isArray(raw) ? { cards: raw } : raw

		if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) {
			fail(`${specPath} has no \`cards\`. Expected an array of specs, or { outDir, cards }.`)
		}

		// `outDir` in the manifest is relative to the manifest itself, which is
		// what you want when it is checked in next to the specs it describes.
		const outDir = manifest.outDir
			? resolve(dirname(resolve(specPath)), manifest.outDir)
			: outDirDefault

		return manifest.cards.map((card) => {
			const { out, ...spec } = card
			const withOverrides = applyOverrides(spec)

			return {
				spec: withOverrides,
				out: withExtension(out ? resolve(outDir, out) : join(outDir, slug(withOverrides.title))),
			}
		})
	}

	const spec = applyOverrides(specPath ? ((await readSpecFile(specPath)) as OgSpec) : ({} as OgSpec))

	if (!spec.title) {
		fail('Nothing to render. Pass a spec file, or at least --title "…".')
	}

	return [
		{
			spec,
			out: withExtension(values.out ? resolve(values.out) : join(outDirDefault, slug(spec.title))),
		},
	]
}

/**
 * Where local media is staged so the bundle can serve it.
 *
 * Emptied on every run: it is a copy of someone else's file, and a stale one
 * would be served silently the next time a spec named the same thing.
 */
const inbox = join(publicDir, 'inbox')

/**
 * Copies any `src` that names a file on disk into the served directory, and
 * rewrites the spec to point at the copy.
 *
 * Without this, a spec could only reference media already sitting in
 * `og/public/` — which is a strange thing to demand of a command-line tool.
 * `--image ~/shot.png` should work, so it does. Anything that is already a URL,
 * or that does not exist on disk, is passed through untouched and left for
 * `staticFile` to resolve.
 */
async function stageMedia(jobs: Job[]): Promise<void> {
	const staged = new Map<string, string>()
	let used = false

	for (const job of jobs) {
		const source = job.spec.source

		if (!source || source.kind === 'scene') continue

		const local = resolve(source.src)
		if (!existsSync(local) || !statSync(local).isFile()) continue

		if (!used) {
			await rm(inbox, { recursive: true, force: true })
			await mkdir(inbox, { recursive: true })
			used = true
		}

		let name = staged.get(local)

		if (!name) {
			// Hashed by path so two files with the same basename cannot collide,
			// and so the same file staged twice is copied once.
			const digest = createHash('sha1').update(local).digest('hex').slice(0, 8)
			name = `${digest}-${basename(local)}`
			await copyFile(local, join(inbox, name))
			staged.set(local, name)
		}

		job.spec = { ...job.spec, source: { ...source, src: `inbox/${name}` } }
	}
}

async function main() {
	// The generator reads its colours from the built token module. Failing here
	// with the command to run beats a module-not-found from inside webpack.
	if (!existsSync(join(root, '..', 'dist', 'tokens.js'))) {
		fail('Tokens are not built. Run `pnpm build` at the repo root first.')
	}

	const jobs = await collectJobs()

	// Validate every spec before doing any expensive work, so a typo in the
	// last card of a manifest does not surface five minutes in.
	for (const job of jobs) {
		try {
			resolveSpec(job.spec)
		} catch (error) {
			fail(`${job.out}: ${(error as Error).message}`)
		}
	}

	const scale = Number(values.scale)
	if (!Number.isFinite(scale) || scale <= 0) fail(`--scale must be a positive number.`)

	const imageFormat = values.format === 'jpeg' ? 'jpeg' : 'png'

	const onBrowserLog = values.verbose
		? (log: { type: string; text: string }) => console.log(`  [page:${log.type}] ${log.text}`)
		: undefined

	await syncFonts()
	await stageMedia(jobs)

	// Prefer a browser that is already on the machine; only fall back to
	// Remotion's download when there is none, since that needs network access
	// the render itself does not.
	const browserExecutable = await resolveBrowserExecutable()

	if (browserExecutable) {
		console.log(`browser  ${browserExecutable}`)
	} else {
		console.log(`no local Chromium found — downloading one (set ${browserEnvVar} to avoid this)`)
		await ensureBrowser()
	}

	console.log(`bundling…`)
	const serveUrl = await bundle({ entryPoint, publicDir })

	// SwiftShader behind ANGLE. Without it a GPU-less machine renders a blank
	// canvas rather than reporting that it has no WebGL.
	const chromiumOptions = { gl: 'swangle' } as const
	const browser = await openBrowser('chrome', {
		chromiumOptions,
		...(browserExecutable ? { browserExecutable } : {}),
	})

	try {
		for (const job of jobs) {
			const resolved = resolveSpec(job.spec)
			const inputProps = { spec: job.spec }

			const composition = await selectComposition({
				serveUrl,
				id: 'og-card',
				inputProps,
				puppeteerInstance: browser,
				chromiumOptions,
				...(onBrowserLog ? { onBrowserLog } : {}),
			})

			// One time axis: the spec's `atSeconds` picks the frame, which is
			// both the scene's phase and the timestamp sampled from a video.
			const frame = Math.min(
				composition.durationInFrames - 1,
				Math.max(0, Math.round(resolved.atSeconds * composition.fps)),
			)

			await mkdir(dirname(job.out), { recursive: true })

			if (animate) {
				// Exactly one loop, ending on the last frame of the timeline.
				// `calculateMetadata` sized the composition as `atSeconds +
				// loopSeconds`, so this is the whole loop no matter how late the
				// card is sampled — and because every rate is a whole number of
				// cycles per loop, the last frame leads back into the first.
				const loopFrames = Math.round(resolved.loopSeconds * composition.fps)
				const first = Math.max(0, composition.durationInFrames - loopFrames)

				// A GIF is thinned by dropping frames rather than by slowing the
				// clip down, so the motion keeps its speed. mp4 keeps them all.
				const targetFps = values.fps ? Number(values.fps) : animate === 'gif' ? 15 : composition.fps
				const everyNthFrame =
					animate === 'gif' ? Math.max(1, Math.round(composition.fps / targetFps)) : 1

				await renderMedia({
					composition,
					serveUrl,
					codec: animate,
					outputLocation: job.out,
					inputProps,
					frameRange: [first, composition.durationInFrames - 1],
					everyNthFrame,
					numberOfGifLoops: values.loops ? Number(values.loops) : null,
					imageFormat: 'png',
					scale,
					puppeteerInstance: browser,
					chromiumOptions,
					...(onBrowserLog ? { onBrowserLog } : {}),
				})

				console.log(
					`  ${composition.width}×${composition.height}  ` +
						`${resolved.loopSeconds}s loop @${Math.round(composition.fps / everyNthFrame)}fps  ` +
						`${job.out}`,
				)
			} else {
				await renderStill({
					composition,
					serveUrl,
					output: job.out,
					inputProps,
					frame,
					imageFormat,
					scale,
					puppeteerInstance: browser,
					chromiumOptions,
					...(onBrowserLog ? { onBrowserLog } : {}),
				})

				console.log(
					`  ${composition.width}×${composition.height}` +
						`${scale === 1 ? '' : ` @${scale}x`}  ${job.out}`,
				)
			}
		}
	} finally {
		await browser.close({ silent: true })
	}

	console.log(`\ndone — ${jobs.length} card${jobs.length === 1 ? '' : 's'}\n`)
}

main().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})
