/**
 * Drives a real browser against the real middleware + login handler.
 *
 * Requires `node server.built.mjs` (see test/serve-local.mjs) on PORT.
 * Run via: node test/gate.test.mjs
 */
import { chromium } from 'playwright'
import { USER, PASS } from './gate-account.mjs'

const BASE = process.env.BASE ?? 'http://localhost:4182'
const SHOTS = process.env.SHOTS

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

/* --------------------------------------------------- unauthenticated */

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
check('bare visit lands on the login page', page.url().endsWith('/login'), page.url())
check('login form is present', (await page.locator('#form').count()) === 1)
check('app shell did not render', (await page.locator('#root').count()) === 0)

if (SHOTS) await page.screenshot({ path: `${SHOTS}/L1-login.png` })

// A deep link should be remembered, not lost.
await page.goto(`${BASE}/some/deep/path`, { waitUntil: 'domcontentloaded' })
check('deep link preserved in ?next', page.url().includes('next=%2Fsome%2Fdeep%2Fpath'), page.url())

/* --------------------------------------------------- wrong credentials */

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', USER)
await page.fill('#password', `${PASS}-but-wrong`)
await page.click('#submit')
await page.waitForSelector('#error:not([hidden])', { timeout: 5000 })
const err = await page.textContent('#error')
check('wrong password shows an error', /hatalı/i.test(err ?? ''), err ?? '')
check('still on the login page', page.url().includes('/login'))
check('password field is cleared after a failure', (await page.inputValue('#password')) === '')

if (SHOTS) await page.screenshot({ path: `${SHOTS}/L2-error.png` })

// Wrong username must look identical — no account enumeration.
await page.fill('#username', 'nobody')
await page.fill('#password', PASS)
await page.click('#submit')
await page.waitForSelector('#error:not([hidden])', { timeout: 5000 })
check('wrong username gives the same message', (await page.textContent('#error')) === err)

/* --------------------------------------------------- correct credentials */

await page.fill('#username', USER)
await page.fill('#password', PASS)
await page.click('#submit')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
await page.waitForTimeout(1500)

check('lands on the app', !page.url().includes('/login'), page.url())
check('app shell rendered', (await page.locator('#root').count()) === 1)
check('app actually booted', (await page.locator('#root').innerHTML()).length > 1000)

const cookies = await ctx.cookies()
const session = cookies.find((c) => c.name === 'kahin_session')
check('session cookie set', !!session)
check('session cookie is httpOnly', session?.httpOnly === true)
check('session cookie is not readable from JS', (await page.evaluate(() => document.cookie)) === '')

if (SHOTS) await page.screenshot({ path: `${SHOTS}/L3-app.png` })

/* --------------------------------------------------- session persists */

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
check('reload stays signed in', !page.url().includes('/login'))

/* --------------------------------------------------- logout */

await page.goto(`${BASE}/api/logout`, { waitUntil: 'domcontentloaded' })
check('logout redirects to login', page.url().includes('/login'), page.url())
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
check('after logout the app is gated again', page.url().includes('/login'))

/* --------------------------------------------------- tampering */

await ctx.addCookies([
  { name: 'kahin_session', value: 'forged.signature', domain: 'localhost', path: '/' },
])
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
check('forged cookie is rejected', page.url().includes('/login'))

console.log(`${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
