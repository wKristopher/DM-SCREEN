/**
 * Character sheet maths.
 *
 * The point of the sheet is that a DM types scores and ticks boxes, and the
 * eighteen numbers below stay correct on their own. So these check the derived
 * values against the rules, including the boundaries where proficiency steps.
 */
import {
  proficiencyBonus, modOf, saveMod, skillMod, passiveOf, isPassiveManual,
  spellSaveDc, spellAttackBonus, initiativeMod, trainedSkills,
  blankSheet, normaliseSheet, SKILLS, ABILITIES, PASSIVE_SKILLS,
} from '../src/lib/character.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

const sheet = (over = {}) => ({ ...blankSheet(), level: 1, ...over })

/* ------------------------------------------------------------ proficiency */

// The 5e table, every step of it — this is the number everything else rides on.
const expected = { 1: 2, 4: 2, 5: 3, 8: 3, 9: 4, 12: 4, 13: 5, 16: 5, 17: 6, 20: 6 }
for (const [lvl, want] of Object.entries(expected)) {
  check(`proficiency at level ${lvl} is +${want}`, proficiencyBonus(+lvl) === want, String(proficiencyBonus(+lvl)))
}
check('level 0 is treated as 1', proficiencyBonus(0) === 2)
check('level 99 is capped at 20', proficiencyBonus(99) === 6)
check('a fractional level rounds down', proficiencyBonus(4.9) === 2)
check('NaN does not produce NaN', proficiencyBonus(NaN) === 2)

/* ------------------------------------------------------------ modifiers */

check('10 is +0', modOf(sheet(), 'str') === 0)
check('20 is +5', modOf(sheet({ abilities: { ...blankSheet().abilities, str: 20 } }), 'str') === 5)
check('7 is -2', modOf(sheet({ abilities: { ...blankSheet().abilities, str: 7 } }), 'str') === -2)
check('an odd score rounds down', modOf(sheet({ abilities: { ...blankSheet().abilities, str: 15 } }), 'str') === 2)

/* ------------------------------------------------------------ saves */

{
  const c = sheet({ level: 5, abilities: { ...blankSheet().abilities, dex: 16, wis: 12 }, saveProfs: ['dex'] })
  check('a proficient save adds the bonus', saveMod(c, 'dex') === 6, String(saveMod(c, 'dex')))
  check('a non-proficient save is just the modifier', saveMod(c, 'wis') === 1, String(saveMod(c, 'wis')))
}

/* ------------------------------------------------------------ skills */

{
  const c = sheet({
    level: 5,
    abilities: { ...blankSheet().abilities, dex: 16, wis: 14, int: 8 },
    skillProfs: ['Stealth', 'Perception'],
    expertise: ['Stealth'],
  })
  check('expertise doubles proficiency', skillMod(c, 'Stealth') === 3 + 6, String(skillMod(c, 'Stealth')))
  check('plain proficiency adds it once', skillMod(c, 'Perception') === 2 + 3, String(skillMod(c, 'Perception')))
  check('an untrained skill is the bare modifier', skillMod(c, 'Arcana') === -1, String(skillMod(c, 'Arcana')))
  check('a skill uses its own ability', skillMod(c, 'Acrobatics') === 3, String(skillMod(c, 'Acrobatics')))
  check('an unknown skill is 0, not NaN', skillMod(c, 'Basketbol') === 0)

  const trained = trainedSkills(c)
  check('only trained skills are listed', trained.length === 2, JSON.stringify(trained.map((t) => t.skill)))
  check('and expertise is flagged', trained.find((t) => t.skill === 'Stealth')?.expert === true)
  check('the list is sorted', trained[0].skill === 'Perception')
}

/* ------------------------------------------------------------ passives */

{
  const c = sheet({ level: 5, abilities: { ...blankSheet().abilities, wis: 14 }, skillProfs: ['Perception'] })
  check('passive is 10 + the skill modifier', passiveOf(c, 'Perception') === 15, String(passiveOf(c, 'Perception')))
  check('an untrained passive still counts the ability', passiveOf(c, 'Insight') === 12, String(passiveOf(c, 'Insight')))
  check('derived passives are not marked manual', !isPassiveManual(c, 'Perception'))

  // Levelling must move the number without anyone retyping it — the whole point.
  const levelled = { ...c, level: 9 }
  check('levelling raises the passive on its own', passiveOf(levelled, 'Perception') === 16, String(passiveOf(levelled, 'Perception')))
}

{
  // What the migration produces: a hand-entered number and no scores behind it.
  const c = sheet({ passiveOverrides: { Perception: 17 } })
  check('a hand-entered passive wins', passiveOf(c, 'Perception') === 17)
  check('and is marked as such', isPassiveManual(c, 'Perception'))
  check('the others still derive', passiveOf(c, 'Insight') === 10)
  check('a zero override is honoured, not treated as absent', passiveOf(sheet({ passiveOverrides: { Insight: 0 } }), 'Insight') === 0)
}

/* ------------------------------------------------------------ spellcasting */

{
  const c = sheet({ level: 5, abilities: { ...blankSheet().abilities, cha: 18 }, spellAbility: 'cha' })
  check('spell save DC is 8 + prof + mod', spellSaveDc(c) === 15, String(spellSaveDc(c)))
  check('spell attack is prof + mod', spellAttackBonus(c) === 7, String(spellAttackBonus(c)))
}
check('a non-caster has no DC', spellSaveDc(sheet()) === null)
check('and no spell attack', spellAttackBonus(sheet()) === null)

/* ------------------------------------------------------------ initiative */

check('initiative is the DEX modifier', initiativeMod(sheet({ abilities: { ...blankSheet().abilities, dex: 18 } })) === 4)

/* ------------------------------------------------------------ shape */

check('every skill maps to an ability', SKILLS.every((s) => typeof skillMod(sheet(), s) === 'number'))
check('there are eighteen skills', SKILLS.length === 18, String(SKILLS.length))
check('there are six abilities', ABILITIES.length === 6)
check('the three passives are the ones a DM reads', PASSIVE_SKILLS.join() === 'Perception,Investigation,Insight')

/* ------------------------------------------------------------ tolerance */

// A roster written before these fields existed must open, not explode.
{
  const old = normaliseSheet({ race: 'Elf' })
  check('missing fields default', old.abilities.str === 10 && old.speed === 30)
  check('the field that was there survives', old.race === 'Elf')
  check('lists default to empty', Array.isArray(old.skillProfs) && old.skillProfs.length === 0)
}
check('undefined normalises to a blank sheet', normaliseSheet(undefined).abilities.cha === 10)
{
  const junk = normaliseSheet({ skillProfs: 'not an array', saveProfs: ['dex', 'nonsense'], attacks: null, abilities: { str: 18 } })
  check('a non-array skill list becomes an array', Array.isArray(junk.skillProfs) && junk.skillProfs.length === 0)
  check('an unknown save key is dropped', junk.saveProfs.join() === 'dex', junk.saveProfs.join())
  check('a null attack list becomes an array', Array.isArray(junk.attacks))
  check('a partial ability block is filled in', junk.abilities.str === 18 && junk.abilities.dex === 10)
}

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
