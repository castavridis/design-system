/**
 * Assembles the deployable static site into `public/`.
 *
 * The demo references its assets with root-absolute paths (`/dist/tokens.css`,
 * `/demo/demo.js`), so the deployed tree mirrors that layout exactly and only
 * `index.html` moves — up to the root, where a static host expects it. Nothing
 * in the demo needs rewriting, which keeps what runs locally and what gets
 * deployed byte-identical.
 *
 * Publishing an assembled directory rather than the repo root also means
 * `src/`, `scripts/` and `node_modules/` are never uploaded.
 */
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = join(root, 'public')

/** Copy one file, creating its parent directory first. */
async function copyInto(from: string, to: string) {
	await mkdir(dirname(to), { recursive: true })
	await copyFile(from, to)
	return to
}

/**
 * Recursively copy a directory, returning the files written. `skip` receives
 * each path relative to `from`, so callers can exclude a file *before* it is
 * written rather than filtering it out of the report afterwards.
 */
async function copyDir(
	from: string,
	to: string,
	skip: (relativePath: string) => boolean = () => false,
): Promise<string[]> {
	const written: string[] = []

	for (const entry of await readdir(from, { withFileTypes: true })) {
		const source = join(from, entry.name)

		if (skip(entry.name)) continue

		if (entry.isDirectory()) {
			written.push(...(await copyDir(source, join(to, entry.name))))
		} else {
			written.push(await copyInto(source, join(to, entry.name)))
		}
	}

	return written
}

async function assemble() {
	try {
		await stat(join(root, 'dist', 'tokens.css'))
	} catch {
		throw new Error('dist/ is missing or incomplete — run the token build before this script.')
	}

	await rm(siteDir, { recursive: true, force: true })
	await mkdir(siteDir, { recursive: true })

	const written = [
		// The demo's entry point becomes the site root. It is deliberately not
		// also copied to /demo/index.html — one page, one URL.
		await copyInto(join(root, 'demo', 'index.html'), join(siteDir, 'index.html')),
		// Its stylesheet and script keep the `/demo/` prefix the markup uses.
		...(await copyDir(join(root, 'demo'), join(siteDir, 'demo'), (name) => name === 'index.html')),
		// Every build artifact, served from `/dist/` as the demo expects.
		...(await copyDir(join(root, 'dist'), join(siteDir, 'dist'))),
	]

	console.log(`site -> public/ (${written.length} files)`)
	for (const file of written.sort()) console.log(`  ${relative(root, file)}`)
}

await assemble()
