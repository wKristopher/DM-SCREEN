/**
 * What the player screen is allowed to show.
 *
 * These are the tests that matter most in the app: a leak here puts a number
 * in front of the players that the DM meant to keep, and no amount of undo
 * takes it back. So the secret cases are checked from several directions.
 */
import { tableRows, activeRowId, woundOf, WOUND_LABELS } from '../src/lib/table.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

const mk = (over = {}) => ({
  id: 'x', name: 'Goblin', initiative: 12, hp: 7, maxHp: 7, tempHp: 0,
  isPc: false, secret: false, conditions: [], concentration: null, ...over,
})

/* ------------------------------------------------------------------ wounds */

check('untouched is healthy', woundOf(10, 10) === 'healthy')
check('a scratch is no longer healthy', woundOf(9, 10) === 'grazed', woundOf(9, 10))
// 5e's "bloodied" is at or below half, so the boundary belongs on this side.
check('exactly half is bloodied', woundOf(5, 10) === 'bloodied', woundOf(5, 10))
check('just above half is not', woundOf(6, 10) === 'grazed', woundOf(6, 10))
check('a quarter left is battered', woundOf(2, 10) === 'battered')
check('zero is down', woundOf(0, 10) === 'down')
check('negative is down', woundOf(-5, 10) === 'down')
check('a zero-max creature does not divide by zero', woundOf(5, 0) === 'healthy')
check('every wound has a word', Object.keys(WOUND_LABELS).length === 5)

// The description has to keep moving through a long fight rather than sitting
// on one word — otherwise it tells the table nothing.
{
  const seen = new Set([10, 8, 6, 4, 2, 1].map((hp) => woundOf(hp, 10)))
  check('a fight passes through several descriptions', seen.size >= 4, [...seen].join(','))
}

/* ------------------------------------------------------------------ secrets */

{
  const list = [
    mk({ id: 'a', name: 'Vex', isPc: true }),
    mk({ id: 'b', name: 'Ambusher', secret: true }),
    mk({ id: 'c', name: 'Goblin' }),
  ]
  const rows = tableRows(list)
  check('a secret combatant is absent entirely', rows.length === 2, String(rows.length))
  check('and not merely hidden by name', !JSON.stringify(rows).includes('Ambusher'))
  check('the visible ones survive', rows.map((r) => r.name).join() === 'Vex,Goblin')
}

check('a secret PC is hidden too', tableRows([mk({ isPc: true, secret: true })]).length === 0)
check('an empty tracker gives an empty table', tableRows([]).length === 0)

/* ------------------------------------------------------------------ numbers */

{
  const [monster] = tableRows([mk({ hp: 3, maxHp: 20 })])
  check('a monster gets no hit points', monster.hp === null && monster.maxHp === null)
  check('it gets a word instead', monster.woundLabel === WOUND_LABELS.battered, monster.woundLabel)
  check('and no temp HP either', monster.tempHp === 0)
  check('but the table can see it is still standing', monster.down === false)
}

{
  const [pc] = tableRows([mk({ isPc: true, hp: 12, maxHp: 30, tempHp: 4 })])
  check('a PC keeps their numbers — they know them anyway', pc.hp === 12 && pc.maxHp === 30)
  check('including temp HP', pc.tempHp === 4)
  check('and gets no wound word', pc.wound === null && pc.woundLabel === '')
}

// A downed monster is obvious at the table, so hiding it would be silly.
check('a dropped monster reads as down', tableRows([mk({ hp: 0 })])[0].down === true)

/* ------------------------------------------------------------------ status */

{
  const [row] = tableRows([
    mk({ conditions: [{ name: 'Prone', rounds: null }, { name: 'Poisoned', rounds: 3 }], concentration: 'Bless' }),
  ])
  check('conditions cross over', row.conditions.join() === 'Prone,Poisoned')
  check('concentration crosses as a flag', row.concentrating === true)
  // The spell's name is the DM's business; that it is concentrating is not.
  check('but not which spell', !JSON.stringify(row).includes('Bless'))
}

/* ------------------------------------------------------------------ turn */

{
  const list = [
    mk({ id: 'a', name: 'Vex', isPc: true }),
    mk({ id: 'b', name: 'Ambusher', secret: true }),
    mk({ id: 'c', name: 'Goblin' }),
  ]
  check('the active row is found by id, not index', activeRowId(list, 0) === 'a')
  check('index 2 is the goblin, not shifted by the hidden row', activeRowId(list, 2) === 'c')
  // If the table learned "someone invisible is acting", that is information.
  check('a secret creature’s turn belongs to nobody', activeRowId(list, 1) === null)
  check('an out-of-range turn is nobody', activeRowId(list, 9) === null)
  check('an empty tracker has no active row', activeRowId([], 0) === null)
}

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
