/**
 * Copies the brand typefaces out of `@fontsource` and into `og/public/fonts/`.
 *
 * The token package's `fonts.css` pulls from Google Fonts, which is right for
 * a web page and wrong for a renderer: a card would then depend on the network
 * at the moment of capture, and a machine without egress — CI, a sandbox —
 * would silently produce cards set in a fallback face. Copying the files in
 * makes a render hermetic.
 *
 * One copy serves both halves of the card. The DOM headline gets them through
 * an `@font-face` rule, and `troika-three-text` parses the same `.woff2`
 * directly for the 3D wordmark, so the two can never drift apart.
 *
 * `og/public/` is generated and git-ignored; this runs before `studio` and
 * before every render.
 */

import { copyFile, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

export const fontsDirectory = join(here, '..', 'public', 'fonts')

/**
 * Which file backs which face.
 *
 * **WOFF, not WOFF2.** The browser would prefer woff2, but the 3D wordmark is
 * typeset by `troika-three-text`, which parses font files itself rather than
 * handing them to the browser — and its parser only understands WOFF. (Its
 * bundled `woff2otf` is a *WOFF*-to-OTF converter with fflate behind it; woff2
 * is Brotli-compressed and there is no Brotli decoder in the bundle.) Handed a
 * `.woff2`, troika logs `Failure loading font` and never calls its callback,
 * which suspends the render until it times out 28 seconds later.
 *
 * One format for both consumers is worth more here than the few kilobytes
 * woff2 would save on a file that is read off local disk.
 *
 * Only the `latin` subsets are copied. `latin-ext` would roughly double the
 * bytes for glyphs no card has needed yet; if one does, add it here.
 */
const faces = [
	{
		package: '@fontsource/faculty-glyphic/files/faculty-glyphic-latin-400-normal.woff',
		file: 'faculty-glyphic-400.woff',
	},
	{ package: '@fontsource/geist/files/geist-latin-400-normal.woff', file: 'geist-400.woff' },
	{ package: '@fontsource/geist/files/geist-latin-500-normal.woff', file: 'geist-500.woff' },
	{ package: '@fontsource/geist/files/geist-latin-600-normal.woff', file: 'geist-600.woff' },
	{
		package: '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff',
		file: 'geist-mono-400.woff',
	},
] as const

export async function syncFonts(): Promise<string> {
	// Cleared rather than added to, so a face that is renamed or changes format
	// does not leave a stale file behind for a `@font-face` rule to keep
	// finding. The directory is generated in full every time.
	await rm(fontsDirectory, { recursive: true, force: true })
	await mkdir(fontsDirectory, { recursive: true })

	await Promise.all(
		faces.map(async (face) => {
			// Resolved through Node rather than joined onto a `node_modules`
			// path, so this keeps working under pnpm's symlinked store.
			const source = require.resolve(face.package)
			await copyFile(source, join(fontsDirectory, face.file))
		}),
	)

	return fontsDirectory
}

// Runnable on its own (`tsx scripts/fonts.ts`) as well as importable.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	syncFonts().then(
		(directory) => console.log(`fonts -> ${directory}`),
		(error: unknown) => {
			console.error(error)
			process.exit(1)
		},
	)
}
