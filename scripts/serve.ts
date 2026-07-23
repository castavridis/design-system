/**
 * Minimal static file server — no dependencies.
 *
 * With no argument it serves the repo root, so `/demo/index.html` can
 * reference the real build artifacts at `/dist/...` while you edit them in
 * place. Pass a directory to serve that instead — `serve.ts public` previews
 * the assembled site exactly as a static host will serve it.
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = process.argv[2] ? resolve(repoRoot, process.argv[2]) : repoRoot
const port = Number(process.env['PORT'] ?? 5173)

/**
 * Where `/` lands. The repo keeps the page at `/demo/index.html`; an
 * assembled site has it at the root, where `index.html` resolution finds it.
 */
const indexPath = root === repoRoot ? '/demo/index.html' : '/index.html'

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
	const requested = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
	const relative = normalize(requested === '/' ? indexPath : requested).replace(
		/^(\.\.[/\\])+/,
		'',
	)
	let filePath = join(root, relative)

	// Never serve outside the served root, whatever the request path claims.
	if (filePath !== root && !filePath.startsWith(root + sep)) {
		res.writeHead(403).end('Forbidden')
		return
	}

	try {
		let info = await stat(filePath)
		if (info.isDirectory()) {
			filePath = join(filePath, 'index.html')
			info = await stat(filePath)
		}

		res.writeHead(200, {
			'content-type': types[extname(filePath)] ?? 'application/octet-stream',
			'content-length': info.size,
			'cache-control': 'no-store',
		})
		createReadStream(filePath).pipe(res)
	} catch {
		res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
	}
})

server.listen(port, () => {
	console.log(`demo running at http://localhost:${port}/`)
})
