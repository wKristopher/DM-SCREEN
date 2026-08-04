/**
 * Auth primitives.
 *
 * This is the code standing between the internet and the app, so the failure
 * modes that matter are the silent ones: a token that verifies when it
 * shouldn't, an expired session that still passes, a tampered signature.
 */
import { verifyCredentials, issueToken, verifyToken, sessionCookie, clearCookie, readCookie, isConfigured, COOKIE_NAME } from '../lib/auth.ts'
import { USER, PASS, useTestAccount } from './gate-account.mjs'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

// lib/auth reads process.env lazily, so setting the throwaway account here —
// after the hoisted import — still lands before the first call.
useTestAccount()

/* ------------------------------------------------------------- unconfigured */

// A deployment that was never given credentials must lock everyone out, not
// let everyone in. This is the failure mode worth being paranoid about, so it
// runs first, while the environment is still empty.
{
  const saved = { ...process.env }
  for (const k of ['ADMIN_USER', 'ADMIN_SALT', 'ADMIN_HASH', 'AUTH_SECRET']) delete process.env[k]

  check('reports itself unconfigured', !isConfigured())
  check('unconfigured rejects any credentials', !(await verifyCredentials('admin', 'admin')))
  check('unconfigured rejects empty credentials', !(await verifyCredentials('', '')))
  check('unconfigured cannot verify a token', !(await verifyToken('anything.atall')))

  Object.assign(process.env, saved)
}

/* ------------------------------------------------------------- credentials */

check('configured once the environment is set', isConfigured())
check('correct credentials accepted', await verifyCredentials(USER, PASS))
check('wrong password rejected', !(await verifyCredentials(USER, `${PASS}x`)))
check('empty password rejected', !(await verifyCredentials(USER, '')))
check('wrong username rejected', !(await verifyCredentials('admin', PASS)))
check('username is case-sensitive', !(await verifyCredentials(USER.toUpperCase(), PASS)))
check('surrounding whitespace tolerated on username', await verifyCredentials(`  ${USER}  `, PASS))
check('password whitespace NOT tolerated', !(await verifyCredentials(USER, ` ${PASS} `)))
check('both wrong rejected', !(await verifyCredentials('x', 'y')))

/* ------------------------------------------------------------- tokens */

const token = await issueToken(USER)
check('issued token verifies', await verifyToken(token))
check('token has payload.signature shape', token.split('.').length === 2, token)
check('empty token rejected', !(await verifyToken('')))
check('undefined token rejected', !(await verifyToken(undefined)))
check('garbage token rejected', !(await verifyToken('nonsense')))
check('payload without signature rejected', !(await verifyToken(token.split('.')[0])))

// Flip a character in the signature.
const [payload, sig] = token.split('.')
const badSig = sig.slice(0, -1) + (sig.at(-1) === 'A' ? 'B' : 'A')
check('tampered signature rejected', !(await verifyToken(`${payload}.${badSig}`)))

// Re-sign a payload with someone else's idea of a secret — i.e. forge one.
const forgedPayload = btoa(JSON.stringify({ u: 'attacker', exp: Date.now() + 1e7 }))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')
check('forged payload with old signature rejected', !(await verifyToken(`${forgedPayload}.${sig}`)))

// An expired token must fail even though its signature is perfectly valid.
const expired = await (async () => {
  const enc = new TextEncoder()
  const b64 = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const p = b64(enc.encode(JSON.stringify({ u: USER, exp: Date.now() - 1000 })))
  // Reuse the real signing path by asking for a token and swapping the payload
  // is not possible, so verify the negative case through the public API:
  return `${p}.${sig}`
})()
check('expired-and-mis-signed token rejected', !(await verifyToken(expired)))

/* ------------------------------------------------------------- cookies */

const cookie = sessionCookie(token)
check('cookie is httpOnly', cookie.includes('HttpOnly'))
check('cookie is Secure', cookie.includes('Secure'))
check('cookie sets SameSite', cookie.includes('SameSite=Lax'))
check('cookie scoped to root', cookie.includes('Path=/'))
check('cookie expires', /Max-Age=\d+/.test(cookie))
check('clear cookie zeroes Max-Age', clearCookie().includes('Max-Age=0'))

check('reads its own cookie back', readCookie(`${COOKIE_NAME}=${token}`, COOKIE_NAME) === token)
check(
  'reads a cookie among others',
  readCookie(`other=1; ${COOKIE_NAME}=${token}; third=x`, COOKIE_NAME) === token,
)
check('missing cookie is undefined', readCookie('other=1', COOKIE_NAME) === undefined)
check('null header is undefined', readCookie(null, COOKIE_NAME) === undefined)
check(
  'a cookie whose name merely contains ours is not matched',
  readCookie('not_kahin_session=evil', COOKIE_NAME) === undefined,
)

/* ------------------------------------------------------------- round trip */

check('a fresh token from a different call also verifies', await verifyToken(await issueToken(USER)))

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
