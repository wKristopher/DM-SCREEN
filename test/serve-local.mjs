/**
 * Local stand-in for Vercel's routing, so the auth gate can be exercised
 * end-to-end before it ships: edge middleware first, then /api/*, then static.
 *
 * Not part of the app — this exists purely so `test/gate.test.mjs` can drive a
 * real browser against the real middleware and login handler.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'


// Overridable because the bundled copy of this file runs from the repo root
// rather than from test/.
const DIST = process.env.DIST_DIR ?? 'dist'

import middleware from '../middleware.ts'
import login from '../api/login.ts'
import logout from '../api/logout.ts'
import { useTestAccount } from './gate-account.mjs'

// lib/auth reads the environment lazily, so this lands before the first
// request even though the imports above are hoisted.
useTestAccount()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

/** Mirrors the `matcher` in middleware.ts. */
function isPublic(pathname) {
  return (
    pathname === '/login' ||
    pathname === '/login.html' ||
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
    pathname.startsWith('/favicon')
  )
}

async function toNodeResponse(webRes, res) {
  res.statusCode = webRes.status
  for (const [k, v] of webRes.headers) res.setHeader(k, v)
  const body = webRes.body ? Buffer.from(await webRes.arrayBuffer()) : null
  res.end(body)
}

function toWebRequest(req, body) {
  const url = `http://${req.headers.host}${req.url}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  return new Request(url, {
    method: req.method,
    headers,
    body: body && body.length ? body : undefined,
  })
}

const server = createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks)
  const request = toWebRequest(req, body)
  const { pathname } = new URL(request.url)

  try {
    if (!isPublic(pathname)) {
      const gate = await middleware(request)
      // `next()` returns a 200 with the x-middleware-next marker; anything else
      // (redirect, 401) is the middleware short-circuiting the request.
      if (!gate.headers.get('x-middleware-next')) return toNodeResponse(gate, res)
    }

    if (pathname === '/api/login') return toNodeResponse(await login(request), res)
    if (pathname === '/api/logout') return toNodeResponse(await logout(request), res)

    // `cleanUrls` in vercel.json makes /login serve login.html.
    let file = pathname === '/login' ? '/login.html' : pathname
    if (file === '/' || !extname(file)) file = '/index.html'

    const data = await readFile(join(DIST, file))
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
})

const port = Number(process.env.PORT ?? 4180)
server.listen(port, () => console.log(`gate server on http://localhost:${port}`))
