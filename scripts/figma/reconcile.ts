/**
 * Three-way reconciliation between the design book and a Figma file.
 *
 * Pure functions over three plain maps of `tokenPath -> hex`:
 *
 *   base   the values at the last successful sync (`sync.json.lastSync.values`)
 *   ours   what the design book renders right now
 *   theirs what the Figma file currently holds
 *
 * A two-way diff can only say *that* two sides differ; with a base we can say
 * *who moved*, which is the difference between a tool that asks about every
 * discrepancy forever and one that only asks about genuine conflicts.
 *
 * Nothing here talks to Figma or touches the filesystem — the transport lives in
 * `figma-push.ts` / `figma-pull.ts`, so this stays testable offline.
 */

/** A resolved sRGB hex, the one representation both sides agree on. */
export type Hex = string

export type ValueMap = Record<string, Hex>

/** Which side to believe when both moved. */
export type Preference = 'ask' | 'code' | 'figma'

export interface Policy {
	/**
	 * Per-scope preference, keyed by the token path's first segment
	 * (`brand`, `fonts`, `ramp`). Anything unlisted defaults to `ask`.
	 */
	prefer: Record<string, Preference>
	/**
	 * Scopes the design book computes rather than authors. A Figma edit to one of
	 * these can't be expressed in `src/` and would be overwritten by the next
	 * build, so it is reported and never applied.
	 */
	derived: readonly string[]
	/** Overrides every `prefer` entry. Set from `--prefer=code|figma`. */
	override?: Exclude<Preference, 'ask'>
}

export type Verdict =
	/** Neither side moved. */
	| { kind: 'unchanged' }
	/** Only the design book moved — push it. */
	| { kind: 'push'; value: Hex }
	/** Only Figma moved — pull it into `src/`. */
	| { kind: 'pull'; value: Hex }
	/** Both moved, and policy picked a winner. */
	| { kind: 'resolved'; winner: 'code' | 'figma'; value: Hex; ours: Hex; theirs: Hex }
	/** Both moved and no policy applies — a human decides. */
	| { kind: 'conflict'; ours: Hex; theirs: Hex }
	/** In the book, absent from Figma — create it. */
	| { kind: 'create'; value: Hex }
	/** In Figma, absent from the book — someone added it there. */
	| { kind: 'orphan'; value: Hex }
	/** Figma moved a token the book computes. Reported, never applied. */
	| { kind: 'derived-drift'; ours: Hex; theirs: Hex }

export interface Entry {
	key: string
	verdict: Verdict
}

/** Hex comparison is case- and whitespace-insensitive; nothing else is. */
function same(a: Hex | undefined, b: Hex | undefined) {
	if (a === undefined || b === undefined) return false
	return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function scopeOf(key: string) {
	const dot = key.indexOf('.')
	return dot === -1 ? key : key.slice(0, dot)
}

function classify(key: string, base: ValueMap, ours: ValueMap, theirs: ValueMap, policy: Policy): Verdict {
	const b = base[key]
	const o = ours[key]
	const t = theirs[key]

	if (o === undefined && t === undefined) return { kind: 'unchanged' }
	if (o === undefined) return { kind: 'orphan', value: t as Hex }
	if (t === undefined) return { kind: 'create', value: o }

	const oursMoved = !same(o, b)
	const theirsMoved = !same(t, b)

	/*
	 * No base yet — first sync for this token, or it predates the state file.
	 * We genuinely cannot tell who moved, so agreement is fine and disagreement
	 * is a conflict rather than a guess.
	 */
	if (b === undefined) {
		return same(o, t) ? { kind: 'unchanged' } : { kind: 'conflict', ours: o, theirs: t }
	}

	if (!oursMoved && !theirsMoved) return { kind: 'unchanged' }
	if (oursMoved && !theirsMoved) return { kind: 'push', value: o }

	/* Figma moved something the book computes: report, never apply. */
	if (policy.derived.includes(scopeOf(key))) {
		return { kind: 'derived-drift', ours: o, theirs: t }
	}

	if (!oursMoved && theirsMoved) return { kind: 'pull', value: t }

	/* Both moved. */
	const preference = policy.override ?? policy.prefer[scopeOf(key)] ?? 'ask'
	if (preference === 'ask') return { kind: 'conflict', ours: o, theirs: t }

	return {
		kind: 'resolved',
		winner: preference,
		value: preference === 'code' ? o : t,
		ours: o,
		theirs: t,
	}
}

export function reconcile(base: ValueMap, ours: ValueMap, theirs: ValueMap, policy: Policy): Entry[] {
	const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base)])].sort()

	return keys
		.map((key) => ({ key, verdict: classify(key, base, ours, theirs, policy) }))
		.filter((entry) => entry.verdict.kind !== 'unchanged')
}

/**
 * The base for the *next* sync.
 *
 * This is the subtle, load-bearing part. If the base only advanced on pull, then
 * pushing a code-side edit would leave the base holding the pre-push value —
 * and the next sync would see both sides differing from it and report a **false
 * conflict**. Every settled token advances the base, whichever direction it
 * travelled; only genuine conflicts and derived drift are left alone, because
 * nothing was agreed.
 *
 * Call this *after* the push has actually landed, never before.
 */
export function nextBase(base: ValueMap, entries: Entry[]): ValueMap {
	const next: ValueMap = { ...base }

	for (const { key, verdict } of entries) {
		switch (verdict.kind) {
			case 'push':
			case 'pull':
			case 'create':
			case 'resolved':
				next[key] = verdict.value
				break
			case 'orphan':
				/* Not ours to track — it has no counterpart in the book. */
				delete next[key]
				break
			case 'conflict':
			case 'derived-drift':
				/* Unsettled: leave the base where it was so it surfaces again. */
				break
		}
	}

	return next
}

/** Groups entries by verdict for reporting. */
export function summarise(entries: Entry[]) {
	const counts: Record<string, number> = {}
	for (const { verdict } of entries) counts[verdict.kind] = (counts[verdict.kind] ?? 0) + 1
	return counts
}
