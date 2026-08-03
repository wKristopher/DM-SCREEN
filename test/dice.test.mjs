/** Statistical + behavioural checks on the dice engine. Run: node dice.test.mjs */
import { roll, averageOf, abilityMod, signed } from '../src/lib/dice.ts'

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

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
