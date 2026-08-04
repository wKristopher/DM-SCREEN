/**
 * Login endpoint.
 *
 * Verifies the username and password server-side and hands back an httpOnly
 * signed cookie. The credentials themselves never leave the server.
 */

import { isConfigured, issueToken, sessionCookie, verifyCredentials } from '../lib/auth'

export const config = { runtime: 'edge' }

/**
 * Per-IP throttle.
 *
 * A short numeric password is brute-forceable in minutes if the endpoint
 * answers as fast as it can. PBKDF2 already costs ~200ms per attempt; this
 * caps the rate on top of that. Edge instances are regional, so this is a
 * speed bump rather than a wall — the real fix is a longer password, which
 * the README says plainly.
 */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; first: number }>()

function throttled(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now })
    return false
  }
  rec.count++
  return rec.count > MAX_ATTEMPTS
}

function clearAttempts(ip: string): void {
  attempts.delete(ip)
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Yalnızca POST' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Without ADMIN_* / AUTH_SECRET there is no account to check against. Saying
  // so beats answering "wrong password" to a password that is in fact correct.
  if (!isConfigured()) {
    return new Response(
      JSON.stringify({ error: 'Sunucuda giriş bilgileri tanımlı değil (ADMIN_USER / ADMIN_SALT / ADMIN_HASH / AUTH_SECRET).' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (throttled(ip)) {
    return new Response(
      JSON.stringify({ error: 'Çok fazla deneme. 10 dakika bekleyip tekrar dene.' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    )
  }

  let username = ''
  let password = ''
  try {
    const body = (await request.json()) as { username?: string; password?: string }
    username = String(body.username ?? '')
    password = String(body.password ?? '')
  } catch {
    return new Response(JSON.stringify({ error: 'Geçersiz istek' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (!(await verifyCredentials(username, password))) {
    // One message for both wrong-user and wrong-password: naming which half
    // failed tells an attacker whether the username is real.
    return new Response(JSON.stringify({ error: 'Kullanıcı adı veya şifre hatalı.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  clearAttempts(ip)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': sessionCookie(await issueToken(username)),
    },
  })
}
