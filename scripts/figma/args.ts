/**
 * Command-line flags, read the same way by every script in the round trip.
 *
 * Both spellings work — `--record=out.json` and `--record out.json` — because
 * the usage lines have always shown the second and the parsers only accepted
 * the first, which fails by doing nothing at all rather than by complaining.
 */

export function flag(name: string, argv = process.argv) {
	const equals = argv.find((a) => a.startsWith(`--${name}=`))
	if (equals) return equals.slice(name.length + 3)

	const at = argv.indexOf(`--${name}`)
	const next = at === -1 ? undefined : argv[at + 1]
	return next && !next.startsWith('--') ? next : undefined
}

/** A flag with no value: `--apply`, `--snapshot`. */
export const has = (name: string, argv = process.argv) => argv.includes(`--${name}`)
