/** Clears the session cookie and sends the browser back to the login page. */

import { clearCookie } from '../lib/auth'

export const config = { runtime: 'edge' }

export default function handler(request: Request): Response {
  const origin = new URL(request.url).origin
  return new Response(null, {
    status: 302,
    headers: {
      location: `${origin}/login`,
      'set-cookie': clearCookie(),
    },
  })
}
