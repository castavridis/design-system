/**
 * Read/write for `figma/sync.json` — the round trip's identity and memory.
 *
 * Two things live here that name-matching alone cannot provide:
 *
 *   variables  token path -> Figma variable id, so a rename on either side is a
 *              rename rather than a delete + create, and re-pushing updates in
 *              place instead of duplicating.
 *   lastSync   the values at the last agreed state — the base a three-way diff
 *              needs in order to say *who* moved rather than merely *that*
 *              something differs.
 *
 * Committed on purpose. Without it every sync starts blind.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import type { Preference, ValueMap } from './reconcile.js'

export interface SyncState {
	fileKey: string
	/** Page the components are pushed to. Variables are file-wide. */
	pageId: string
	/** Collection name -> Figma collection id. */
	collections: Record<string, string>
	/** Collection name -> the single mode's id. */
	modes: Record<string, string>
	/** Token path -> Figma variable id. */
	variables: Record<string, { id: string; collection: string }>
	/** Component-set name -> what was pushed. Written by the component milestones. */
	components?: Record<string, { id: string; contract?: string; [key: string]: unknown }>
	/**
	 * Pages assembled from those components — `demo/index.html` and, later,
	 * whatever else earns a Figma counterpart. The instance ids are what makes a
	 * re-push an update of the same page rather than a second copy of it.
	 */
	pages?: Record<
		string,
		{ pageId: string; frameId: string; instances: Array<{ path: string; component: string; id: string }> }
	>
	/** Per-scope resolution when both sides moved. */
	prefer: Record<string, Preference>
	/** Scopes the book computes; Figma edits to these are reported, never applied. */
	derived: string[]
	lastSync: { syncId: string; at: string; values: ValueMap } | null
}

export const STATE_PATH = resolve(process.cwd(), 'figma', 'sync.json')

export async function readState(path = STATE_PATH): Promise<SyncState> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as SyncState
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(`${path} not found. Create it with the target fileKey before syncing.`)
		}
		throw error
	}
}

export async function writeState(state: SyncState, path = STATE_PATH) {
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${JSON.stringify(state, null, '\t')}\n`, 'utf8')
}

/** `2026-07-31T09:20:14Z` -> `20260731T092014Z`, used to name a sync's report. */
export function syncId(now: Date) {
	return now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

export function reportPath(id: string) {
	return join(resolve(process.cwd(), 'figma', 'syncs'), `${id}.md`)
}
