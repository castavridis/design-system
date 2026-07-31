/**
 * Where a `src` in a spec points.
 *
 * A spec is usually written by hand or by a build script, so it should be able
 * to say `shots/hero.png` and mean "the file I put in `og/public/`". Anything
 * that already looks like a URL is left alone, which is what lets a spec point
 * at a remote asset without a second field to say so.
 */

import { staticFile } from 'remotion'

const absolute = /^(https?:)?\/\//i

export function mediaUrl(src: string): string {
	if (absolute.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src

	// `staticFile` resolves against `og/public/` in the Studio and against the
	// bundled copy of it during a render, so one path works in both.
	return staticFile(src.replace(/^\/+/, ''))
}
