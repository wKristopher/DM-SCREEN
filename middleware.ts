/**
 * Edge gate.
 *
 * Runs before anything is served. Without a valid session cookie a visitor
 * gets the login page and nothing else — not the HTML shell, not the JS
 * bundle, not the CSS. That is the difference between this and a login screen
 * drawn in React: there, the whole app has already been downloaded and the
 * check is a formality anyone can skip.
 */

import { next } from '@vercel/edge'
import { COOKIE_NAME, readCookie, verifyToken } from './lib/auth'

export const config = {
  // Everything except the login page, the auth endpoints, and the favicon —
  // those have to stay reachable or there is no way in.
  matcher: '/((?!api/login|api/logout|login|favicon).*)',
}

export default async function middleware(request: Request): Promise<Response> {
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME)

  if (await verifyToken(token)) return next()

  const url = new URL(request.url)

  // An expired session during a fetch should read as 401 to the caller rather
  // than as a redirect to an HTML page it cannot parse.
  if (request.headers.get('accept')?.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const login = new URL('/login', url.origin)
  // Remember where they were headed so login can send them back.
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search)

  return Response.redirect(login, 302)
}
