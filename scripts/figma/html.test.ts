import assert from 'node:assert/strict'
import { test } from 'node:test'

import { children, classList, findClass, isElement, parse, rawText, text, type Element } from './html.js'

const only = (html: string) => parse(html).filter(isElement)[0] as Element

test('nests elements and keeps document order', () => {
	const el = only('<div><p>one</p><p>two</p></div>')
	assert.equal(el.tag, 'div')
	assert.deepEqual(children(el).map(text), ['one', 'two'])
})

test('reads quoted, single-quoted and bare attributes', () => {
	const el = only(`<a class="button button-primary" href='#x' hidden data-component=Button>go</a>`)
	assert.deepEqual(classList(el), ['button', 'button-primary'])
	assert.equal(el.attrs.href, '#x')
	assert.equal(el.attrs.hidden, '')
	assert.equal(el.attrs['data-component'], 'Button')
})

test('void and self-closing elements close themselves', () => {
	const el = only('<p>one<br />two<input type="range" />three</p>')
	assert.equal(text(el), 'onetwothree')
	assert.deepEqual(children(el).map((c) => c.tag), ['br', 'input'])
})

test('comments and the doctype are skipped', () => {
	const nodes = parse('<!doctype html><!-- a note --><p>body</p>')
	assert.deepEqual(nodes.filter(isElement).map((el) => el.tag), ['p'])
})

test('entities are decoded once, in text and in attributes', () => {
	const el = only('<code title="a &amp; b">&lt;p&gt; &amp;&amp; &#39;q&#39;</code>')
	assert.equal(text(el), "<p> && 'q'")
	assert.equal(el.attrs.title, 'a & b')
})

test('text collapses whitespace, rawText does not', () => {
	const el = only('<pre>  a\n  b  </pre>')
	assert.equal(text(el), 'a b')
	assert.equal(rawText(el), '  a\n  b  ')
})

test('script content is text, not markup', () => {
	const el = only('<script>if (a < b) { go() }</script>')
	assert.equal(rawText(el), 'if (a < b) { go() }')
})

test('finds a descendant by class', () => {
	const el = only('<section><div><span class="doc-code-lang">tsx</span></div></section>')
	assert.equal(text(findClass(el, 'doc-code-lang') ?? { text: '' }), 'tsx')
})

/* Recovery would mean guessing at a shape, and the guess would be pushed to Figma. */
test('malformed markup raises rather than recovering', () => {
	assert.throws(() => parse('<div><p>oops</div>'), /<\/div> closes <\/p>/)
	assert.throws(() => parse('<div><p>oops</p>'), /unclosed <div>/)
	assert.throws(() => parse('</p>'), /closes nothing/)
	assert.throws(() => parse('<!-- never ends'), /unterminated comment/)
})
