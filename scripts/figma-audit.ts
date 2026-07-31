/**
 * figma-audit — reports where Figma has drifted from the code.
 *
 * Two comparisons, one command, because they answer halves of the same
 * question. `components` asks whether each component still binds the tokens the
 * contract declares; `page` asks whether `demo/index.html` is still composed of
 * those components in the order the page composes them. A snapshot may carry
 * either or both.
 *
 * The snapshot is captured through `use_figma` (the MCP tools are agent-facing,
 * not callable from Node) and passed in as JSON. Everything after that is the
 * pure comparison in `figma/audit.ts` and `figma/page-audit.ts`.
 *
 *   pnpm figma:audit <snapshot.json>
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { components } from '../src/components/contract.js'
import { audit, report, type FigmaComponent } from './figma/audit.js'
import { auditPage, reportPage, type PageSnapshot } from './figma/page-audit.js'
import { extractPage } from './figma/page.js'

const path = process.argv[2]
if (!path) throw new Error('usage: pnpm figma:audit <snapshot.json>')

const snapshot = JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as {
	components?: FigmaComponent[]
	page?: PageSnapshot['page']
}

if (!snapshot.components && !snapshot.page) {
	throw new Error(`${path} has neither "components" nor "page" — nothing to audit`)
}

let drifted = 0

if (snapshot.components) {
	const findings = audit(components, snapshot.components)
	console.log(report(findings))
	drifted += findings.length
}

if (snapshot.page) {
	const source = 'demo/index.html'
	const spec = extractPage(await readFile(resolve(process.cwd(), source), 'utf8'), { source })
	const findings = auditPage(spec, { page: snapshot.page })
	console.log(reportPage(findings))
	drifted += findings.length
}

/* Non-zero on drift, so this can gate a pipeline rather than only inform one. */
if (drifted > 0) process.exitCode = 1
