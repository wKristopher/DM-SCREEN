/**
 * dnd5eapi → internal shape normalisation.
 *
 * The two upstreams disagree on almost every nested field, so this is where
 * a silent mapping bug would turn into a wrong AC at the table. The fixture is
 * a verbatim capture of dnd5eapi.co's goblin and adult-red-dragon records.
 */
import { normalizeMonster, normalizeSpell } from '../src/lib/dnd5eapi.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

const GOBLIN = {
  index: 'goblin', name: 'Goblin', size: 'Small', type: 'humanoid', subtype: 'goblinoid',
  alignment: 'neutral evil',
  armor_class: [
    { type: 'armor', value: 15, armor: [{ index: 'leather-armor', name: 'Leather Armor' }, { index: 'shield', name: 'Shield' }] },
  ],
  hit_points: 7, hit_dice: '2d6', hit_points_roll: '2d6',
  speed: { walk: '30 ft.' },
  strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8,
  proficiencies: [{ value: 6, proficiency: { index: 'skill-stealth', name: 'Skill: Stealth' } }],
  damage_vulnerabilities: [], damage_resistances: [], damage_immunities: [],
  condition_immunities: [],
  senses: { darkvision: '60 ft.', passive_perception: 9 },
  languages: 'Common, Goblin',
  challenge_rating: 0.25,
  special_abilities: [{ name: 'Nimble Escape', desc: 'Disengage or Hide as a bonus action.', damage: [] }],
  actions: [
    {
      name: 'Scimitar',
      desc: 'Melee Weapon Attack: +4 to hit. Hit: 5 (1d6 + 2) slashing damage.',
      attack_bonus: 4,
      damage: [{ damage_type: { index: 'slashing', name: 'Slashing' }, damage_dice: '1d6+2' }],
    },
  ],
}

const DRAGON = {
  index: 'adult-red-dragon', name: 'Adult Red Dragon', size: 'Huge', type: 'dragon',
  alignment: 'chaotic evil',
  armor_class: [{ type: 'natural', value: 19 }],
  hit_points: 256, hit_dice: '19d12', hit_points_roll: '19d12+133',
  speed: { walk: '40 ft.', climb: '40 ft.', fly: '80 ft.' },
  strength: 27, dexterity: 10, constitution: 25, intelligence: 16, wisdom: 13, charisma: 21,
  proficiencies: [
    { value: 6, proficiency: { index: 'saving-throw-dex', name: 'Saving Throw: DEX' } },
    { value: 13, proficiency: { index: 'saving-throw-con', name: 'Saving Throw: CON' } },
    { value: 13, proficiency: { index: 'skill-perception', name: 'Skill: Perception' } },
  ],
  damage_vulnerabilities: [], damage_resistances: [], damage_immunities: ['fire'],
  condition_immunities: [{ index: 'charmed', name: 'Charmed' }],
  senses: { blindsight: '60 ft.', darkvision: '120 ft.', passive_perception: 23 },
  languages: 'Common, Draconic',
  challenge_rating: 17,
  legendary_actions: [{ name: 'Detect', desc: 'The dragon makes a Wisdom (Perception) check.', damage: [] }],
}

/* ------------------------------------------------------------- monsters */

const g = normalizeMonster(GOBLIN)
check('slug from index', g.slug === 'goblin')
check('AC unwrapped from array', g.armor_class === 15, `got ${g.armor_class}`)
check('worn armor listed by name, not "armor armor"', g.armor_desc === 'leather armor, shield', `got "${g.armor_desc}"`)
check('speed parsed to number', g.speed.walk === 30, `got ${JSON.stringify(g.speed)}`)
check('fractional CR preserved', g.cr === 0.25)
check('challenge_rating stringified', g.challenge_rating === '0.25')
check('skill proficiency mapped', g.skills.stealth === 6, JSON.stringify(g.skills))
check('senses object flattened', g.senses === 'darkvision 60 ft., passive Perception 9', `got "${g.senses}"`)
check('damage arrays joined', g.damage_immunities === '')
check('action damage dice lifted', g.actions[0].damage_dice === '1d6+2')
check('attack bonus preserved', g.actions[0].attack_bonus === 4)
check('special abilities mapped', g.special_abilities[0].name === 'Nimble Escape')
check('empty entry lists become null', g.reactions === null)
check('tagged as SRD document for dedupe', g.document__slug === 'wotc-srd')
check('provenance recorded', g.source === 'dnd5eapi')
check('hit_points_roll preferred over hit_dice', g.hit_dice === '2d6')

const d = normalizeMonster(DRAGON)
check('natural armor note', d.armor_desc === 'natural armor', `got "${d.armor_desc}"`)
check('multiple speeds parsed', d.speed.walk === 40 && d.speed.climb === 40 && d.speed.fly === 80)
check('DEX save mapped', d.dexterity_save === 6)
check('CON save mapped', d.constitution_save === 13)
check('saves are not misfiled as skills', d.skills.perception === 13 && !('dex' in d.skills))
check('condition immunities named', d.condition_immunities === 'Charmed')
check('damage immunities joined', d.damage_immunities === 'fire')
check('legendary actions mapped', d.legendary_actions[0].name === 'Detect')
check('integer CR', d.cr === 17 && d.challenge_rating === '17')
check('hit_points_roll wins when richer', d.hit_dice === '19d12+133')

/* ------------------------------------------------------------- spells */

const FIREBALL = {
  index: 'fireball', name: 'Fireball',
  desc: ['A bright streak flashes.', 'The fire spreads around corners.'],
  higher_level: ['Damage increases by 1d6.'],
  range: '150 feet', components: ['V', 'S', 'M'], material: 'A tiny ball of bat guano.',
  ritual: false, duration: 'Instantaneous', concentration: false, casting_time: '1 action',
  level: 3, school: { index: 'evocation', name: 'Evocation' },
  classes: [{ index: 'sorcerer', name: 'Sorcerer' }, { index: 'wizard', name: 'Wizard' }],
}

const sp = normalizeSpell(FIREBALL)
check('desc paragraphs joined', sp.desc.includes('bright streak') && sp.desc.includes('spreads around'))
check('higher_level joined', sp.higher_level === 'Damage increases by 1d6.')
check('components joined', sp.components === 'V, S, M')
check('boolean ritual → yes/no', sp.ritual === 'no')
check('boolean concentration → yes/no', sp.concentration === 'no')
check('numeric level kept', sp.level_int === 3)
check('level ordinal derived', sp.level === '3rd-level', `got "${sp.level}"`)
check('school unwrapped', sp.school === 'Evocation')
check('classes joined', sp.dnd_class === 'Sorcerer, Wizard')
check('spell provenance', sp.source === 'dnd5eapi')

const CANTRIP = { ...FIREBALL, index: 'fire-bolt', name: 'Fire Bolt', level: 0, concentration: true, ritual: true }
const c = normalizeSpell(CANTRIP)
check('level 0 → cantrip', c.level === 'cantrip')
check('concentration true → yes', c.concentration === 'yes')
check('ritual true → yes', c.ritual === 'yes')

const unarmored = normalizeMonster({ ...GOBLIN, armor_class: [{ type: 'dex', value: 12 }] })
check('dex-based AC gets no note', unarmored.armor_desc === '', `got "${unarmored.armor_desc}"`)

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
