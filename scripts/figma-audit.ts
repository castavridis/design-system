/**
 * figma-audit — reports where Figma has drifted from the component contract.
 *
 * The snapshot is captured through `use_figma` (the MCP tools are agent-facing,
 * not callable from Node) and passed in as JSON. Everything after that is the
 * pure comparison in `figma/audit.ts`.
 *
 *   pnpm figma:audit <snapshot.json>
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { components } from '../src/components/contract.js'
import { audit, report, type FigmaComponent } from './figma/audit.js'

const path = process.argv[2]
if (!path) throw new Error('usage: pnpm figma:audit <snapshot.json>')

const snapshot = JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as {
	components: FigmaComponent[]
}

const findings = audit(components, snapshot.components)
console.log(report(findings))

/* Non-zero on drift, so this can gate a pipeline rather than only inform one. */
if (findings.length > 0) process.exitCode = 1
