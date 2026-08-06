/**
 * 5etools homebrew → Kâhin.
 *
 * The community homebrew collection at github.com/TheGiddyLimit/homebrew is the
 * largest pile of freely shared 5e content there is, and none of it is in a
 * shape this app understands. Different wrapper (`{monster: […]}`), different
 * field names (`ac`/`hp`/`cr` rather than `armor_class`/`hit_points`/
 * `challenge_rating`), coded values (`"H"` for Huge, `["C","E"]` for chaotic
 * evil), and prose written in a private markup language.
 *
 * That last part matters most. Left alone, an imported stat block reads
 * "{@atk mw} {@hit 8} to hit … {@h}18 ({@damage 3d8 + 5}) damage", which is
 * worse than not importing it. Resolving the tags is the difference between a
 * usable stat block and a wall of braces.
 *
 * Conversion is deliberately lossy in one direction only: fields we cannot
 * represent are dropped, never guessed. A monster with an odd `hp.special` gets
 * 0 hit points and says so, rather than being handed a number nobody rolled.
 */

import {
  emptyPack,
  blankMonster,
  blankSpell,
  blankItem,
  type BrewPack,
} from './homebrew'
import type { Monster, Spell, MagicItem, NamedEntry } from './open5e'

/* ------------------------------------------------------------------ markup */

const ATTACK_KINDS: Record<string, string> = {
  mw: 'Melee Weapon Attack',
  rw: 'Ranged Weapon Attack',
  ms: 'Melee Spell Attack',
  rs: 'Ranged Spell Attack',
  m: 'Melee Attack',
  r: 'Ranged Attack',
}

/**
 * Resolve 5etools' `{@tag …}` markup down to plain text.
 *
 * The general form is `{@tag content|source|display}`, where the last segment
 * wins if present and the source is noise for our purposes. A handful of tags
 * are not names at all but shorthand that has to be expanded, or the sentence
 * loses its verb.
 */
export function stripTags(input: string): string {
  let text = input
  // Innermost first, since tags nest: {@damage {@dice 1d6}}.
  for (let guard = 0; guard < 12 && /\{@/.test(text); guard++) {
    text = text.replace(/\{@(\w+)(?:\s+([^{}]*))?\}/g, (_, tag: string, body = '') => {
      const parts = String(body).split('|')
      const first = parts[0]?.trim() ?? ''
      const display = parts.length > 2 ? parts[parts.length - 1].trim() : ''

      switch (tag) {
        case 'atk':
          return first
            .split(',')
            .map((k) => ATTACK_KINDS[k.trim()] ?? k.trim())
            .join(' or ') + ':'
        case 'h':
          return 'Hit: '
        case 'hit':
          // Written both ways in the wild: {@hit 8} and {@hit +8}. Only the
          // bare form wants a sign, or attack lines read "++8 to hit".
          return /^[+-]/.test(first) ? first : `+${first}`
        case 'dc':
          return `DC ${first}`
        case 'recharge':
          return first ? `(Recharge ${first}${first === '6' ? '' : '–6'})` : '(Recharge 6)'
        case 'chance':
          return `${first} percent`
        case 'note':
        case 'i':
        case 'b':
        case 'style':
          return display || first
        default:
          return display || first
      }
    })
  }
  return text.replace(/\s+/g, ' ').trim()
}

interface EntryObj {
  type?: string
  name?: string
  entries?: unknown[]
  items?: unknown[]
  entry?: unknown
  rows?: unknown[]
  caption?: string
}

/** Flatten 5etools' recursive entry trees into paragraphs of plain text. */
export function flattenEntries(entries: unknown, depth = 0): string {
  if (entries == null || depth > 8) return ''
  if (typeof entries === 'string') return stripTags(entries)
  if (typeof entries === 'number' || typeof entries === 'boolean') return String(entries)

  if (Array.isArray(entries)) {
    return entries
      .map((e) => flattenEntries(e, depth + 1))
      .filter(Boolean)
      .join('\n')
  }

  const o = entries as EntryObj
  const parts: string[] = []

  if (o.type === 'table') {
    // A table's rows carry the useful content; the caption alone would lose it.
    if (o.caption) parts.push(stripTags(o.caption))
    for (const row of o.rows ?? []) {
      const cells = Array.isArray(row) ? row : [row]
      parts.push(cells.map((c) => flattenEntries(c, depth + 1)).filter(Boolean).join(' — '))
    }
    return parts.filter(Boolean).join('\n')
  }

  const body = [
    flattenEntries(o.entries, depth + 1),
    flattenEntries(o.items, depth + 1),
    flattenEntries(o.entry, depth + 1),
  ]
    .filter(Boolean)
    .join('\n')

  if (o.name) return body ? `${stripTags(o.name)}. ${body}` : stripTags(o.name)
  return body
}

/** 5etools' `{name, entries}` blocks become the app's `{name, desc}` pairs. */
function namedEntries(list: unknown): NamedEntry[] {
  if (!Array.isArray(list)) return []
  const out: NamedEntry[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as EntryObj
    const name = typeof e.name === 'string' ? stripTags(e.name) : ''
    const desc = flattenEntries(e.entries ?? e.entry)
    if (!name && !desc) continue
    out.push({ name: name || '—', desc })
  }
  return out
}

/* ------------------------------------------------------------------ codes */

const SIZES: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Varies',
}

const ALIGNMENTS: Record<string, string> = {
  L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
  U: 'unaligned', A: 'any alignment', NX: 'neutral', NY: 'neutral',
}

const SCHOOLS: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation', P: 'Psionic',
}

const ITEM_TYPES: Record<string, string> = {
  M: 'Melee weapon', R: 'Ranged weapon', A: 'Ammunition', LA: 'Light armor',
  MA: 'Medium armor', HA: 'Heavy armor', S: 'Shield', W: 'Wondrous item',
  RD: 'Rod', RG: 'Ring', ST: 'Staff', WD: 'Wand', SC: 'Scroll', P: 'Potion',
  G: 'Adventuring gear', GV: 'Generic variant', $: 'Treasure', T: 'Tools',
}

const ORDINALS = ['Cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level',
  '5th-level', '6th-level', '7th-level', '8th-level', '9th-level']

function decodeSize(v: unknown): string {
  const codes = Array.isArray(v) ? v : [v]
  return codes.map((c) => SIZES[String(c)] ?? String(c)).join('/') || 'Medium'
}

function decodeAlignment(v: unknown): string {
  if (typeof v === 'string') return ALIGNMENTS[v] ?? v
  if (!Array.isArray(v)) return 'unaligned'
  const words = v
    .map((a) => (typeof a === 'string' ? ALIGNMENTS[a] ?? a : null))
    .filter((x): x is string => !!x)
  return words.join(' ') || 'unaligned'
}

function decodeType(v: unknown): { type: string; subtype: string } {
  if (typeof v === 'string') return { type: v, subtype: '' }
  if (v && typeof v === 'object') {
    const o = v as { type?: unknown; tags?: unknown[] }
    const tags = (o.tags ?? [])
      .map((t) => (typeof t === 'string' ? t : (t as { tag?: string })?.tag ?? ''))
      .filter(Boolean)
    return { type: typeof o.type === 'string' ? o.type : 'humanoid', subtype: tags.join(', ') }
  }
  return { type: 'humanoid', subtype: '' }
}

/** "+7" / "7" / 7 → 7. Modifiers arrive as signed strings more often than not. */
function toMod(v: unknown): number {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '').replace(/[^0-9+-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function crToNumber(cr: string): number {
  if (cr.includes('/')) {
    const [a, b] = cr.split('/').map(Number)
    return b ? a / b : 0
  }
  const n = Number(cr)
  return Number.isFinite(n) ? n : 0
}

/* ------------------------------------------------------------------ monster */

interface FtMonster {
  name?: unknown; size?: unknown; type?: unknown; alignment?: unknown
  ac?: unknown; hp?: unknown; speed?: unknown
  str?: unknown; dex?: unknown; con?: unknown; int?: unknown; wis?: unknown; cha?: unknown
  save?: Record<string, unknown>; skill?: Record<string, unknown>
  senses?: unknown; passive?: unknown; languages?: unknown
  resist?: unknown; immune?: unknown; vulnerable?: unknown; conditionImmune?: unknown
  cr?: unknown; trait?: unknown; action?: unknown; bonus?: unknown
  reaction?: unknown; legendary?: unknown; legendaryHeader?: unknown
  environment?: unknown; source?: unknown
}

/** Damage lists mix plain strings with `{resist:[…], note}` objects. */
function damageList(v: unknown): string {
  if (!Array.isArray(v)) return typeof v === 'string' ? v : ''
  const out: string[] = []
  for (const item of v) {
    if (typeof item === 'string') out.push(item)
    else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const inner = o.resist ?? o.immune ?? o.vulnerable
      const list = Array.isArray(inner) ? inner.filter((x) => typeof x === 'string').join(', ') : ''
      const note = typeof o.note === 'string' ? ` ${stripTags(o.note)}` : ''
      if (list) out.push(`${list}${note}`.trim())
    }
  }
  return out.join(', ')
}

function convertMonster(raw: FtMonster, packName: string, warn: (s: string) => void): Monster | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  const acFirst = Array.isArray(raw.ac) ? raw.ac[0] : raw.ac
  let armorClass = 10
  let armorDesc = ''
  if (typeof acFirst === 'number') armorClass = acFirst
  else if (acFirst && typeof acFirst === 'object') {
    const o = acFirst as { ac?: unknown; from?: unknown[]; special?: unknown }
    armorClass = typeof o.ac === 'number' ? o.ac : 10
    const from = (o.from ?? []).filter((x) => typeof x === 'string').map((x) => stripTags(x as string))
    armorDesc = from.join(', ') || (typeof o.special === 'string' ? stripTags(o.special) : '')
  }

  const hpRaw = raw.hp as { average?: unknown; formula?: unknown; special?: unknown } | undefined
  let hitPoints = 0
  let hitDice = ''
  if (typeof hpRaw?.average === 'number') hitPoints = hpRaw.average
  if (typeof hpRaw?.formula === 'string') hitDice = stripTags(hpRaw.formula)
  if (!hitPoints && typeof hpRaw?.special === 'string') {
    // Some creatures state hit points in prose ("equal to its master's"). Better
    // an obvious 0 with the text kept than an invented number.
    hitDice = stripTags(hpRaw.special)
    warn(`${name}: HP metin olarak verilmiş ("${hitDice.slice(0, 40)}")`)
  }

  const speed: Record<string, number | boolean> = {}
  if (raw.speed && typeof raw.speed === 'object') {
    for (const [k, v] of Object.entries(raw.speed as Record<string, unknown>)) {
      if (typeof v === 'number') speed[k] = v
      else if (typeof v === 'boolean') speed[k] = v
      else if (v && typeof v === 'object' && typeof (v as { number?: unknown }).number === 'number') {
        speed[k] = (v as { number: number }).number
      }
    }
  }
  if (!Object.keys(speed).length) speed.walk = 30

  const skills: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw.skill ?? {})) {
    if (k === 'other') continue
    skills[k] = toMod(v)
  }

  const senseParts = Array.isArray(raw.senses)
    ? raw.senses.filter((s) => typeof s === 'string').map((s) => stripTags(s as string))
    : []
  if (typeof raw.passive === 'number') senseParts.push(`passive Perception ${raw.passive}`)

  const crRaw = raw.cr
  const cr =
    typeof crRaw === 'string'
      ? crRaw
      : crRaw && typeof crRaw === 'object' && typeof (crRaw as { cr?: unknown }).cr === 'string'
        ? (crRaw as { cr: string }).cr
        : '0'

  const { type, subtype } = decodeType(raw.type)
  const saves = raw.save ?? {}

  return {
    ...blankMonster(packName),
    name,
    size: decodeSize(raw.size),
    type,
    subtype,
    alignment: decodeAlignment(raw.alignment),
    armor_class: armorClass,
    armor_desc: armorDesc,
    hit_points: hitPoints,
    hit_dice: hitDice,
    speed,
    strength: toMod(raw.str) || 10,
    dexterity: toMod(raw.dex) || 10,
    constitution: toMod(raw.con) || 10,
    intelligence: toMod(raw.int) || 10,
    wisdom: toMod(raw.wis) || 10,
    charisma: toMod(raw.cha) || 10,
    strength_save: saves.str != null ? toMod(saves.str) : null,
    dexterity_save: saves.dex != null ? toMod(saves.dex) : null,
    constitution_save: saves.con != null ? toMod(saves.con) : null,
    intelligence_save: saves.int != null ? toMod(saves.int) : null,
    wisdom_save: saves.wis != null ? toMod(saves.wis) : null,
    charisma_save: saves.cha != null ? toMod(saves.cha) : null,
    perception: typeof raw.passive === 'number' ? raw.passive - 10 : null,
    skills,
    damage_vulnerabilities: damageList(raw.vulnerable),
    damage_resistances: damageList(raw.resist),
    damage_immunities: damageList(raw.immune),
    condition_immunities: damageList(raw.conditionImmune),
    senses: senseParts.join(', '),
    languages: Array.isArray(raw.languages)
      ? raw.languages.filter((l) => typeof l === 'string').map((l) => stripTags(l as string)).join(', ')
      : typeof raw.languages === 'string'
        ? stripTags(raw.languages)
        : '',
    challenge_rating: cr,
    cr: crToNumber(cr),
    special_abilities: namedEntries(raw.trait),
    actions: namedEntries(raw.action),
    bonus_actions: namedEntries(raw.bonus),
    reactions: namedEntries(raw.reaction),
    legendary_actions: namedEntries(raw.legendary),
    legendary_desc: flattenEntries(raw.legendaryHeader),
    environments: Array.isArray(raw.environment)
      ? raw.environment.filter((e): e is string => typeof e === 'string')
      : [],
    document__title: packName,
    homebrew: true,
  }
}

/* ------------------------------------------------------------------ spell */

function timeToText(v: unknown): string {
  if (!Array.isArray(v) || !v.length) return '1 action'
  const t = v[0] as { number?: unknown; unit?: unknown; condition?: unknown }
  const n = typeof t.number === 'number' ? t.number : 1
  const unit = typeof t.unit === 'string' ? t.unit : 'action'
  const cond = typeof t.condition === 'string' ? `, ${stripTags(t.condition)}` : ''
  return `${n} ${unit}${n === 1 ? '' : 's'}${cond}`
}

function rangeToText(v: unknown): string {
  if (typeof v === 'string') return v
  if (!v || typeof v !== 'object') return 'Self'
  const o = v as { type?: unknown; distance?: { type?: unknown; amount?: unknown } }
  const d = o.distance
  if (!d) return typeof o.type === 'string' ? o.type : 'Self'
  const amount = typeof d.amount === 'number' ? `${d.amount} ` : ''
  const unit = typeof d.type === 'string' ? d.type : ''
  const shape = o.type && o.type !== 'point' ? ` (${String(o.type)})` : ''
  return `${amount}${unit}${shape}`.trim() || 'Self'
}

function componentsToText(v: unknown): { text: string; material: string } {
  if (!v || typeof v !== 'object') return { text: '', material: '' }
  const o = v as { v?: unknown; s?: unknown; m?: unknown }
  const letters: string[] = []
  if (o.v) letters.push('V')
  if (o.s) letters.push('S')
  let material = ''
  if (o.m) {
    letters.push('M')
    material = typeof o.m === 'string' ? stripTags(o.m) : stripTags(String((o.m as { text?: string }).text ?? ''))
  }
  return { text: letters.join(', '), material }
}

function durationToText(v: unknown): { text: string; concentration: boolean } {
  if (!Array.isArray(v) || !v.length) return { text: 'Instantaneous', concentration: false }
  const d = v[0] as {
    type?: unknown
    duration?: { type?: unknown; amount?: unknown }
    concentration?: unknown
  }
  const conc = d.concentration === true
  if (d.type === 'instant') return { text: 'Instantaneous', concentration: conc }
  if (d.type === 'permanent') return { text: 'Permanent', concentration: conc }
  const inner = d.duration
  if (inner && typeof inner.amount === 'number') {
    const unit = typeof inner.type === 'string' ? inner.type : 'round'
    return { text: `${inner.amount} ${unit}${inner.amount === 1 ? '' : 's'}`, concentration: conc }
  }
  return { text: typeof d.type === 'string' ? d.type : 'Instantaneous', concentration: conc }
}

interface FtSpell {
  name?: unknown; level?: unknown; school?: unknown; time?: unknown; range?: unknown
  components?: unknown; duration?: unknown; entries?: unknown; entriesHigherLevel?: unknown
  meta?: { ritual?: unknown }; classes?: unknown
}

function convertSpell(raw: FtSpell, packName: string): Spell | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  const level = typeof raw.level === 'number' ? raw.level : 0
  const { text: comps, material } = componentsToText(raw.components)
  const { text: duration, concentration } = durationToText(raw.duration)

  const classList = (() => {
    const c = raw.classes as { fromClassList?: Array<{ name?: unknown }> } | undefined
    return (c?.fromClassList ?? [])
      .map((x) => (typeof x?.name === 'string' ? x.name : ''))
      .filter(Boolean)
      .join(', ')
  })()

  return {
    ...blankSpell(packName),
    name,
    desc: flattenEntries(raw.entries),
    higher_level: flattenEntries(raw.entriesHigherLevel),
    range: rangeToText(raw.range),
    components: comps,
    material,
    ritual: raw.meta?.ritual ? 'yes' : 'no',
    duration,
    concentration: concentration ? 'yes' : 'no',
    casting_time: timeToText(raw.time),
    level: ORDINALS[level] ?? `${level}th-level`,
    level_int: level,
    school: typeof raw.school === 'string' ? SCHOOLS[raw.school] ?? raw.school : '',
    dnd_class: classList,
    document__title: packName,
    homebrew: true,
  }
}

/* ------------------------------------------------------------------ item */

interface FtItem {
  name?: unknown; type?: unknown; rarity?: unknown; reqAttune?: unknown
  entries?: unknown; wondrous?: unknown
}

function convertItem(raw: FtItem, packName: string): MagicItem | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  // Types arrive as "M" or "M|XPHB" — the source suffix is noise here.
  const typeCode = typeof raw.type === 'string' ? raw.type.split('|')[0] : ''
  const type = ITEM_TYPES[typeCode] ?? (raw.wondrous ? 'Wondrous item' : typeCode || 'Wondrous item')

  const attune =
    raw.reqAttune === true ? 'requires attunement'
      : typeof raw.reqAttune === 'string' ? `requires attunement ${stripTags(raw.reqAttune)}`
        : ''

  return {
    ...blankItem(packName),
    name,
    type,
    desc: flattenEntries(raw.entries),
    rarity: typeof raw.rarity === 'string' ? raw.rarity : 'unknown',
    requires_attunement: attune,
    document__title: packName,
    homebrew: true,
  }
}

/* ------------------------------------------------------------------ entry */

const COLLECTIONS = ['monster', 'spell', 'item', 'baseitem', 'magicvariant'] as const

/** Does this look like a 5etools data file? */
export function isFiveToolsFile(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const o = raw as Record<string, unknown>
  if (o._meta && typeof o._meta === 'object') return true
  return COLLECTIONS.some((k) => Array.isArray(o[k]))
}

export interface FiveToolsResult {
  pack: BrewPack
  warnings: string[]
}

/**
 * Convert one 5etools file into a pack.
 *
 * The file's own `_meta.sources` names the homebrew's author and title far
 * better than a filename does, so it wins when present.
 */
export function convertFiveTools(raw: unknown, fallbackName = 'İçe aktarılan'): FiveToolsResult {
  if (!isFiveToolsFile(raw)) throw new Error('5etools biçiminde bir dosya değil.')
  const o = raw as Record<string, unknown>
  const warnings: string[] = []

  const meta = o._meta as { sources?: Array<{ full?: unknown; json?: unknown; abbreviation?: unknown }> } | undefined
  const src = meta?.sources?.[0]
  const title = typeof src?.full === 'string' && src.full.trim() ? src.full.trim() : fallbackName

  const pack = emptyPack(title)
  pack.description = '5etools homebrew’dan içe aktarıldı'
  if (typeof src?.abbreviation === 'string') pack.author = src.abbreviation

  const warn = (s: string) => {
    // A file with 400 broken creatures should not produce 400 lines of noise.
    if (warnings.length < 25) warnings.push(s)
  }

  let skipped = 0

  for (const raws of [o.monster]) {
    for (const m of Array.isArray(raws) ? raws : []) {
      const converted = convertMonster(m as FtMonster, title, warn)
      if (converted) pack.monsters.push(converted)
      else skipped++
    }
  }

  for (const s of Array.isArray(o.spell) ? o.spell : []) {
    const converted = convertSpell(s as FtSpell, title)
    if (converted) pack.spells.push(converted)
    else skipped++
  }

  // `item` is bespoke magic items; `baseitem` and `magicvariant` are the
  // mundane and templated ones, all of which read the same once converted.
  for (const key of ['item', 'baseitem', 'magicvariant'] as const) {
    for (const i of Array.isArray(o[key]) ? (o[key] as unknown[]) : []) {
      const converted = convertItem(i as FtItem, title)
      if (converted) pack.items.push(converted)
      else skipped++
    }
  }

  if (skipped) warn(`${skipped} isimsiz kayıt atlandı`)

  return { pack, warnings }
}

/* ------------------------------------------------------------------ github */

export const HOMEBREW_REPO = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master'

/** The repo publishes its own file listing, so browsing needs no GitHub API. */
export const HOMEBREW_INDEX = `${HOMEBREW_REPO}/_generated/index-props.json`

export interface CatalogueFile {
  path: string
  /** Which of the kinds we can import this file contains. */
  kinds: string[]
}

/**
 * Turn the published index into a list of files worth offering.
 *
 * The index maps kind → { path: hash }, and covers plenty we cannot use
 * (subclasses, feats, adventures). Files with nothing importable are dropped
 * rather than listed and then disappointing someone.
 */
export function parseCatalogue(raw: unknown): CatalogueFile[] {
  if (!raw || typeof raw !== 'object') return []
  const byPath = new Map<string, Set<string>>()

  for (const kind of COLLECTIONS) {
    const files = (raw as Record<string, unknown>)[kind]
    if (!files || typeof files !== 'object') continue
    for (const path of Object.keys(files as Record<string, unknown>)) {
      const set = byPath.get(path) ?? new Set<string>()
      set.add(kind)
      byPath.set(path, set)
    }
  }

  return [...byPath.entries()]
    .map(([path, kinds]) => ({ path, kinds: [...kinds] }))
    .sort((a, b) => a.path.localeCompare(b.path, 'tr'))
}

/** Raw URL for a catalogue path. Spaces and semicolons are common in them. */
export function rawUrlFor(path: string): string {
  return `${HOMEBREW_REPO}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Accept a github.com page URL where a raw one is wanted.
 *
 * Copying a link out of the address bar gives the HTML page, which returns a
 * web page rather than JSON and no CORS header with it. Rewriting is friendlier
 * than explaining the difference.
 */
export function toRawUrl(url: string): string {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/)
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url
}
