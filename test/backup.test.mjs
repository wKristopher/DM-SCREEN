/**
 * Backup round-trip, and the two things that must never go wrong:
 * a key must not travel in the file, and a wrong file must not half-apply.
 */
import {
  buildBackup,
  parseBackup,
  summarise,
  formatSavedAt,
  BACKUP_FORMAT,
} from '../src/lib/backup.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

const state = {
  combatants: [{ id: 'a', name: 'Goblin', hp: 7 }],
  round: 3,
  turn: 1,
  combatActive: true,
  party: [{ id: 'p1', name: 'Vex' }, { id: 'p2', name: 'Kaz' }],
  notes: 'Mahzendeki sunak kırık.',
  log: [{ id: 'l1', text: 'ilk satır' }, { id: 'l2', text: 'ikinci' }],
  packs: [
    { id: 'b1', name: 'Kendi işlerim', monsters: [{}, {}], spells: [{}], items: [], tables: [{}], npcs: [] },
  ],
  activePackId: 'b1',
  headline: 'Kapı sürgülü.',
  encounters: [
    { id: 'e1', name: 'Mahzen pususu', createdAt: 1, notes: '', slots: [{ count: 3, monster: { name: 'Goblin', cr: 0.25 } }] },
  ],
  settings: {
    theme: 'dusk',
    dice: { mode: 'favoured', level: 'strong' },
    llm: {
      enabled: true,
      provider: 'gemini',
      models: { gemini: 'gemini-3.5-flash-lite' },
      keys: { gemini: 'AQ.super-secret-key', anthropic: 'sk-ant-also-secret' },
    },
  },
}

/* ------------------------------------------------------------- secrets */

const backup = buildBackup(state)
const serialised = JSON.stringify(backup)

// The whole file is searched, not just the field we expect it in — a key that
// reappeared somewhere unexpected would still be a leak.
check('no API key anywhere in the file', !/super-secret-key|also-secret/.test(serialised), serialised.slice(0, 200))
check('keys field is emptied, not deleted', typeof backup.data.settings.llm.keys === 'object')
check('no key means the assistant is off in the restored copy', backup.data.settings.llm.enabled === false)
check('provider choice survives — a preference, not a secret', backup.data.settings.llm.provider === 'gemini')
check('model choice survives', backup.data.settings.llm.models.gemini === 'gemini-3.5-flash-lite')

// Scrubbing must not reach back into the live settings object.
check('the live settings are left untouched', state.settings.llm.keys.gemini === 'AQ.super-secret-key')
check('the live assistant stays enabled', state.settings.llm.enabled === true)

/* ------------------------------------------------------------- round trip */

const reloaded = parseBackup(serialised)
check('format is stamped', reloaded.format === BACKUP_FORMAT)
check('party survives', reloaded.data.party.length === 2)
check('notes survive', reloaded.data.notes === 'Mahzendeki sunak kırık.')
check('log survives', reloaded.data.log.length === 2)
check('packs survive', reloaded.data.packs.length === 1)
check('combat state survives', reloaded.data.round === 3 && reloaded.data.combatActive === true)
check('dice mode survives', reloaded.data.settings.dice.level === 'strong')
// Prep is exactly the kind of work a backup exists to protect.
check('prepared encounters survive', reloaded.data.encounters.length === 1)
check('and carry their monsters whole, not as slugs', reloaded.data.encounters[0].slots[0].monster.name === 'Goblin')
check('the player-screen line survives', reloaded.data.headline === 'Kapı sürgülü.')
check('timestamp is recorded', !Number.isNaN(Date.parse(reloaded.savedAt)))

/* ------------------------------------------------------------- summary */

const s = summarise(reloaded)
check('summary counts party', s.party === 2)
check('summary counts log', s.logEntries === 2)
check('summary counts notes', s.noteChars === state.notes.length)
check('summary counts packs', s.packs === 1)
check('summary counts every kind of brew entry', s.brewEntries === 4, `got ${s.brewEntries}`)
check('summary counts encounters', s.encounters === 1, String(s.encounters))

/* ------------------------------------------------------------- rejection */

const rejects = (raw, label) => {
  try {
    parseBackup(raw)
    check(label, false, 'accepted when it should not have')
  } catch {
    pass++
  }
}

rejects('not json at all', 'plain text is rejected')
rejects('', 'an empty file is rejected')
rejects('null', 'null is rejected')
rejects('[1,2,3]', 'an array is rejected')
rejects('{"hello":"world"}', 'a JSON file that is not ours is rejected')
rejects(JSON.stringify({ format: 'kahin-brew/1', name: 'x' }), 'a homebrew pack is rejected')
rejects(JSON.stringify({ format: BACKUP_FORMAT }), 'a backup with no data is rejected')

// The message has to point somewhere useful, since this is where a confused
// DM lands after picking the wrong file.
try {
  parseBackup(JSON.stringify({ format: 'kahin-brew/1' }))
} catch (e) {
  check('the wrong-file message names the right tab', /Ocak/.test(e.message), e.message)
}

/* ------------------------------------------------------------- tolerance */

// A file from a future version, or one with fields missing, should still load
// what it can rather than refuse outright.
const sparse = parseBackup(JSON.stringify({ format: 'kahin-backup/2', data: { party: [{ id: 'x' }] } }))
check('a newer format version still loads', sparse.data.party.length === 1)
const empty = buildBackup({})
check('an empty screen still produces a valid backup', summarise(empty).party === 0 && empty.data.notes === '')
check('an empty screen has no encounters', summarise(empty).encounters === 0)
check('missing settings do not crash the summary', summarise(empty).hasSettings === false)

check('a broken timestamp reads as tarihsiz', formatSavedAt('not-a-date') === 'tarihsiz')
check('a real timestamp is formatted', formatSavedAt('2026-08-05T12:00:00Z') !== 'tarihsiz')

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
