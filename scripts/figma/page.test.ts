import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { components } from '../../src/components/contract.js'
import { extractPage, instancesOf, paths, ranges, type Block } from './page.js'

/** A page with the same shape as the demo, small enough to read in one go. */
const page = (body: string) => `<!doctype html>
<html lang="en"><head><title>t</title></head><body>
<header class="hero">
  <p class="eyebrow">design tokens</p>
  <h1>Define once.<br />Ship everywhere.</h1>
  <p class="lede">Lede.</p>
  <div class="hero-actions">
    <a class="button button-primary" href="#a" data-component="Button">See the palette</a>
    <a class="button" href="#b" data-component="Button">Ramps</a>
  </div>
</header>
<main><section id="components"><h2>Components</h2>
  <p class="section-note">A note.</p>
  <div class="waterfall">
    <h3 class="wf-group">Callouts</h3>
    ${body}
  </div>
</section></main>
<footer><p>12 tokens</p></footer>
</body></html>`

const spec = (body: string) => extractPage(page(body), { source: 'test.html' })

const kinds = (blocks: Block[]): string[] => blocks.flatMap((b) => [b.kind, ...('children' in b ? kinds(b.children) : [])])

test('the page skeleton survives: hero, sections, groups, specs, footer', () => {
	const out = spec(`<article class="spec">
	  <header class="spec-head"><h4><code>Nav</code></h4><p>Sidebar.</p></header>
	  <div class="spec-stage"><nav class="doc-nav"></nav></div>
	</article>`)

	assert.equal(out.title, 't')
	assert.ok(kinds(out.blocks).includes('hero'))
	assert.ok(kinds(out.blocks).includes('group'))
	assert.ok(kinds(out.blocks).includes('footer'))

	const hero = out.blocks[0] as Extract<Block, { kind: 'hero' }>
	assert.deepEqual(hero.heading, ['Define once.', 'Ship everywhere.'])
	assert.equal(hero.eyebrow, 'design tokens')
})

test('a custom element becomes an instance with its declared variant', () => {
	const out = spec(`<article class="spec">
	  <header class="spec-head"><h4><code>Gha</code></h4><p>Alerts.</p></header>
	  <div class="spec-stage"><pmndrs-gha keyword="WARNING">Careful.</pmndrs-gha></div>
	</article>`)

	assert.deepEqual(instancesOf(out), [
		{ kind: 'instance', name: 'pmndrs-button', component: 'Button', props: { variant: 'default', disabled: false }, text: { label: 'See the palette' } },
		{ kind: 'instance', name: 'pmndrs-button', component: 'Button', props: { variant: 'secondary', disabled: false }, text: { label: 'Ramps' } },
		{ kind: 'instance', name: 'pmndrs-gha', component: 'Gha', props: { keyword: 'WARNING' }, text: { body: 'Careful.' } },
	])
})

test('an omitted variant takes the contract default, and a title becomes an override', () => {
	const out = spec(`<article class="spec"><header class="spec-head"><h4>Gha</h4><p>x</p></header>
	  <div class="spec-stage">
	    <pmndrs-gha>Plain.</pmndrs-gha>
	    <pmndrs-gha keyword="TIP" title="MCP-server">Titled.</pmndrs-gha>
	  </div></article>`)

	const [, , plain, titled] = instancesOf(out)
	assert.deepEqual(plain?.props, { keyword: 'NOTE' })
	assert.deepEqual(plain?.text, { body: 'Plain.' })
	assert.deepEqual(titled?.props, { keyword: 'TIP', title: 'MCP-server' })
	assert.deepEqual(titled?.text, { body: 'Titled.', title: 'MCP-server' })
})

test('a marked link is a Button, and its variant comes from the class it already has', () => {
	const out = spec('')
	const [primary, secondary] = instancesOf(out)
	assert.equal(primary?.props.variant, 'default')
	assert.equal(secondary?.props.variant, 'secondary')
})

test("Code's props are read out of the markup, not restated in an attribute", () => {
	const out = spec(`<article class="spec"><header class="spec-head"><h4>Code</h4><p>x</p></header>
	  <div class="spec-stage">
	    <figure class="doc-code-block" data-component="Code">
	      <figcaption><span class="doc-code-lang">tsx</span></figcaption>
	      <pre class="doc-code doc-code-numbered" style="counter-reset: line 149"><code><span class="ln is-hl">a</span>
<span class="ln">b</span>
<span class="ln is-hl">c</span>
<span class="ln is-hl">d</span></code></pre>
	    </figure>
	  </div></article>`)

	const code = instancesOf(out).find((i) => i.component === 'Code')
	assert.deepEqual(code?.props, { lang: 'tsx', showLineNumbers: 150, highlight: '1,3-4' })
	assert.equal(code?.gutterStart, 150)
})

test('a wrapper around instances stays a container, not one stand-in', () => {
	const out = spec(`<article class="spec"><header class="spec-head"><h4>Badges</h4><p>x</p></header>
	  <div class="spec-stage"><div class="doc-badges">
	    <pmndrs-badge ramp="teal"></pmndrs-badge>
	    <pmndrs-badge ramp="red">custom</pmndrs-badge>
	  </div></div></article>`)

	const badges = instancesOf(out).filter((i) => i.component === 'Badge')
	assert.deepEqual(badges.map((b) => b.props.ramp), ['teal', 'red'])
	/* An empty badge labels itself with its ramp, exactly as `elements.js` does. */
	assert.deepEqual(badges.map((b) => b.text?.label), ['teal', 'custom'])
	assert.ok(!kinds(out.blocks).includes('standin'))
})

test('markup with no contract component becomes a labelled stand-in', () => {
	const out = spec(`<article class="spec"><header class="spec-head"><h4>Search</h4><p>x</p></header>
	  <div class="spec-stage"><div class="doc-search"><span>q</span></div></div></article>`)

	const standin = paths(out.blocks).find(({ block }) => block.kind === 'standin')
	assert.equal(standin?.path.endsWith('standin:doc-search'), true)
})

test('a spec tag is read as a status, not as part of the name', () => {
	const out = spec(`<article class="spec">
	  <header class="spec-head"><h4><code>Hint</code> <span class="spec-tag">deprecated</span></h4><p>x</p></header>
	  <div class="spec-stage"><div class="doc-hint"></div></div></article>`)

	const found = paths(out.blocks).find(({ block }) => block.kind === 'spec')
	assert.equal((found?.block as Extract<Block, { kind: 'spec' }>).label, 'Hint')
	assert.equal((found?.block as Extract<Block, { kind: 'spec' }>).tag, 'deprecated')
})

test('addresses are unique among siblings and readable', () => {
	const out = spec(`<article class="spec"><header class="spec-head"><h4>Gha</h4><p>x</p></header>
	  <div class="spec-stage"><pmndrs-gha keyword="NOTE">a</pmndrs-gha><pmndrs-gha keyword="TIP">b</pmndrs-gha></div>
	</article>`)

	const found = paths(out.blocks).map(({ path }) => path)
	assert.ok(found.includes('section#components > waterfall > group:Callouts > spec:Gha > stage > Gha'))
	assert.ok(found.includes('section#components > waterfall > group:Callouts > spec:Gha > stage > Gha#2'))
	assert.equal(new Set(found).size, found.length)
})

/* The same rule `elements.js` enforces at runtime, enforced before a push. */
test('a variant the contract does not declare stops the extraction', () => {
	assert.throws(
		() => spec('<article class="spec"><header class="spec-head"><h4>x</h4><p>x</p></header><div class="spec-stage"><pmndrs-gha keyword="FYI">no</pmndrs-gha></div></article>'),
		/is not a legal variant/,
	)
})

test('a marker naming no contract component stops the extraction', () => {
	assert.throws(
		() => spec('<article class="spec"><header class="spec-head"><h4>x</h4><p>x</p></header><div class="spec-stage"><div data-component="Carousel"></div></div></article>'),
		/names no contract component/,
	)
})

test('a Button class that matches no variant stops the extraction', () => {
	assert.throws(
		() => extractPage(page('').replace('class="button button-primary"', 'class="button button-huge"')),
		/matches no Button variant/,
	)
})

test('line numbers collapse into fence ranges', () => {
	assert.equal(ranges([1, 4, 5, 6]), '1,4-6')
	assert.equal(ranges([2]), '2')
	assert.equal(ranges([]), '')
})

/* The real page is the fixture that matters: it is what actually gets pushed. */
test('demo/index.html extracts every contract component the page renders', async () => {
	const html = await readFile(new URL('../../demo/index.html', import.meta.url), 'utf8')
	const out = extractPage(html)
	const used = new Set(instancesOf(out).map((i) => i.component))

	assert.deepEqual([...used].sort(), ['Badge', 'Button', 'Code', 'Gha', 'Header'])
	assert.equal(used.size, components.length, 'every contract component appears on the page')
	assert.equal(
		instancesOf(out).every((i) => i.component && Object.keys(i.props).length >= 0),
		true,
	)
})
