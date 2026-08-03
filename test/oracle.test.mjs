/** Intent routing checks — a wrong route mid-combat is worse than no route. */
import { parseIntent } from '../src/lib/ai/oracle.ts'

let pass = 0
let fail = 0
const t = (input, expect, tables = []) => {
  const got = parseIntent(input, tables)
  const ok = Object.entries(expect).every(([k, v]) => got[k] === v)
  if (ok) pass++
  else { fail++; console.log(`  FAIL "${input}" → ${JSON.stringify(got)} ; wanted ${JSON.stringify(expect)}`) }
}

// dice take priority — most-typed thing at the table
t('4d6kh3', { type: 'dice', expression: '4d6kh3' })
t('2d8+3', { type: 'dice', expression: '2d8+3' })
t('d20', { type: 'dice', expression: 'd20' })
t('/r 1d20+7', { type: 'dice', expression: '1d20+7' })
t('roll 8d6', { type: 'dice', expression: '8d6' })
t('adv', { type: 'dice', expression: '2d20kh1' })
t('adv +5', { type: 'dice', expression: '2d20kh1+5' })
t('dis -2', { type: 'dice', expression: '2d20kl1-2' })
t('avantaj +3', { type: 'dice', expression: '2d20kh1+3' })

// generators, Turkish and English
t('npc', { type: 'generate', what: 'npc' })
t('meyhane', { type: 'generate', what: 'tavern' })
t('tavern', { type: 'generate', what: 'tavern' })
t('görev kancası', { type: 'generate', what: 'hook' })
t('hazine', { type: 'generate', what: 'treasure' })
t('tuzak', { type: 'generate', what: 'trap' })
t('hava', { type: 'generate', what: 'weather' })
t('zindan', { type: 'generate', what: 'dungeon' })
t('dedikodu', { type: 'generate', what: 'rumor' })

// generator arguments
{
  const r = parseIntent('karşılaşma orman seviye 5')
  const ok = r.type === 'generate' && r.what === 'encounter' && r.args?.environment === 'orman' && r.args?.partyLevel === 5
  ok ? pass++ : (fail++, console.log('  FAIL encounter args →', JSON.stringify(r)))
}
{
  const r = parseIntent('hazine cr 12')
  const ok = r.type === 'generate' && r.what === 'treasure' && r.args?.cr === 12
  ok ? pass++ : (fail++, console.log('  FAIL treasure cr →', JSON.stringify(r)))
}

// a bare noun should look it up, not guess a generator
t('goblin', { type: 'lookup', resource: 'monsters', query: 'goblin' })
t('ancient red dragon', { type: 'lookup', resource: 'monsters' })

// explicit resource verbs
t('büyü fireball', { type: 'lookup', resource: 'spells' })
t('yaratık goblin', { type: 'lookup', resource: 'monsters' })

// yes/no oracle
t('Tuzak var mı?', { type: 'oracle' })
t('Kapı kilitli mi?', { type: 'oracle' })

// user tables win over a generic lookup
t('Bataklık Olayları', { type: 'custom-table', name: 'Bataklık Olayları' }, ['Bataklık Olayları'])
t('bataklık olayları', { type: 'custom-table', name: 'Bataklık Olayları' }, ['Bataklık Olayları'])

// empty input
t('', { type: 'unknown' })

// prose containing "d20" must NOT be treated as a dice expression
{
  const r = parseIntent('kapıda d20 sembolü var')
  const ok = r.type !== 'dice'
  ok ? pass++ : (fail++, console.log('  FAIL prose treated as dice →', JSON.stringify(r)))
}

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
