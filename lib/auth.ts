/**
 * Server-side auth primitives.
 *
 * This module runs only in Edge functions and middleware — it is never part of
 * the client bundle, so nothing here reaches a browser. That is the whole point:
 * a password checked in client JavaScript is not a password, it is a suggestion.
 *
 * Uses Web Crypto only, so the same code runs in middleware and in the login
 * function without a Node polyfill.
 */

export const COOKIE_NAME = 'kahin_session'

/** How long a login lasts before the DM has to sign in again. */
const SESSION_SECONDS = 60 * 60 * 12

/** Matches the cost used to generate the stored hash. */
const PBKDF2_ITERATIONS = 210_000

interface Creds {
  user: string
  salt: string
  hash: string
  secret: string
}

/**
 * Credentials live in the environment and nowhere else.
 *
 * No file, no default, nothing checked in: a repository is copied, forked and
 * pasted into chat windows, and a password hash that travels with it travels
 * everywhere the code goes. Keeping them in the environment also means they can
 * be rotated in the hosting dashboard without touching code.
 */
function creds(): Creds {
  const env = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>)
  return {
    user: env.ADMIN_USER ?? '',
    salt: env.ADMIN_SALT ?? '',
    hash: env.ADMIN_HASH ?? '',
    secret: env.AUTH_SECRET ?? '',
  }
}

/**
 * Whether the deployment has been given an account to check against.
 *
 * Everything below fails closed when this is false — an unconfigured site
 * refuses every login rather than accepting any.
 */
export function isConfigured(): boolean {
  const c = creds()
  return Boolean(c.user && c.salt && c.hash && c.secret)
}

/* ------------------------------------------------------------------ helpers */

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  // Backed by a plain ArrayBuffer so it satisfies BufferSource for Web Crypto.
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Compare in constant time.
 *
 * A plain `===` on a hash leaks how many leading characters matched through
 * timing, which is exactly the wrong thing to leak on a credential check.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ------------------------------------------------------------------ password */

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(bits)
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (!isConfigured()) return false

  const c = creds()
  // Derive regardless of whether the username matched, so a wrong username and
  // a wrong password take the same time to reject.
  const derived = await derive(password, c.salt)
  const userOk = timingSafeEqual(username.trim(), c.user)
  const passOk = timingSafeEqual(derived, c.hash)
  return userOk && passOk
}

/* ------------------------------------------------------------------ session */

async function hmacKey(): Promise<CryptoKey> {
  const { secret } = creds()
  // An empty key would make Web Crypto throw halfway through a request, which
  // reads as a 500 rather than as "you forgot AUTH_SECRET".
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/** Issue a signed session token. The signature is what makes it unforgeable. */
export async function issueToken(username: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp: Date.now() + SESSION_SECONDS * 1000 })))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload))
  return `${payload}.${b64url(new Uint8Array(sig))}`
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false

  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), unb64url(sig), enc.encode(payload))
    if (!ok) return false
    const { exp } = JSON.parse(new TextDecoder().decode(unb64url(payload))) as { exp?: number }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

export function sessionCookie(token: string): string {
  // httpOnly keeps it out of reach of any script on the page; SameSite=Lax is
  // enough here and survives a normal top-level navigation after login.
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_SECONDS}`,
  ].join('; ')
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}
