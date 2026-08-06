/**
 * 5etools → Kâhin conversion.
 *
 * Weighted towards the markup, because that is what decides whether an
 * imported stat block is usable prose or a wall of braces. Fixtures are copied
 * verbatim from TheGiddyLimit/homebrew rather than invented, so the shapes
 * being asserted are the ones that actually ship.
 */
import {
  stripTags,
  flattenEntries,
  isFiveToolsFile,
  convertFiveTools,
  parseCatalogue,
  rawUrlFor,
  toRawUrl,
} from '../src/lib/fivetools.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

/* ------------------------------------------------------------------ markup */

// The line every stat block opens with, straight out of Tome of Beasts 2.
check(
  'an attack line reads as prose',
  stripTags('{@atk mw} {@hit +8} to hit, reach 5 ft., one target. {@h}12 ({@damage 2d6 + 5}) piercing damage.') ===
    'Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) piercing damage.',
  stripTags('{@atk mw} {@hit +8} to hit, reach 5 ft., one target. {@h}12 ({@damage 2d6 + 5}) piercing damage.'),
)

// Both spellings appear across the collection; only the bare one wants a sign.
check('a signed hit bonus is left alone', stripTags('{@hit +8} to hit') === '+8 to hit', stripTags('{@hit +8} to hit'))
check('a bare hit bonus gains its sign', stripTags('{@hit 8} to hit') === '+8 to hit', stripTags('{@hit 8} to hit'))
check('a negative hit bonus keeps its sign', stripTags('{@hit -1}') === '-1')

check('a DC is spelled out', stripTags('a {@dc 15} save') === 'a DC 15 save')
check('a ranged attack is named', stripTags('{@atk rw}') === 'Ranged Weapon Attack:')
check('two attack kinds are joined', stripTags('{@atk mw,rw}') === 'Melee Weapon Attack or Ranged Weapon Attack:')
check('a recharge is expanded', stripTags('{@recharge 5}') === '(Recharge 5–6)')
check('a recharge on 6 does not read 6-6', stripTags('{@recharge 6}') === '(Recharge 6)')

// `content|source|display`: the source is noise, the display wins.
check('a cross-reference drops its source', stripTags('the {@creature akaasit|ToB2} lunges') === 'the akaasit lunges')
check('a display name wins', stripTags('{@spell fireball|PHB|fire ball}') === 'fire ball')
check('a condition becomes its word', stripTags('the target is {@condition prone}') === 'the target is prone')
check('nested tags resolve', stripTags('{@damage {@dice 1d6}}') === '1d6')
check('plain text is untouched', stripTags('no markup here') === 'no markup here')
check('an unknown tag still yields its content', stripTags('{@wibble something}') === 'something')

/* ------------------------------------------------------------------ entries */

check('a string entry passes through', flattenEntries(['One.', 'Two.']) === 'One.\nTwo.')
check(
  'a named block becomes a sentence',
  flattenEntries([{ type: 'entries', name: 'Fear of Fire', entries: ['It is afraid.'] }]) === 'Fear of Fire. It is afraid.',
)
check('a list is flattened', flattenEntries([{ type: 'list', items: ['a', 'b'] }]) === 'a\nb')
check(
  'a table keeps its rows, not just its caption',
  flattenEntries([{ type: 'table', caption: 'Loot', rows: [['1', 'a sword']] }]) === 'Loot\n1 — a sword',
)
check('null is empty, not a crash', flattenEntries(null) === '')
check('deep nesting terminates', typeof flattenEntries({ entries: [{ entries: [{ entries: ['deep'] }] }] }) === 'string')

/* ------------------------------------------------------------------ detect */

check('a 5etools file is recognised by its collections', isFiveToolsFile({ monster: [] }))
check('and by its _meta', isFiveToolsFile({ _meta: { sources: [] } }))
check('our own pack is not one', !isFiveToolsFile({ format: 'kahin-brew/1', monsters: [] }))
check('an array is not one', !isFiveToolsFile([{ monster: [] }]))
check('null is not one', !isFiveToolsFile(null))

/* ------------------------------------------------------------------ monster */

const FILE = {
  _meta: { sources: [{ full: 'Tome of Beasts 2', abbreviation: 'ToB2' }] },
  monster: [
    {
      name: 'A-mi-kuk',
      size: ['H'],
      type: 'aberration',
      alignment: ['C', 'E'],
      ac: [{ from: ['natural armor'], ac: 14 }],
      hp: { average: 115, formula: '10d12 + 50' },
      speed: { swim: 40, burrow: 20, walk: 30 },
      str: 21, dex: 8, con: 20, int: 7, wis: 14, cha: 10,
      save: { dex: '+3', con: '+9' },
      skill: { athletics: '+10', perception: '+5' },
      senses: ['darkvision 60 ft.'],
      passive: 15,
      languages: ["understands Common but can't speak"],
      resist: ['cold'],
      immune: [{ immune: ['poison'], note: 'from its slime' }],
      conditionImmune: ['poisoned'],
      cr: '7',
      trait: [{ name: 'Hold Breath', entries: ['It can hold its breath for 30 minutes.'] }],
      action: [{ name: 'Bite', entries: ['{@atk mw} {@hit +8} to hit, reach 5 ft. {@h}12 ({@damage 2d6 + 5}) piercing damage.'] }],
      legendary: [{ name: 'Claw', entries: ['It attacks once.'] }],
      environment: ['arctic'],
    },
  ],
}

const { pack, warnings } = convertFiveTools(FILE, 'yedek')
const m = pack.monsters[0]

check('the pack takes its name from _meta, not the filename', pack.name === 'Tome of Beasts 2', pack.name)
check('the abbreviation becomes the author', pack.author === 'ToB2')
check('size codes decode', m.size === 'Huge', m.size)
check('alignment codes decode', m.alignment === 'chaotic evil', m.alignment)
check('AC comes out of its wrapper', m.armor_class === 14)
check('and its source becomes the note', m.armor_desc === 'natural armor', m.armor_desc)
check('HP splits into points and dice', m.hit_points === 115 && m.hit_dice === '10d12 + 50')
check('speed survives as an object', m.speed.swim === 40 && m.speed.walk === 30)
check('abilities map to their long names', m.strength === 21 && m.charisma === 10)
check('saves are parsed as numbers', m.constitution_save === 9 && m.dexterity_save === 3)
check('a save that was not listed stays null', m.wisdom_save === null)
check('skills lose their plus signs', m.skills.athletics === 10 && m.skills.perception === 5)
check('passive perception joins the senses', /passive Perception 15/.test(m.senses), m.senses)
check('and becomes a perception bonus', m.perception === 5)
check('languages flatten to a string', m.languages === "understands Common but can't speak")
check('a plain resistance list reads normally', m.damage_resistances === 'cold')
check('an annotated immunity keeps its note', m.damage_immunities === 'poison from its slime', m.damage_immunities)
check('condition immunities carry over', m.condition_immunities === 'poisoned')
check('CR is kept as written and as a number', m.challenge_rating === '7' && m.cr === 7)
check('traits become special abilities', m.special_abilities[0].name === 'Hold Breath')
check('actions carry resolved prose', m.actions[0].desc.startsWith('Melee Weapon Attack: +8 to hit'), m.actions[0].desc)
check('legendary actions carry over', m.legendary_actions[0].name === 'Claw')
check('environments carry over', m.environments[0] === 'arctic')
check('it is marked as homebrew', m.homebrew === true)
check('nothing to warn about in a clean file', warnings.length === 0, JSON.stringify(warnings))

// Fractional CRs are the ones an ordinary Number() gets wrong.
{
  const { pack: p } = convertFiveTools({ monster: [{ name: 'Rat', cr: '1/8' }] })
  check('a fractional CR becomes a fraction', p.monsters[0].cr === 0.125, String(p.monsters[0].cr))
}

// HP given in prose must not be turned into an invented number.
{
  const { pack: p, warnings: w } = convertFiveTools({
    monster: [{ name: 'Echo', hp: { special: "equal to its master's" } }],
  })
  check('prose HP yields 0 rather than a guess', p.monsters[0].hit_points === 0)
  check('and the text is kept', /master/.test(p.monsters[0].hit_dice))
  check('and it is warned about', w.length === 1, JSON.stringify(w))
}

check('an unnamed monster is skipped', convertFiveTools({ monster: [{ cr: '1' }] }).pack.monsters.length === 0)

/* ------------------------------------------------------------------ spell */

const { pack: sp } = convertFiveTools({
  spell: [
    {
      name: "Appledrab's Candle-click",
      level: 1,
      school: 'V',
      time: [{ number: 1, unit: 'minute' }],
      range: { type: 'point', distance: { type: 'touch' } },
      components: { v: true, s: true, m: 'a candle' },
      duration: [{ type: 'timed', duration: { type: 'hour', amount: 8 } }],
      meta: { ritual: true },
      entries: ['It lights a {@item candle}.'],
      classes: { fromClassList: [{ name: 'Wizard' }] },
    },
    { name: 'Held Light', level: 0, school: 'V', duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 1 } }] },
  ],
})

check('school codes decode', sp.spells[0].school === 'Evocation')
check('level 1 reads as an ordinal', sp.spells[0].level === '1st-level')
check('a cantrip is not "0th-level"', sp.spells[1].level === 'Cantrip')
check('casting time reads naturally', sp.spells[0].casting_time === '1 minute', sp.spells[0].casting_time)
check('range decodes', sp.spells[0].range === 'touch', sp.spells[0].range)
check('components become letters', sp.spells[0].components === 'V, S, M')
check('the material is split out', sp.spells[0].material === 'a candle')
check('duration reads naturally', sp.spells[0].duration === '8 hours', sp.spells[0].duration)
check('ritual is flagged', sp.spells[0].ritual === 'yes')
check('concentration is detected', sp.spells[1].concentration === 'yes')
check('and is not invented', sp.spells[0].concentration === 'no')
check('the class list carries over', sp.spells[0].dnd_class === 'Wizard')
check('spell text is de-tagged', sp.spells[0].desc === 'It lights a candle.', sp.spells[0].desc)

/* ------------------------------------------------------------------ item */

const { pack: ip } = convertFiveTools({
  item: [{ name: 'Akaasit Blade', type: 'M|XPHB', rarity: 'rare', reqAttune: true, entries: ['A {@damage 1d4} dagger.'] }],
  baseitem: [{ name: 'Rope', type: 'G' }],
})

check('item type codes decode', ip.items[0].type === 'Melee weapon', ip.items[0].type)
check('a source suffix on the type is ignored', !ip.items[0].type.includes('XPHB'))
check('attunement is spelled out', ip.items[0].requires_attunement === 'requires attunement')
check('item text is de-tagged', ip.items[0].desc === 'A 1d4 dagger.', ip.items[0].desc)
check('base items are imported too', ip.items.length === 2)

/* ------------------------------------------------------------------ catalogue */

const CAT = {
  monster: { 'creature/Kobold Press; Tome of Beasts 2.json': 'h1', 'adventure/Some; Adventure.json': 'h2' },
  spell: { 'spell/AD Feltham; Rituals.json': 'h3' },
  feat: { 'feat/Nothing We Can Use.json': 'h4' },
}
const cat = parseCatalogue(CAT)

check('every importable file is listed once', cat.length === 3, String(cat.length))
check('files we cannot use are left out', !cat.some((f) => f.path.startsWith('feat/')))
check('a file lists what it holds', cat.find((f) => f.path.startsWith('spell/'))?.kinds[0] === 'spell')
check('the listing is sorted', cat[0].path < cat[1].path)
check('an empty index is not a crash', parseCatalogue({}).length === 0 && parseCatalogue(null).length === 0)

/* ------------------------------------------------------------------ urls */

check(
  'spaces and semicolons in paths are encoded',
  rawUrlFor('creature/Kobold Press; Tome of Beasts 2.json').endsWith('creature/Kobold%20Press%3B%20Tome%20of%20Beasts%202.json'),
  rawUrlFor('creature/Kobold Press; Tome of Beasts 2.json'),
)
check('slashes are not encoded away', rawUrlFor('a/b.json').includes('/a/b.json'))
check(
  'a github page link is rewritten to raw',
  toRawUrl('https://github.com/TheGiddyLimit/homebrew/blob/master/creature/x.json') ===
    'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/creature/x.json',
  toRawUrl('https://github.com/TheGiddyLimit/homebrew/blob/master/creature/x.json'),
)
check('a raw link is left alone', toRawUrl('https://raw.githubusercontent.com/a/b/master/c.json') === 'https://raw.githubusercontent.com/a/b/master/c.json')
check('someone else’s URL is left alone', toRawUrl('https://example.com/pack.json') === 'https://example.com/pack.json')

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
