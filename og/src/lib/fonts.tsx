/**
 * Brand typefaces, declared and waited for.
 *
 * Two things have to be true before a card may be captured: the `@font-face`
 * rules exist, and the browser has actually finished loading the files. Miss
 * the second and the headline is captured in a fallback face — a failure that
 * is invisible in the Studio, where the font arrives a few milliseconds after
 * you look, and permanent in the PNG.
 *
 * `delayRender` holds the render open until `document.fonts.load()` has
 * resolved for every family the card can use.
 */

import { continueRender, delayRender, staticFile } from 'remotion'
import { useEffect, useState } from 'react'

/** Where `scripts/fonts.ts` puts each file, as a URL the bundle can serve. */
export const fontFiles = {
	serif: staticFile('fonts/faculty-glyphic-400.woff'),
	sans400: staticFile('fonts/geist-400.woff'),
	sans500: staticFile('fonts/geist-500.woff'),
	sans600: staticFile('fonts/geist-600.woff'),
	mono: staticFile('fonts/geist-mono-400.woff'),
}

/**
 * The families as CSS names. These match the names in the token file's
 * `fonts.*` stacks, so a DOM node styled with `tokens['fonts.serif']` resolves
 * to the file loaded here rather than to the serif fallback.
 */
const fontFaceCss = `
@font-face {
	font-family: 'Faculty Glyphic';
	font-style: normal;
	font-weight: 400;
	font-display: block;
	src: url('${fontFiles.serif}') format('woff');
}
@font-face {
	font-family: 'Geist';
	font-style: normal;
	font-weight: 400;
	font-display: block;
	src: url('${fontFiles.sans400}') format('woff');
}
@font-face {
	font-family: 'Geist';
	font-style: normal;
	font-weight: 500;
	font-display: block;
	src: url('${fontFiles.sans500}') format('woff');
}
@font-face {
	font-family: 'Geist';
	font-style: normal;
	font-weight: 600;
	font-display: block;
	src: url('${fontFiles.sans600}') format('woff');
}
@font-face {
	font-family: 'Geist Mono';
	font-style: normal;
	font-weight: 400;
	font-display: block;
	src: url('${fontFiles.mono}') format('woff');
}
`

/** Every face the card may set, in the form `document.fonts.load` expects. */
const required = [
	'400 100px "Faculty Glyphic"',
	'400 100px "Geist"',
	'500 100px "Geist"',
	'600 100px "Geist"',
	'400 100px "Geist Mono"',
]

/**
 * Declares the faces and blocks the render until they are usable.
 *
 * Mounted at the top of the card so the `<style>` is in the document before
 * the effect below asks the browser to load anything from it.
 */
export function BrandFonts() {
	const [handle] = useState(() => delayRender('Loading brand typefaces'))

	useEffect(() => {
		let released = false

		const release = () => {
			if (released) return
			released = true
			continueRender(handle)
		}

		Promise.all(required.map((face) => document.fonts.load(face)))
			.then(() => document.fonts.ready)
			.then(release)
			// A missing face should not hang the render until the delayRender
			// timeout: let it through and let the card show the fallback, which
			// is at least diagnosable from the output.
			.catch(release)

		return release
	}, [handle])

	return <style>{fontFaceCss}</style>
}
