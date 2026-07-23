/**
 * Minimal static file server for the demo page — no dependencies.
 *
 * Serves the repo root so `/demo/index.html` can reference the real build
 * artifacts at `/dist/...`, exactly as a consuming app would.
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env['PORT'] ?? 5173)

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
	const requested = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
	const relative = normalize(requested === '/' ? '/demo/index.html' : requested).replace(
		/^(\.\.[/\\])+/,
		'',
	)
	let filePath = join(root, relative)

	// Never serve outside the repo, whatever the request path claims.
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
