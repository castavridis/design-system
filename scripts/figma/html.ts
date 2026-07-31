/**
 * A very small HTML reader — enough to walk `demo/index.html`, and nothing more.
 *
 * The root package is deliberately dependency-light (`design-book`, `tsx`,
 * `typescript`), so pulling in a parser to read one file we author ourselves
 * would be the largest dependency in the repo by an order of magnitude. What
 * follows handles the subset this page actually uses: quoted attributes, void
 * and self-closing elements, comments, raw-text `<script>`/`<style>`, and the
 * five entities the page escapes.
 *
 * It is not a spec-compliant parser and doesn't pretend to be. Malformed input
 * raises rather than recovering — an unclosed tag in the demo should stop the
 * push, not silently reshape the Figma page.
 */

export interface Element {
	tag: string
	attrs: Record<string, string>
	children: Node[]
}

export type Node = Element | { text: string }

export const isElement = (node: Node): node is Element => 'tag' in node

/** Elements that never have children, so they close themselves. */
const VOID = new Set([
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
	'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** Elements whose content is text, not markup. */
const RAW_TEXT = new Set(['script', 'style'])

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	mdash: '—',
	ndash: '–',
	hellip: '…',
}

export function decodeEntities(input: string) {
	return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
		if (body.startsWith('#')) {
			const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
			return Number.isFinite(code) ? String.fromCodePoint(code) : whole
		}
		return ENTITIES[body.toLowerCase()] ?? whole
	})
}

/** `class="a b"` -> `['a', 'b']`. */
export const classList = (el: Element) => (el.attrs.class ?? '').split(/\s+/).filter(Boolean)

export const hasClass = (el: Element, name: string) => classList(el).includes(name)

/**
 * Text content with runs of whitespace collapsed — how the browser lays a
 * paragraph out, and therefore what belongs in a Figma text node.
 */
export function text(node: Node): string {
	return rawText(node).replace(/\s+/g, ' ').trim()
}

/** Text content exactly as authored. `<pre>` needs this; prose does not. */
export function rawText(node: Node): string {
	if (!isElement(node)) return node.text
	return node.children.map(rawText).join('')
}

/** Direct element children, in document order. */
export const children = (el: Element) => el.children.filter(isElement)

export function findAll(node: Node, predicate: (el: Element) => boolean): Element[] {
	const out: Element[] = []
	const walk = (n: Node) => {
		if (!isElement(n)) return
		if (predicate(n)) out.push(n)
		for (const child of n.children) walk(child)
	}
	walk(node)
	return out
}

export const find = (node: Node, predicate: (el: Element) => boolean) => findAll(node, predicate)[0]

/** First descendant with this tag. */
export const findTag = (node: Node, tag: string) => find(node, (el) => el.tag === tag)

/** First descendant carrying this class. */
export const findClass = (node: Node, name: string) => find(node, (el) => hasClass(el, name))

const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttrs(source: string) {
	const attrs: Record<string, string> = {}
	for (const match of source.matchAll(ATTR)) {
		const [, name, doubled, singled, bare] = match
		if (!name) continue
		attrs[name.toLowerCase()] = decodeEntities(doubled ?? singled ?? bare ?? '')
	}
	return attrs
}

/**
 * Parses a document into a tree of elements and text.
 *
 * Returns the root's children rather than a single root, because the input is a
 * whole document — doctype, `<html>`, and the whitespace between them.
 */
export function parse(html: string): Node[] {
	const root: Element = { tag: '#root', attrs: {}, children: [] }
	const stack: Element[] = [root]
	const top = () => stack[stack.length - 1] as Element

	let i = 0
	while (i < html.length) {
		const next = html.indexOf('<', i)

		if (next === -1) {
			pushText(html.slice(i))
			break
		}
		if (next > i) pushText(html.slice(i, next))

		/* Comments and the doctype carry nothing this reader needs. */
		if (html.startsWith('<!--', next)) {
			const end = html.indexOf('-->', next)
			if (end === -1) throw new Error('unterminated comment')
			i = end + 3
			continue
		}
		if (html.startsWith('<!', next)) {
			const end = html.indexOf('>', next)
			if (end === -1) throw new Error('unterminated declaration')
			i = end + 1
			continue
		}

		if (html.startsWith('</', next)) {
			const end = html.indexOf('>', next)
			if (end === -1) throw new Error('unterminated close tag')
			const tag = html.slice(next + 2, end).trim().toLowerCase()

			/*
			 * Strict: the close tag must match the element it closes. HTML would
			 * let `</div>` imply the `<p>` above it, but this page is authored and
			 * formatted, so an implied close is a typo — and a typo that reshapes
			 * a tree here becomes a reshaped Figma page nobody diffed.
			 */
			const open = top()
			if (open.tag !== tag) {
				const expected = stack.length > 1 ? `</${open.tag}>` : 'nothing'
				throw new Error(`</${tag}> closes ${expected}`)
			}
			stack.pop()
			i = end + 1
			continue
		}

		const end = html.indexOf('>', next)
		if (end === -1) throw new Error('unterminated open tag')

		let source = html.slice(next + 1, end)
		const selfClosing = source.endsWith('/')
		if (selfClosing) source = source.slice(0, -1)

		const space = source.search(/\s/)
		const tag = (space === -1 ? source : source.slice(0, space)).toLowerCase()
		const attrs = space === -1 ? {} : parseAttrs(source.slice(space))

		const el: Element = { tag, attrs, children: [] }
		top().children.push(el)
		i = end + 1

		if (selfClosing || VOID.has(tag)) continue

		if (RAW_TEXT.has(tag)) {
			const close = html.indexOf(`</${tag}`, i)
			if (close === -1) throw new Error(`unterminated <${tag}>`)
			if (close > i) el.children.push({ text: html.slice(i, close) })
			i = html.indexOf('>', close) + 1
			continue
		}

		stack.push(el)
	}

	if (stack.length !== 1) throw new Error(`unclosed <${top().tag}>`)
	return root.children

	function pushText(chunk: string) {
		if (chunk) top().children.push({ text: decodeEntities(chunk) })
	}
}
