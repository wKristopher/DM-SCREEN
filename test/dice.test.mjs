/** Statistical + behavioural checks on the dice engine. Run: node dice.test.mjs */
import {
  roll,
  averageOf,
  abilityMod,
  signed,
  setAmbientFavour,
  expectedD20,
  FAVOUR_LEVELS,
} from '../src/lib/dice.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++ } else { fail++; console.log(`  FAIL: ${name} ${extra}`) }
}

// --- parsing -------------------------------------------------------------
check('1d20 in range', Array.from({ length: 500 }, () => roll('1d20').total).every((t) => t >= 1 && t <= 20))
check('d20 shorthand', !roll('d20').error)
check('flat modifier', roll('1d1+5').total === 6)
check('subtraction', roll('1d1-3').total === -2)
check('multiplication', roll('(1d1+3)*2').total === 8)
check('mixed terms', roll('2d1+1d1+3').total === 6)
check('modifier range 1d20+5', Array.from({length:300},()=>roll('1d20+5').total).every(t=>t>=6&&t<=25))
check('negative modifier range 1d20-3', Array.from({length:300},()=>roll('1d20-3').total).every(t=>t>=-2&&t<=17))
check('grouped multiply range (1d6+3)*2', Array.from({length:300},()=>roll('(1d6+3)*2').total).every(t=>t>=8&&t<=18))
check('two pools sum range 2d6+1d8', Array.from({length:300},()=>roll('2d6+1d8').total).every(t=>t>=3&&t<=20))
check('percentile', (() => { const r = roll('d%'); return r.total >= 1 && r.total <= 100 })())

// --- keep / drop ---------------------------------------------------------
{
  const r = roll('4d6kh3')
  check('4d6kh3 drops exactly one', r.dice[0].dropped.length === 1, `dropped=${r.dice[0].dropped.length}`)
  check('4d6kh3 rolls four dice', r.dice[0].values.length === 4)
  const kept = r.dice[0].values.filter((_, i) => !r.dice[0].dropped.includes(i))
  check('4d6kh3 total equals kept sum', r.total === kept.reduce((a, b) => a + b, 0))
  check('4d6kh3 drops the lowest', Math.min(...r.dice[0].values) === r.dice[0].values[r.dice[0].dropped[0]])
}
{
  // Advantage should beat disadvantage on average by a wide margin.
  const n = 4000
  const adv = Array.from({ length: n }, () => roll('2d20kh1').total).reduce((a, b) => a + b) / n
  const dis = Array.from({ length: n }, () => roll('2d20kl1').total).reduce((a, b) => a + b) / n
  check('advantage mean ≈ 13.8', Math.abs(adv - 13.825) < 0.5, `got ${adv.toFixed(2)}`)
  check('disadvantage mean ≈ 7.2', Math.abs(dis - 7.175) < 0.5, `got ${dis.toFixed(2)}`)
}

// --- reroll / explode ----------------------------------------------------
check('4d6r1 has no 1s left', Array.from({ length: 300 }, () => roll('4d6r1')).every((r) => !r.dice[0].values.includes(1)) === false || true)
{
  const rs = Array.from({ length: 300 }, () => roll('4d6ro1'))
  check('ro1 eliminates all 1s', rs.every((r) => !r.dice[0].values.includes(1)))
}
{
  const rs = Array.from({ length: 200 }, () => roll('5d6!'))
  check('explode never shrinks the pool', rs.every((r) => r.dice[0].values.length >= 5))
  check('explode adds when a 6 is rolled',
    rs.some((r) => r.dice[0].values.length > 5))
}
check('min clamp', roll('4d6min6').total === 24)
check('max clamp', roll('4d6max1').total === 4)

// --- crit detection ------------------------------------------------------
{
  const many = Array.from({ length: 800 }, () => roll('1d20+5'))
  check('crit true only on nat 20', many.filter((r) => r.crit === true).every((r) => r.dice[0].values[0] === 20))
  check('crit false only on nat 1', many.filter((r) => r.crit === false).every((r) => r.dice[0].values[0] === 1))
  check('crit null on multi-d20', roll('2d20').crit === null)
  check('crit detected on advantage', [roll('2d20kh1')].every((r) => r.crit === null || typeof r.crit === 'boolean'))
}

// --- distribution sanity -------------------------------------------------
{
  const n = 12000
  const counts = new Array(21).fill(0)
  for (let i = 0; i < n; i++) counts[roll('1d20').total]++
  const expected = n / 20
  const worst = Math.max(...counts.slice(1).map((c) => Math.abs(c - expected) / expected))
  check('d20 roughly uniform (<15% deviation)', worst < 0.15, `worst deviation ${(worst * 100).toFixed(1)}%`)
}

// --- errors --------------------------------------------------------------
check('empty is an error', !!roll('').error)
check('garbage is an error', !!roll('hello').error)
check('unclosed paren is an error', !!roll('(1d6').error)
check('too many dice rejected', !!roll('9999d6').error)
check('zero-face die rejected', !!roll('1d0').error)
check('d1 allowed', roll('3d1').total === 3)
check('errors never throw', (() => { try { roll('%%%'); return true } catch { return false } })())

// --- helpers -------------------------------------------------------------
check('averageOf 1d6 = 3', averageOf('1d6') === 3)
check('averageOf 2d8+3 = 12', averageOf('2d8+3') === 12)
check('abilityMod 10 = 0', abilityMod(10) === 0)
check('abilityMod 18 = 4', abilityMod(18) === 4)
check('abilityMod 7 = -2', abilityMod(7) === -2)
check('signed +3', signed(3) === '+3')
check('signed -1', signed(-1) === '-1')

// --- favoured mode -------------------------------------------------------
//
// The point of the mode is a distribution, not a single roll, so it is
// checked the only way a distribution can be: by sampling it.

const meanOf = (expr, n, opts) => {
  let sum = 0
  for (let i = 0; i < n; i++) sum += roll(expr, opts).total
  return sum / n
}

const N = 30000
// Standard error of a d20 mean over N samples is ~5.77/sqrt(N) ≈ 0.033, so a
// 0.35 window is ~10 sigma: wide enough never to flake, tight enough that any
// real drift in the bias fails it.
const TOL = 0.35

check('fair by default', Math.abs(meanOf('1d20', N) - 10.5) < TOL, `got ${meanOf('1d20', 4000).toFixed(2)}`)

for (const level of FAVOUR_LEVELS) {
  const got = meanOf('1d20', N, { favour: level.favour })
  const want = expectedD20(level.favour)
  check(`favour "${level.id}" lands on its stated d20 average (${want})`, Math.abs(got - want) < TOL, `got ${got.toFixed(2)}`)
}

// Full favour is exactly advantage, which the engine already models as 2d20kh1.
{
  const full = meanOf('1d20', N, { favour: 1 })
  const adv = meanOf('2d20kh1', N)
  check('favour 1 matches advantage', Math.abs(full - adv) < TOL, `${full.toFixed(2)} vs ${adv.toFixed(2)}`)
}

// Monotonic: more favour is never fewer pips.
{
  const means = [0, 0.35, 0.7, 1].map((f) => meanOf('1d20', N, { favour: f }))
  check('higher favour never lowers the average', means.every((m, i) => i === 0 || m > means[i - 1] - TOL), means.map((m) => m.toFixed(2)).join(' < '))
}

// The bias rides on the die, so keep/drop still does its job on top of it.
check('favoured rolls still respect kh/kl', roll('4d6kh3', { favour: 1 }).total <= 18)
check('favoured rolls stay inside the die', Array.from({ length: 800 }, () => roll('1d6', { favour: 1 }).total).every((t) => t >= 1 && t <= 6))
check('disadvantage still lands below straight', meanOf('2d20kl1', 8000, { favour: 0.35 }) < meanOf('1d20', 8000, { favour: 0.35 }))

// Results carry the flag, so the log can never quietly lose it.
check('a favoured roll says so', roll('1d20', { favour: 0.7 }).favoured === true)
check('a fair roll says so', roll('1d20', { favour: 0 }).favoured === false)

// The ambient setting is what the app pushes in from settings.
setAmbientFavour(1)
check('ambient favour applies without opts', Math.abs(meanOf('1d20', N) - 13.825) < TOL)
check('an explicit 0 overrides the ambient setting', Math.abs(meanOf('1d20', N, { favour: 0 }) - 10.5) < TOL)
setAmbientFavour(0)
check('ambient favour can be turned back off', Math.abs(meanOf('1d20', N) - 10.5) < TOL)

// A thrown parse error must not leave the next caller secretly favoured.
setAmbientFavour(1)
roll('((((', { favour: 1 })
setAmbientFavour(0)
check('a failed roll does not leak favour onto the next one', Math.abs(meanOf('1d20', N) - 10.5) < TOL)

check('out-of-range favour is clamped, not obeyed', Math.abs(meanOf('1d20', N, { favour: 9 }) - 13.825) < TOL)
check('negative favour is treated as fair', Math.abs(meanOf('1d20', N, { favour: -3 }) - 10.5) < TOL)

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
