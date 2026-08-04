/**
 * 5etools → internal shape normalisation.
 *
 * 5etools stores rules text in a tag language over nested entry trees, and a
 * quarter of the bestiary is defined as a diff against another statblock.
 * A silent mistake in either would put a wrong AC — or an empty action list —
 * in front of the table, so both get exercised against verbatim captures of
 * 5etools' own records.
 */
import {
  stripTags, entriesToText, slugify, docSlug, dedupeSlugs,
  convertMonster, convertSpell, convertItem, convertRule,
  applyCopy, convertBrew,
} from '../src/lib/fivetools-convert.mjs'
import { parsePack } from '../src/lib/homebrew.ts'
import { splitScope } from '../src/lib/live.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

/* ------------------------------------------------------------------ tags */

check(
  'attack line reads like the printed page',
  stripTags('{@atk mw} {@hit 4} to hit, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) slashing damage.') ===
    '_Melee Weapon Attack:_ +4 to hit, reach 5 ft. **Hit:** 5 (1d6 + 2) slashing damage.',
  stripTags('{@atk mw} {@hit 4} to hit, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) slashing damage.'),
)
check('negative hit bonus keeps its sign', stripTags('{@hit -1} to hit') === '-1 to hit')
check('save DC spelled out', stripTags('{@dc 15} Dexterity') === 'DC 15 Dexterity')
check('recharge range expanded', stripTags('{@recharge 5}') === '(Recharge 5–6)')
check('bare recharge is 6', stripTags('{@recharge}') === '(Recharge 6)')
check('cross-reference keeps its display text', stripTags('{@spell fireball|phb|fire ball}') === 'fire ball')
check('cross-reference without display falls back to the name', stripTags('{@condition prone}') === 'prone')
check('deity display sits one slot further along', stripTags('{@deity Torm|Faerûnian|SCAG|the Loyal Fury}') === 'the Loyal Fury')
check('quickref display sits at the end', stripTags('{@quickref Cover||3||total cover}') === 'total cover')
check('quickref without display falls back to the name', stripTags('{@quickref Multiclassing|PHB}') === 'Multiclassing')
check('scaling damage shows the per-level die', stripTags('{@scaledamage 8d6|3-9|1d6}') === '1d6')
check('dice display override wins', stripTags('{@dice 1d6|d6}') === 'd6')
check('emphasis becomes RichText markup', stripTags('{@b bold} and {@i italic}') === '**bold** and _italic_')
check(
  'nested tags collapse from the inside out',
  stripTags('{@b outer {@i inner} tail}') === '**outer _inner_ tail**',
  stripTags('{@b outer {@i inner} tail}'),
)
check('unbalanced braces are not swallowed', stripTags('{@damage 1d6').includes('1d6'))
check('untagged text is returned untouched', stripTags('plain text') === 'plain text')
check('2024 save line', stripTags('{@actSave dex} {@actSaveDc 13}') === '_Dexterity Saving Throw:_ DC 13')
check('unknown tags degrade to their first argument', stripTags('{@newtag hello|world}') === 'hello')

/* --------------------------------------------------------------- entries */

check(
  'nested entry names become bold leads',
  entriesToText([{ type: 'entries', name: 'Trait', entries: ['body'] }]) === '**Trait.** body',
  entriesToText([{ type: 'entries', name: 'Trait', entries: ['body'] }]),
)
check('lists become bulleted lines', entriesToText([{ type: 'list', items: ['a', 'b'] }]) === '• a\n• b')
check(
  'tables keep their header and rows',
  entriesToText([{ type: 'table', colLabels: ['d6', 'Result'], rows: [['1', 'nothing']] }]) === 'd6 · Result\n1 · nothing',
)
check('images contribute nothing', entriesToText([{ type: 'image', href: {} }, 'kept']) === 'kept')

/* -------------------------------------------------------------- monsters */

const GOBLIN = {
  name: 'Goblin', source: 'MM', size: ['S'],
  type: { type: 'humanoid', tags: ['goblinoid'] },
  alignment: ['N', 'E'],
  ac: [{ ac: 15, from: ['{@item leather armor|phb}', '{@item shield|phb}'] }],
  hp: { average: 7, formula: '2d6' },
  speed: { walk: 30 },
  str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
  skill: { stealth: '+6' },
  senses: ['darkvision 60 ft.'],
  passive: 9,
  languages: ['Common', 'Goblin'],
  cr: '1/4',
  trait: [{ name: 'Nimble Escape', entries: ['Takes {@action Disengage} or {@action Hide} as a bonus action.'] }],
  action: [
    { name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] },
  ],
  environment: ['forest'],
}

const g = convertMonster(GOBLIN, { sourceTitle: 'Monster Manual' })
check('slug carries the source, since names repeat across books', g.slug === 'goblin_mm')
check('size abbreviation expanded', g.size === 'Small')
check('type and tags split', g.type === 'humanoid' && g.subtype === 'goblinoid')
check('alignment letters expanded', g.alignment === 'neutral evil', `got "${g.alignment}"`)
check('AC unwrapped from the array', g.armor_class === 15)
check('worn armor listed by name, tags stripped', g.armor_desc === 'leather armor, shield', `got "${g.armor_desc}"`)
check('hit dice kept for the HP roll button', g.hit_dice === '2d6')
check('skill bonus parsed to a number', g.skills.stealth === 6)
check('passive Perception folded into senses', g.senses === 'darkvision 60 ft., passive Perception 9', `got "${g.senses}"`)
check('fractional CR converted', g.cr === 0.25 && g.challenge_rating === '1/4')
check('traits land in special abilities', g.special_abilities[0].name === 'Nimble Escape')
check('action damage dice lifted for the roll button', g.actions[0].damage_dice === '1d6+2')
check('attack bonus lifted', g.actions[0].attack_bonus === 4)
check('empty sections stay null', g.reactions === null)
check('document slug namespaced away from Open5e', g.document__slug === '5et-mm')
check('provenance recorded', g.source === '5etools')

const DRAGON = convertMonster({
  name: 'Adult Red Dragon', source: 'MM', size: ['H'], type: 'dragon',
  alignment: ['C', 'E'],
  ac: [{ ac: 19, from: ['natural armor'] }],
  hp: { average: 256, formula: '19d12+133' },
  speed: { walk: 40, climb: 40, fly: 80 },
  str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21,
  save: { dex: '+6', con: '+13' },
  skill: { perception: '+13' },
  immune: ['fire'],
  conditionImmune: ['charmed'],
  cr: '17',
  legendary: [{ name: 'Detect', entries: ['The dragon makes a Wisdom (Perception) check.'] }],
  legendaryActions: 3,
})

check('multiple speeds preserved', DRAGON.speed.walk === 40 && DRAGON.speed.climb === 40 && DRAGON.speed.fly === 80)
check('saves parsed', DRAGON.dexterity_save === 6 && DRAGON.constitution_save === 13)
check('saves are not misfiled as skills', DRAGON.skills.perception === 13 && !('dex' in DRAGON.skills))
check('immunities joined', DRAGON.damage_immunities === 'fire' && DRAGON.condition_immunities === 'charmed')
check('integer CR', DRAGON.cr === 17)
check('legendary actions mapped', DRAGON.legendary_actions[0].name === 'Detect')
// 5etools leaves the standard intro implicit and lets its renderer supply it.
check('legendary intro synthesised when the data omits it', DRAGON.legendary_desc.includes('3 legendary actions'), DRAGON.legendary_desc)

const CONDITIONAL = convertMonster({
  name: 'Werewolf', source: 'MM', size: ['M'], type: 'humanoid', alignment: ['C', 'E'],
  ac: [{ ac: 11, condition: 'in humanoid form' }, { ac: 12, condition: 'in wolf form' }],
  hp: { average: 58, formula: '9d8+18' }, speed: { walk: 30 },
  str: 15, dex: 13, con: 14, int: 10, wis: 11, cha: 10,
  immune: [{ immune: ['bludgeoning', 'piercing', 'slashing'], note: 'from nonmagical attacks not made with silvered weapons' }],
  cr: '3',
})
check('alternate AC kept as a note', CONDITIONAL.armor_desc.includes('12'), CONDITIONAL.armor_desc)
check(
  'conditional immunity keeps its qualifier',
  CONDITIONAL.damage_immunities === 'bludgeoning, piercing, slashing from nonmagical attacks not made with silvered weapons',
  CONDITIONAL.damage_immunities,
)

const CASTER = convertMonster({
  name: 'Mage', source: 'MM', size: ['M'], type: 'humanoid', alignment: ['A'],
  ac: [12], hp: { average: 40, formula: '9d8' }, speed: { walk: 30 },
  str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11, cr: '6',
  spellcasting: [{
    name: 'Spellcasting',
    headerEntries: ['The mage is a 9th-level spellcaster.'],
    will: ['{@spell mage hand}'],
    daily: { '1e': ['{@spell fireball}'] },
    spells: { 0: { spells: ['{@spell fire bolt}'] }, 3: { slots: 3, spells: ['{@spell counterspell}'] } },
  }],
})
const sc = CASTER.special_abilities.find((s) => s.name === 'Spellcasting')
check('spellcasting becomes a readable trait', !!sc && sc.desc.includes('9th-level spellcaster'))
check('at-will spells listed', sc.desc.includes('**At will:** mage hand'), sc.desc)
check('per-day counters expanded', sc.desc.includes('**1/day each:** fireball'), sc.desc)
check('slot levels labelled', sc.desc.includes('**Level 3 (3 slots):** counterspell'), sc.desc)
check('cantrips labelled', sc.desc.includes('**Cantrips (at will):** fire bolt'), sc.desc)

/* ---------------------------------------------------------------- spells */

const FIREBALL = convertSpell({
  name: 'Fireball', source: 'PHB', level: 3, school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 150 } },
  components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
  duration: [{ type: 'instant' }],
  entries: ['A target takes {@damage 8d6} fire damage.'],
  entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['Increases by {@scaledamage 8d6|3-9|1d6}.'] }],
}, { sourceTitle: 'Player’s Handbook', classes: ['Sorcerer', 'Wizard'] })

check('spell description tags stripped', FIREBALL.desc === 'A target takes 8d6 fire damage.', FIREBALL.desc)
check('higher-level text drops the duplicated heading', FIREBALL.higher_level === 'Increases by 1d6.', FIREBALL.higher_level)
check('range formatted', FIREBALL.range === '150 feet', FIREBALL.range)
check('components joined', FIREBALL.components === 'V, S, M')
check('material component lifted', FIREBALL.material === 'a tiny ball of bat guano and sulfur')
check('school abbreviation expanded', FIREBALL.school === 'Evocation')
check('level ordinal derived', FIREBALL.level === '3rd-level' && FIREBALL.level_int === 3)
check('classes stitched back on', FIREBALL.dnd_class === 'Sorcerer, Wizard')
check('non-concentration spell', FIREBALL.concentration === 'no' && FIREBALL.ritual === 'no')

const HASTE = convertSpell({
  name: 'Haste', source: 'PHB', level: 3, school: 'T',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 30 } },
  components: { v: true, s: true },
  duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
  meta: { ritual: true },
  entries: ['Target gains speed.'],
})
check('concentration detected', HASTE.concentration === 'yes')
check('ritual detected', HASTE.ritual === 'yes')
check('timed duration formatted', HASTE.duration === '1 minute', HASTE.duration)

const CANTRIP = convertSpell({ name: 'Fire Bolt', source: 'PHB', level: 0, school: 'V', entries: [] })
check('level 0 reads as cantrip', CANTRIP.level === 'cantrip')

const SELF_AREA = convertSpell({
  name: 'Burning Hands', source: 'PHB', level: 1, school: 'V',
  range: { type: 'cone', distance: { type: 'feet', amount: 15 } }, entries: [],
})
check('area range names the shape', SELF_AREA.range === 'Self (15 feet cone)', SELF_AREA.range)

/* ----------------------------------------------------------------- items */

const BAG = convertItem({
  name: 'Bag of Holding', source: 'DMG', rarity: 'uncommon', wondrous: true, weight: 15,
  entries: ['Holds {@dice 500} pounds.'],
}, { sourceTitle: 'Dungeon Master’s Guide' })
check('wondrous items typed', BAG.type === 'Wondrous item', BAG.type)
check('item text stripped', BAG.desc.startsWith('Holds 500 pounds.'))
check('weight appended', BAG.desc.includes('**Weight:** 15 lb.'))
check('rarity preserved', BAG.rarity === 'uncommon')

const SWORD = convertItem({ name: '+1 Longsword', source: 'DMG', rarity: 'uncommon', type: 'M|phb', reqAttune: true, entries: [] })
check('weapon type code expanded', SWORD.type === 'Melee weapon', SWORD.type)
check('attunement flagged', SWORD.requires_attunement === 'yes')

const ROPE = convertItem({ name: 'Rope, Hempen (50 feet)', source: 'PHB', type: 'G|phb', rarity: 'none', entries: [] })
check('mundane gear is not dressed up as magic', ROPE.rarity === 'mundane' && ROPE.type === 'Adventuring gear')

// Generated variants leave `entries` empty and carry the inherited text in
// `_fullEntries`, wrapped in renderer metadata. Reading the wrong one gives a
// magic weapon with no description at all.
const VARIANT = convertItem({
  name: '+2 Longsword', source: 'DMG', rarity: 'rare', type: 'M|phb',
  dmg1: '1d8', dmg2: '1d10', dmgType: 'S', weight: 3, bonusWeapon: '+2',
  entries: [],
  _fullEntries: [
    'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
    { type: 'wrapper', wrapped: { type: 'entries', name: 'Versatile', entries: ['One or two hands.'] }, data: {} },
  ],
})
check('generated variant recovers its inherited text', VARIANT.desc.startsWith('You have a +2 bonus'), VARIANT.desc)
check('wrapper metadata unwrapped', VARIANT.desc.includes('**Versatile.** One or two hands.'), VARIANT.desc)
check('damage line built from the stat fields', VARIANT.desc.includes('**Damage:** 1d8 (1d10) slashing'), VARIANT.desc)
check('magic bonus surfaced', VARIANT.desc.includes('**Bonus:** +2'))

const SHIELD = convertItem({ name: 'Shield', source: 'PHB', type: 'S|phb', rarity: 'none', ac: 2, value: 1000, entries: [] })
check('armour class surfaced', SHIELD.desc.includes('**AC:** 2'), SHIELD.desc)
check('copper value shown in gold', SHIELD.desc.includes('**Value:** 10 gp'), SHIELD.desc)

/* ----------------------------------------------------------------- slugs */

// "Arrow of Slaying" and its variant template "Arrow of Slaying (*)" both
// reduce to the same token; slugs address records for hydration, so a
// collision would open the wrong item.
const collided = dedupeSlugs([
  { slug: 'arrow-of-slaying_dmg' },
  { slug: 'arrow-of-slaying_dmg' },
  { slug: 'arrow-of-slaying_dmg' },
  { slug: 'other_dmg' },
])
check(
  'collisions are numbered, first occurrence keeps the plain slug',
  collided.map((c) => c.slug).join(',') === 'arrow-of-slaying_dmg,arrow-of-slaying_dmg-2,arrow-of-slaying_dmg-3,other_dmg',
  collided.map((c) => c.slug).join(','),
)

/* ----------------------------------------------------------------- rules */

const GRAPPLED = convertRule(
  { name: 'Grappled', source: 'XPHB', entries: ['Your {@variantrule Speed|XPHB} is 0.'] },
  { kind: 'condition', sourceTitle: 'Player’s Handbook (2024)' },
)
check('rule kind carried', GRAPPLED.kind === 'condition')
check('rule text stripped', GRAPPLED.desc === 'Your Speed is 0.', GRAPPLED.desc)

/* ------------------------------------------------------------------ copy */

const POOL = [
  GOBLIN,
  {
    name: 'Goblin Boss', source: 'MM',
    _copy: {
      name: 'Goblin', source: 'MM',
      _mod: {
        action: [
          { mode: 'replaceArr', replace: 'Scimitar', items: { name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] } },
          { mode: 'appendArr', items: { name: 'Redirect Attack', entries: ['Swaps places with a goblin.'] } },
        ],
        trait: { mode: 'removeArr', names: 'Nimble Escape' },
      },
    },
    hp: { average: 21, formula: '6d6' },
    cr: '1',
  },
]

const boss = applyCopy(POOL[1], POOL)
check('copy inherits the parent statline', boss.str === 8 && boss.dex === 14)
check('own fields override the parent', boss.hp.average === 21 && boss.cr === '1')
check(
  'replaceArr swaps in place rather than appending',
  boss.action[0].name === 'Scimitar' && boss.action[0].entries[0].includes('to hit. ') && boss.action.length === 2,
  JSON.stringify(boss.action.map((a) => a.name)),
)
check('appendArr adds at the end', boss.action[boss.action.length - 1].name === 'Redirect Attack')
check('removeArr drops by name', !(boss.trait ?? []).some((t) => t.name === 'Nimble Escape'))
check('copy marker consumed', boss._copy === undefined)
check('parent left untouched', POOL[0].hp.average === 7 && POOL[0].trait.length === 1)

const orphan = applyCopy({ name: 'Nobody', source: 'X', _copy: { name: 'Missing', source: 'Y' }, cr: '1' }, [])
check('an unresolvable copy still yields a record', orphan.name === 'Nobody' && orphan._copy === undefined)

/* ------------------------------------------------------------------ brew */

const BREW = {
  _meta: { sources: [{ json: 'MyBrew', abbreviation: 'MB', full: 'My Brew Book', authors: ['Someone'] }] },
  monster: [{ name: 'Tavern Cat', source: 'MyBrew', size: ['T'], type: 'beast', alignment: ['U'], ac: [12], hp: { average: 3, formula: '1d4' }, speed: { walk: 40 }, str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7, cr: '0' }],
  spell: [{ name: 'Cantrip of Naps', source: 'MyBrew', level: 0, school: 'E', entries: ['You nap.'] }],
  item: [{ name: 'Mug of Plenty', source: 'MyBrew', rarity: 'common', wondrous: true, entries: ['Refills.'] }],
  condition: [{ name: 'Tipsy', source: 'MyBrew', entries: ['Disadvantage on everything fun.'] }],
}

const brew = convertBrew(BREW)
check('brew names itself from _meta', brew.name === 'My Brew Book')
check('brew author read', brew.author === 'Someone')
check('brew monster converted and flagged', brew.monsters[0].name === 'Tavern Cat' && brew.monsters[0].homebrew === true)
check('brew spell converted', brew.spells[0].name === 'Cantrip of Naps')
check('brew item converted', brew.items[0].name === 'Mug of Plenty')
check('brew rules converted', brew.rules[0].kind === 'condition')
check('brew books get their own document slug', brew.monsters[0].document__slug === docSlug('MyBrew'))
check('brew book title used for attribution', brew.monsters[0].document__title === 'My Brew Book')

let threw = false
try {
  convertBrew(null)
} catch {
  threw = true
}
check('non-object input rejected', threw)

/* ------------------------------------------------- brew import detection */

// The Forge accepts one file input for both formats, so misreading a 5etools
// brew as one of ours would silently import nothing.
const fromFive = parsePack(BREW, 'fallback')
check('5etools brew routed through the converter', fromFive.pack.monsters[0].name === 'Tavern Cat')
check('pack takes the brew book name', fromFive.pack.name === 'My Brew Book')
check('unsupported rule entries reported rather than dropped silently', fromFive.warnings.some((w) => w.includes('kural')))

const ownPack = parsePack({
  format: 'kahin-brew/1',
  name: 'Kendi Derlemem',
  monsters: [{ name: 'Ev Kedisi' }],
}, 'fallback')
check('our own format still takes the original path', ownPack.pack.monsters[0].name === 'Ev Kedisi' && ownPack.pack.name === 'Kendi Derlemem')

let rejected = false
try {
  parsePack({ format: 'kahin-brew/1', name: 'Boş' }, 'fallback')
} catch {
  rejected = true
}
check('an empty pack is still rejected', rejected)

/* ---------------------------------------------------------------- naming */

check('slug strips diacritics', slugify('Draeneï Wärrior', 'PHB') === 'draenei-warrior_phb', slugify('Draeneï Wärrior', 'PHB'))
// Turkish brew is the expected case here, and "ı"/"ş"/"ğ" do not decompose —
// left alone they collapse to dashes and two different names become one slug.
check('Turkish letters transliterate rather than vanish', slugify('Mırıltı Büyüsü', 'TB') === 'mirilti-buyusu_tb', slugify('Mırıltı Büyüsü', 'TB'))
check('names that differ only in Turkish letters keep different slugs', slugify('Sırık') !== slugify('Sarık'), `${slugify('Sırık')} vs ${slugify('Sarık')}`)
check('doc slug namespaced', docSlug('MM') === '5et-mm')

/* ----------------------------------------------------------------- scope */

// The book filter is one flat list mixing 5etools slugs with Open5e ones.
// Handing a source the whole list — or, worse, treating "none of my books are
// selected" as "no filter, search everything" — silently ignores the filter.
{
  const none = splitScope({})
  check('no filter queries both sides unrestricted', none.local.on && none.network.on && !none.local.documents && !none.network.documents)

  const mixed = splitScope({ documents: ['5et-mm', 'wotc-srd'] })
  check('mixed filter reaches both sides', mixed.local.on && mixed.network.on)
  check('each side gets only its own books', JSON.stringify(mixed.local.documents) === '["5et-mm"]' && JSON.stringify(mixed.network.documents) === '["wotc-srd"]')

  const localOnlyFilter = splitScope({ documents: ['5et-mm'] })
  check('filtering to 5etools books skips the network entirely', localOnlyFilter.local.on && !localOnlyFilter.network.on)

  const netOnlyFilter = splitScope({ documents: ['wotc-srd'] })
  check('filtering to Open5e books skips the local catalogue', !netOnlyFilter.local.on && netOnlyFilter.network.on)

  check('the catalogue toggle wins over the filter', !splitScope({ local: false }).local.on)
  const offline = splitScope({ localOnly: true })
  check('"yalnız yerel" drops the network side', offline.local.on && !offline.network.on)
}

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
