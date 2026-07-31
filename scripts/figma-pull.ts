/**
 * figma-pull — reconciles a Figma snapshot against the design book.
 *
 * The MCP tools are agent-facing, so the snapshot arrives as JSON captured
 * through `use_figma`; everything after that is the tested three-way diff in
 * `figma/reconcile.ts`. Same split as the push: this file is policy and
 * reporting, not transport.
 *
 *   pnpm figma:pull <snapshot.json> [--prefer=code|figma] [--apply]
 *
 * Writes a report to `figma/syncs/<syncId>.md` and prints a summary. Without
 * `--apply` nothing is written to `src/` — the report is the deliverable and
 * the edits are proposals. Editing source is the one step worth making
 * deliberate, because it is the only one a person can't easily undo by
 * re-running the tool.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { nextBase, reconcile, summarise, type Entry, type Policy, type ValueMap } from './figma/reconcile.js'
import { readState, reportPath, syncId, writeState } from './figma/state.js'
import { hexToOklchString } from './figma/oklch.js'

interface Snapshot {
	/** Token path -> resolved sRGB hex, as Figma currently holds it. */
	variables: ValueMap
}

const flag = (name: string) => {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
	return hit ? hit.slice(name.length + 3) : undefined
}
const has = (name: string) => process.argv.includes(`--${name}`)

/** Resolved hex per token, following aliases — the same view the push writes. */
async function oursFromPlan(): Promise<ValueMap> {
	const planPath = resolve(process.cwd(), 'dist', 'figma-tokens.json')
	let raw: string
	try {
		raw = await readFile(planPath, 'utf8')
	} catch {
		/* `pnpm build` clears dist/, so this goes missing routinely. Say what to
		   run rather than surfacing a bare ENOENT. */
		throw new Error(`${planPath} not found. Run \`pnpm figma:emit\` first.`)
	}
	const plan = JSON.parse(raw) as { tokens: Array<{ key: string; value?: { hex?: string } | number | string; aliasOf?: string }> }

	const byKey = new Map(plan.tokens.map((t) => [t.key, t]))
	const seen = new Set<string>()

	const resolveKey = (key: string): string | undefined => {
		if (seen.has(key)) throw new Error(`alias cycle at ${key}`)
		const token = byKey.get(key)
		if (!token) return undefined
		if (token.aliasOf) {
			seen.add(key)
			const out = resolveKey(token.aliasOf)
			seen.delete(key)
			return out
		}
		const v = token.value
		if (v && typeof v === 'object' && 'hex' in v) return v.hex
		return String(v)
	}

	return Object.fromEntries(
		plan.tokens.map((t) => [t.key, resolveKey(t.key)]).filter(([, v]) => v !== undefined) as [string, string][],
	)
}

/**
 * The edit a Figma-side colour change implies, in the notation the book uses.
 *
 * Never a bare hex. `src/pmndrs-design-book.ts` is authored in OKLCH on purpose
 * — the README explains why — and the first pull that wrote `color('#00e180')`
 * would silently begin dismantling that, one token at a time, while looking
 * perfectly correct in every rendered artifact.
 */
function proposedEdit(key: string, hex: string) {
	const [scope, name] = key.split('.')
	if (!/^#[0-9a-f]{6}$/i.test(hex)) {
		return `${scope}.set('${name}', /* not a colour: ${hex} */)`
	}
	return `${scope}.set('${name}', color('${hexToOklchString(hex)}')) // ${hex.toUpperCase()}`
}

function renderReport(id: string, entries: Entry[], policy: Policy, applied: boolean) {
	const counts = summarise(entries)
	const lines = [
		`# Sync ${id}`,
		'',
		`Direction: Figma -> code. ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`,
		'',
		'| outcome | count |',
		'| --- | --- |',
		...Object.entries(counts).map(([k, n]) => `| ${k} | ${n} |`),
		'',
	]

	const section = (title: string, kinds: string[], body: (e: Entry) => string) => {
		const hits = entries.filter((e) => kinds.includes(e.verdict.kind))
		if (!hits.length) return
		lines.push(`## ${title}`, '')
		for (const e of hits) lines.push(`- ${body(e)}`)
		lines.push('')
	}

	section('Pulled from Figma', ['pull'], (e) => {
		const v = e.verdict as { kind: 'pull'; value: string }
		return `\`${e.key}\` -> \`${v.value}\`\n  \`\`\`ts\n  ${proposedEdit(e.key, v.value)}\n  \`\`\``
	})
	section('Resolved by policy', ['resolved'], (e) => {
		const v = e.verdict as { kind: 'resolved'; winner: string; ours: string; theirs: string }
		return `\`${e.key}\`: code \`${v.ours}\` vs Figma \`${v.theirs}\` — **${v.winner}** won`
	})
	section('Conflicts — need a decision', ['conflict'], (e) => {
		const v = e.verdict as { kind: 'conflict'; ours: string; theirs: string }
		return `\`${e.key}\`: code \`${v.ours}\` vs Figma \`${v.theirs}\``
	})
	section('Derived drift — reported, never applied', ['derived-drift'], (e) => {
		const v = e.verdict as { kind: 'derived-drift'; ours: string; theirs: string }
		return `\`${e.key}\`: Figma has \`${v.theirs}\`, the book computes \`${v.ours}\`. Edit the seed, not the step.`
	})
	section('Only in the book', ['create'], (e) => `\`${e.key}\` — push to create it`)
	section('Only in Figma', ['orphan'], (e) => `\`${e.key}\` — added there; add it to the book or delete it`)

	lines.push(
		'',
		`Scope policy: ${JSON.stringify(policy.override ?? policy.prefer)}.`,
		applied ? 'Edits were applied to `src/`.' : 'No files were changed. Re-run with `--apply` to write the edits above.',
		'',
	)
	return lines.join('\n')
}

async function main() {
	const path = process.argv[2]
	if (!path || path.startsWith('--')) throw new Error('usage: pnpm figma:pull <snapshot.json> [--prefer=code|figma] [--apply]')

	const state = await readState()
	const snapshot = JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as Snapshot
	const ours = await oursFromPlan()

	const override = flag('prefer') as 'code' | 'figma' | undefined
	if (override && override !== 'code' && override !== 'figma') {
		throw new Error(`--prefer must be code or figma, received "${override}"`)
	}

	const policy: Policy = {
		prefer: state.prefer,
		derived: state.derived,
		...(override ? { override } : {}),
	}

	const entries = reconcile(state.lastSync?.values ?? {}, ours, snapshot.variables, policy)
	const id = syncId(new Date())
	const apply = has('apply')

	const report = renderReport(id, entries, policy, apply)
	const out = reportPath(id)
	await mkdir(dirname(out), { recursive: true })
	await writeFile(out, report, 'utf8')

	/*
	 * The base advances only for what actually settled, and only once the edits
	 * are real. Advancing it on a dry run would mark changes as agreed that were
	 * never applied, and the next sync would never mention them again.
	 */
	if (apply) {
		state.lastSync = {
			syncId: id,
			at: new Date().toISOString(),
			values: nextBase(state.lastSync?.values ?? {}, entries),
		}
		await writeState(state)
	}

	const counts = summarise(entries)
	console.log(`figma-pull: ${entries.length} entries -> ${out}`)
	for (const [kind, n] of Object.entries(counts)) console.log(`  ${kind}: ${n}`)
	if (!entries.length) console.log('  no drift')
	if (!apply && entries.length) console.log('\nDry run. Re-run with --apply to write the edits and advance the base.')

	/* A conflict is the one outcome a human has to resolve. */
	if (entries.some((e) => e.verdict.kind === 'conflict')) process.exitCode = 1
}

await main()
