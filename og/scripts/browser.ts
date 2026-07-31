/**
 * Finding a Chromium to render with.
 *
 * Remotion downloads its own Chrome Headless Shell on first use, which is the
 * right default and the wrong one on a machine that cannot reach the download
 * host — a locked-down CI runner, a sandbox, an air-gapped build. Both are
 * supported: an existing browser is used if one can be found, and only if none
 * can does the download happen.
 *
 * Order is deliberate. The environment variable wins because it is the only
 * one an operator sets on purpose; a Playwright cache comes next because a
 * repo that has Playwright installed almost certainly wants that exact build
 * rather than a second copy of Chromium on disk.
 */

import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Set this to pin the renderer to a specific binary. */
export const browserEnvVar = 'OG_BROWSER_EXECUTABLE'

/** Layouts Playwright has used for its Chromium downloads. */
const playwrightLayouts = [
	join('chrome-linux', 'headless_shell'),
	join('chrome-linux', 'chrome'),
	join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
]

const systemPaths = [
	'/usr/bin/google-chrome',
	'/usr/bin/google-chrome-stable',
	'/usr/bin/chromium',
	'/usr/bin/chromium-browser',
	'/opt/google/chrome/chrome',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

async function fromPlaywrightCache(): Promise<string | null> {
	const cache = join(homedir(), '.cache', 'ms-playwright')

	if (!existsSync(cache)) return null

	let entries: string[]
	try {
		entries = await readdir(cache)
	} catch {
		return null
	}

	// Newest build number first, so an upgraded cache does not keep the render
	// pinned to a stale Chromium.
	const candidates = entries
		.filter((entry) => entry.startsWith('chromium'))
		.sort()
		.reverse()

	for (const candidate of candidates) {
		for (const layout of playwrightLayouts) {
			const path = join(cache, candidate, layout)
			if (existsSync(path)) return path
		}
	}

	return null
}

/**
 * A browser to render with, or `null` to let Remotion fetch one.
 *
 * Throws only for an explicitly configured path that does not exist —
 * a typo there should be reported, not quietly worked around.
 */
export async function resolveBrowserExecutable(): Promise<string | null> {
	const configured = process.env[browserEnvVar]

	if (configured) {
		if (!existsSync(configured)) {
			throw new Error(`${browserEnvVar} points at ${configured}, which does not exist.`)
		}
		return configured
	}

	const playwright = await fromPlaywrightCache()
	if (playwright) return playwright

	return systemPaths.find((path) => existsSync(path)) ?? null
}
