import assert from 'node:assert/strict'
import { test } from 'node:test'

import { auditPage, type PageSnapshot, type SnapshotItem } from './page-audit.js'
import { extractPage, paths } from './page.js'

const html = `<!doctype html>
<html><head><title>t</title></head><body>
<header class="hero">
  <p class="eyebrow">e</p><h1>H</h1><p class="lede">l</p>
  <div class="hero-actions"><a class="button button-primary" href="#a" data-component="Button">Go</a></div>
</header>
<main><section id="components"><h2>Components</h2>
  <div class="waterfall"><h3 class="wf-group">Callouts</h3>
    <article class="spec"><header class="spec-head"><h4>Gha</h4><p>d</p></header>
      <div class="spec-stage">
        <pmndrs-gha keyword="NOTE">a</pmndrs-gha>
        <div class="doc-search"></div>
      </div>
    </article>
  </div>
</section></main>
</body></html>`

const spec = extractPage(html, { source: 'test.html' })

const GHA = 'section#components > waterfall > group:Callouts > spec:Gha > stage > Gha'

/** The snapshot a faithful push produces: every address, right kind, right variant. */
function faithful(): PageSnapshot {
	const items: SnapshotItem[] = paths(spec.blocks).map(({ path, block }) =>
		block.kind === 'instance'
			? {
					path,
					kind: 'instance',
					component: block.component,
					props: Object.fromEntries(
						Object.entries(block.props).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v)]),
					),
				}
			: { path, kind: 'frame' },
	)
	return { page: { frame: 'demo/index.html', items } }
}

test('a faithful page reports nothing', () => {
	assert.deepEqual(auditPage(spec, faithful()), [])
})

test('a page that was never pushed says so, once', () => {
	assert.deepEqual(auditPage(spec, { page: null }), [{ kind: 'page-missing' }])
})

test('a detached instance is reported even though it still looks right', () => {
	const snapshot = faithful()
	const gha = snapshot.page!.items.find((i) => i.path === GHA)!
	/* What detaching looks like from the outside: same name, no longer an instance. */
	snapshot.page!.items[snapshot.page!.items.indexOf(gha)] = { path: GHA, kind: 'frame' }

	assert.deepEqual(auditPage(spec, snapshot), [{ kind: 'detached-instance', path: GHA, component: 'Gha' }])
})

test('a variant swapped in Figma is reported with both sides', () => {
	const snapshot = faithful()
	const gha = snapshot.page!.items.find((i) => i.path === GHA)!
	gha.props = { keyword: 'CAUTION' }

	assert.deepEqual(auditPage(spec, snapshot), [
		{ kind: 'wrong-variant', path: GHA, component: 'Gha', prop: 'keyword', expected: 'NOTE', found: 'CAUTION' },
	])
})

test('the wrong component at the right address is not a variant problem', () => {
	const snapshot = faithful()
	const gha = snapshot.page!.items.find((i) => i.path === GHA)!
	gha.component = 'Badge'
	gha.props = { ramp: 'red' }

	assert.deepEqual(auditPage(spec, snapshot), [
		{ kind: 'wrong-component', path: GHA, expected: 'Gha', found: 'Badge' },
	])
})

test('a deleted block and an added one are both reported, at their addresses', () => {
	const snapshot = faithful()
	snapshot.page!.items = snapshot.page!.items.filter((i) => i.path !== GHA)
	snapshot.page!.items.push({ path: 'section#components > standin:doc-invented', kind: 'frame' })

	assert.deepEqual(auditPage(spec, snapshot), [
		{ kind: 'block-missing', path: GHA, expected: 'instance' },
		{ kind: 'block-extra', path: 'section#components > standin:doc-invented', found: 'frame' },
	])
})

/* A component's own layers, and a swatch grid's cells, have no page counterpart. */
test('nodes inside a block the generator owns are not drift', () => {
	const snapshot = faithful()
	snapshot.page!.items.push(
		{ path: `${GHA} > label`, kind: 'frame' },
		{ path: `${GHA} > body`, kind: 'text' },
		{ path: 'section#components > waterfall > group:Callouts > spec:Gha > head', kind: 'frame' },
	)

	assert.deepEqual(auditPage(spec, snapshot), [])
})

/*
 * showLineNumbers is a real prop of the code component and deliberately not a
 * Figma variant axis. Reporting it would mean every Code instance drifts
 * forever, which is how an audit becomes noise people filter out.
 */
test('props Figma cannot model as variants are not compared', () => {
	const codeHtml = html.replace(
		'<pmndrs-gha keyword="NOTE">a</pmndrs-gha>',
		'<figure class="doc-code-block" data-component="Code"><figcaption><span class="doc-code-lang">tsx</span></figcaption>' +
			'<pre class="doc-code doc-code-numbered" style="counter-reset: line 149"><code><span class="ln">a</span></code></pre></figure>',
	)
	const codeSpec = extractPage(codeHtml, { source: 'test.html' })
	const items: SnapshotItem[] = paths(codeSpec.blocks).map(({ path, block }) =>
		block.kind === 'instance'
			? {
					path,
					kind: 'instance',
					component: block.component,
					props:
						block.component === 'Code'
							? ({ type: 'tsx' } as Record<string, string>)
							: ({ variant: 'default', disabled: 'False' } as Record<string, string>),
				}
			: { path, kind: 'frame' },
	)

	assert.deepEqual(auditPage(codeSpec, { page: { frame: 'demo/index.html', items } }), [])
})
