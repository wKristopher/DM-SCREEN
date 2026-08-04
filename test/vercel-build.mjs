/**
 * Runs Vercel's own build pipeline locally.
 *
 * This is the only check that sees the deployment. `npm run build` compiles the
 * client and never touches middleware.ts or api/*.ts, and `tsc --noEmit` only
 * proves the types are sound — neither one runs the builder that turns those
 * files into edge functions. A builder incompatibility therefore passes every
 * other check in this repo and surfaces for the first time in a deploy log,
 * which is the worst possible place to find it.
 *
 * That is not hypothetical: TypeScript 7 (the native rewrite) makes the builder
 * fail with `Cannot read properties of undefined (reading 'readFile')`, because
 * it drives the old compiler API. Hence the 5.x pin in package.json.
 *
 * `vercel build` normally pulls project settings from the account. A throwaway
 * .vercel/project.json is enough to run it offline, against no real project.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const SETTINGS = {
  projectId: 'prj_localbuildonly',
  orgId: 'team_localbuildonly',
  settings: { framework: 'vite', nodeVersion: '22.x' },
}

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

// Don't clobber a real link.
const linked = existsSync('.vercel/project.json') && !readFileSync('.vercel/project.json', 'utf8').includes('localbuildonly')
if (linked) {
  console.log('  .vercel/project.json belongs to a real project — skipping')
  process.exit(0)
}

mkdirSync('.vercel', { recursive: true })
writeFileSync('.vercel/project.json', JSON.stringify(SETTINGS, null, 2))
rmSync('.vercel/output', { recursive: true, force: true })

let out = ''
try {
  out = execFileSync('npx', ['--yes', 'vercel@latest', 'build', '--prod'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  out = `${err.stdout ?? ''}${err.stderr ?? ''}`
}

const ok = out.includes('"status": "ok"')
// On failure the builder's own message is the whole point of running this, so
// print it rather than letting a missing output file throw something unrelated.
check('build reported success', ok, ok ? '' : `\n${out.split('\n').slice(-14).join('\n')}`)

// The gate is three separate edge functions; losing any one of them silently
// opens the site or breaks sign-in.
check('middleware built', existsSync('.vercel/output/functions/middleware.func'))
check('login function built', existsSync('.vercel/output/functions/api/login.func'))
check('logout function built', existsSync('.vercel/output/functions/api/logout.func'))

// The client still has to be there, and the login page has to stay outside it.
check('client bundle emitted', existsSync('.vercel/output/static/index.html'))
check('login page emitted', existsSync('.vercel/output/static/login.html'))

const cfg = existsSync('.vercel/output/config.json')
  ? JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'))
  : {}

if (Array.isArray(cfg.routes)) {
  const mw = cfg.routes.find((r) => r.middlewarePath === 'middleware')
  check('middleware is wired into the routes', !!mw)
  check(
    'middleware runs before the filesystem, so assets are gated too',
    !!mw && cfg.routes.indexOf(mw) < cfg.routes.findIndex((r) => r.handle === 'filesystem'),
  )
  check('login stays reachable without a session', !!mw && !'/login'.match(new RegExp(mw.src)))
  check('the JS bundle does not', !!mw && !!'/assets/index-abc.js'.match(new RegExp(mw.src)))
} else {
  check('routing config emitted', false)
}

rmSync('.vercel', { recursive: true, force: true })

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
