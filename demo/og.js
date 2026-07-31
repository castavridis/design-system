/**
 * One job: make this page's own `og:image` absolute.
 *
 * A crawler fetches the card from a different origin than the page that
 * declares it, so a root-relative path — which resolves perfectly in a browser
 * — is the most common reason a card never appears. The markup ships the
 * relative path because the deployed origin isn't known when the file is
 * written, and this promotes it on load.
 *
 * A real site should write the absolute URL in at build time instead: a
 * crawler reads the HTML it is served and does not run this script. The page
 * says so where it shows the snippet, and doing it here anyway keeps the
 * demonstration honest rather than shipping a tag that is quietly wrong.
 */
const tag = document.querySelector('meta[data-og-image]')

if (tag) {
	tag.setAttribute('content', new URL(tag.getAttribute('content'), location.href).href)
}

/*
 * `autoplay` in the markup and not here, so the loop plays on the pass where
 * the reader wants it without waiting for a module. This only takes it away
 * again: a looping clip is exactly the motion `prefers-reduced-motion` is
 * about, and the poster is a still of the same frame, so stopping it costs the
 * page nothing. Controls appear in exchange — the motion stays available, it
 * just has to be asked for.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const loop = document.querySelector('video[data-loop]')

if (loop && reduced) {
	loop.autoplay = false
	loop.controls = true
	loop.pause()
}

/*
 * The GIF gets the blunter treatment, because a GIF is blunter: it carries its
 * own clock, so there is no autoplay to withhold and no control to offer — the
 * only way to stop it is to not load it. Swapping the `src` for the still does
 * that, and it is the same frame at the same seed, so the figure still shows
 * what it claims to. Which is the honest argument for `--mp4`: everything this
 * script has to take away from the GIF, the video hands over.
 */
const gif = document.querySelector('img[data-gif]')

if (gif && reduced) {
	gif.src = gif.dataset.still
}
