/**
 * Homebrew forge.
 *
 * Official (openly-licensed) content comes from Open5e. This module is the
 * other half: content you write yourself, or import from a friend, a Discord
 * pack, or any URL serving the same JSON shape.
 *
 * Homebrew entries deliberately mirror the Open5e shapes so the compendium can
 * merge both into one search result list without special-casing either.
 */

import type { Monster, Spell, MagicItem, NamedEntry } from './open5e'
import { convertBrew } from './fivetools-convert'

export const BREW_FORMAT = 'kahin-brew/1'

export interface BrewTable {
  id: string
  name: string
  /** Which generator this table feeds, or 'standalone' for a plain roll table. */
  hook: string
  rows: string[]
}

export interface BrewNpc {
  id: string
  name: string
  role: string
  appearance: string
  quirk: string
  motivation: string
  secret: string
  notes: string
}

export interface BrewPack {
  format: typeof BREW_FORMAT
  id: string
  name: string
  author: string
  description: string
  createdAt: number
  updatedAt: number
  monsters: Monster[]
  spells: Spell[]
  items: MagicItem[]
  tables: BrewTable[]
  npcs: BrewNpc[]
}

/** Table hooks the oracle knows how to merge user rows into. */
export const TABLE_HOOKS: Array<{ key: string; label: string }> = [
  { key: 'standalone', label: 'Bağımsız tablo (sadece zar at)' },
  { key: 'npc-role', label: 'NPC · meslek' },
  { key: 'npc-appearance', label: 'NPC · görünüş' },
  { key: 'npc-quirk', label: 'NPC · tavır' },
  { key: 'npc-voice', label: 'NPC · ses' },
  { key: 'npc-motivation', label: 'NPC · motivasyon' },
  { key: 'npc-secret', label: 'NPC · sır' },
  { key: 'rumor', label: 'Dedikodu' },
  { key: 'tavern-adj', label: 'Meyhane · sıfat' },
  { key: 'tavern-noun', label: 'Meyhane · isim' },
  { key: 'tavern-feature', label: 'Meyhane · özellik' },
  { key: 'tavern-drink', label: 'Meyhane · içki' },
  { key: 'hook-who', label: 'Kanca · kim' },
  { key: 'hook-wants', label: 'Kanca · ne istiyor' },
  { key: 'hook-twist', label: 'Kanca · ama' },
  { key: 'room-feature', label: 'Oda · özellik' },
  { key: 'smell', label: 'Koku' },
  { key: 'sound', label: 'Ses' },
  { key: 'settlement-problem', label: 'Yerleşim · sorun' },
  { key: 'settlement-quirk', label: 'Yerleşim · tuhaflık' },
  { key: 'shop-type', label: 'Dükkân türü' },
  { key: 'treasure-art', label: 'Hazine · sanat eseri' },
  { key: 'treasure-oddity', label: 'Hazine · tuhaf şey' },
  { key: 'trap-trigger', label: 'Tuzak · tetikleyici' },
  { key: 'trap-effect', label: 'Tuzak · etki' },
  { key: 'dungeon-purpose', label: 'Zindan · amaç' },
  { key: 'dungeon-builder', label: 'Zindan · kuran' },
  { key: 'dungeon-state', label: 'Zindan · hâl' },
]

export function uid(prefix = 'hb'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyPack(name = 'Kendi Derlemem'): BrewPack {
  const now = Date.now()
  return {
    format: BREW_FORMAT,
    id: uid('pack'),
    name,
    author: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    monsters: [],
    spells: [],
    items: [],
    tables: [],
    npcs: [],
  }
}

/* ------------------------------------------------------------------ blanks */

export function blankMonster(packName: string): Monster {
  return {
    slug: uid('mon'),
    name: 'Yeni Yaratık',
    size: 'Medium',
    type: 'humanoid',
    alignment: 'unaligned',
    armor_class: 12,
    armor_desc: '',
    hit_points: 22,
    hit_dice: '4d8+4',
    speed: { walk: 30 },
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    skills: {},
    senses: 'passive Perception 10',
    languages: 'Common',
    challenge_rating: '1',
    cr: 1,
    actions: [],
    special_abilities: [],
    legendary_actions: [],
    reactions: [],
    desc: '',
    document__slug: 'homebrew',
    document__title: packName,
    homebrew: true,
  }
}

export function blankSpell(packName: string): Spell {
  return {
    slug: uid('spl'),
    name: 'Yeni Büyü',
    desc: '',
    higher_level: '',
    range: '60 feet',
    components: 'V, S',
    material: '',
    ritual: 'no',
    duration: 'Instantaneous',
    concentration: 'no',
    casting_time: '1 action',
    level: '1st-level',
    level_int: 1,
    school: 'Evocation',
    dnd_class: 'Wizard',
    document__slug: 'homebrew',
    document__title: packName,
    homebrew: true,
  }
}

export function blankItem(packName: string): MagicItem {
  return {
    slug: uid('itm'),
    name: 'Yeni Eşya',
    type: 'Wondrous item',
    desc: '',
    rarity: 'uncommon',
    requires_attunement: '',
    document__slug: 'homebrew',
    document__title: packName,
    homebrew: true,
  }
}

export function blankTable(): BrewTable {
  return { id: uid('tbl'), name: 'Yeni Tablo', hook: 'standalone', rows: ['', '', ''] }
}

export function blankNpc(): BrewNpc {
  return {
    id: uid('npc'),
    name: '',
    role: '',
    appearance: '',
    quirk: '',
    motivation: '',
    secret: '',
    notes: '',
  }
}

export function blankEntry(): NamedEntry {
  return { name: '', desc: '' }
}

/* ------------------------------------------------------------------ import */

export interface ImportReport {
  pack: BrewPack
  warnings: string[]
}

/**
 * 5etools brew documents key their content by singular entity name
 * (`monster`, `spell`) and describe themselves in `_meta.sources`, which is
 * enough to tell them apart from our own packs without asking the DM which
 * kind of file they just dropped.
 */
function isFiveToolsBrew(obj: Record<string, unknown>): boolean {
  if (obj.format === BREW_FORMAT) return false
  if (obj._meta && typeof obj._meta === 'object') return true
  return ['monster', 'spell', 'item', 'baseitem', 'condition', 'disease', 'action', 'variantrule'].some((k) =>
    Array.isArray(obj[k]),
  )
}

function parseFiveToolsPack(obj: Record<string, unknown>, fallbackName: string): ImportReport {
  const converted = convertBrew(obj)
  const pack = emptyPack(converted.name || fallbackName)
  pack.author = converted.author
  pack.description = '5etools homebrew dosyasından içe aktarıldı.'
  pack.monsters = converted.monsters
  pack.spells = converted.spells
  pack.items = converted.items

  const warnings = [...converted.warnings]
  if (converted.rules.length) {
    // A pack has nowhere to put conditions and variant rules. The export
    // script does carry them, so point at the path that works.
    warnings.push(
      `${converted.rules.length} kural girdisi (durum, aksiyon, varyant kural) atlandı — ` +
        'bunlar için dosyayı 5etools kaynağının homebrew/ klasörüne koyup dışa aktarımı yenile.',
    )
  }
  if (!countEntries(pack)) throw new Error('5etools dosyasında içe aktarılabilir içerik bulunamadı.')

  return { pack, warnings }
}

/**
 * Parse an imported pack. Tolerant by design — a half-filled homebrew file from
 * someone else's tool is still worth salvaging, so unknown fields are dropped
 * and missing ones are defaulted rather than rejecting the whole import.
 *
 * Accepts both our own format and 5etools brew documents.
 */
export function parsePack(raw: unknown, fallbackName = 'İçe aktarılan'): ImportReport {
  const warnings: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Dosya bir JSON nesnesi değil.')
  }
  const obj = raw as Record<string, unknown>

  if (isFiveToolsBrew(obj)) return parseFiveToolsPack(obj, fallbackName)

  if (obj.format !== BREW_FORMAT) {
    warnings.push(`Bilinmeyen format (${String(obj.format ?? 'yok')}). Yine de okumaya çalışıldı.`)
  }

  const packName = typeof obj.name === 'string' && obj.name ? obj.name : fallbackName
  const pack = emptyPack(packName)
  pack.author = typeof obj.author === 'string' ? obj.author : ''
  pack.description = typeof obj.description === 'string' ? obj.description : ''

  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

  for (const m of asArray(obj.monsters)) {
    if (typeof m !== 'object' || m === null) continue
    const src = m as Record<string, unknown>
    if (typeof src.name !== 'string') {
      warnings.push('İsimsiz bir yaratık atlandı.')
      continue
    }
    pack.monsters.push({
      ...blankMonster(packName),
      ...(src as Partial<Monster>),
      slug: typeof src.slug === 'string' ? src.slug : uid('mon'),
      document__slug: 'homebrew',
      document__title: packName,
      homebrew: true,
    } as Monster)
  }

  for (const s of asArray(obj.spells)) {
    if (typeof s !== 'object' || s === null) continue
    const src = s as Record<string, unknown>
    if (typeof src.name !== 'string') {
      warnings.push('İsimsiz bir büyü atlandı.')
      continue
    }
    pack.spells.push({
      ...blankSpell(packName),
      ...(src as Partial<Spell>),
      slug: typeof src.slug === 'string' ? src.slug : uid('spl'),
      document__slug: 'homebrew',
      document__title: packName,
      homebrew: true,
    } as Spell)
  }

  for (const i of asArray(obj.items)) {
    if (typeof i !== 'object' || i === null) continue
    const src = i as Record<string, unknown>
    if (typeof src.name !== 'string') continue
    pack.items.push({
      ...blankItem(packName),
      ...(src as Partial<MagicItem>),
      slug: typeof src.slug === 'string' ? src.slug : uid('itm'),
      document__slug: 'homebrew',
      document__title: packName,
      homebrew: true,
    } as MagicItem)
  }

  for (const t of asArray(obj.tables)) {
    if (typeof t !== 'object' || t === null) continue
    const src = t as Record<string, unknown>
    const rows = Array.isArray(src.rows) ? src.rows.filter((r): r is string => typeof r === 'string') : []
    if (!rows.length) {
      warnings.push(`"${String(src.name ?? '?')}" tablosu boş, atlandı.`)
      continue
    }
    pack.tables.push({
      id: typeof src.id === 'string' ? src.id : uid('tbl'),
      name: typeof src.name === 'string' ? src.name : 'İsimsiz tablo',
      hook: typeof src.hook === 'string' ? src.hook : 'standalone',
      rows,
    })
  }

  for (const n of asArray(obj.npcs)) {
    if (typeof n !== 'object' || n === null) continue
    const src = n as Record<string, unknown>
    pack.npcs.push({ ...blankNpc(), ...(src as Partial<BrewNpc>), id: typeof src.id === 'string' ? src.id : uid('npc') })
  }

  const total = pack.monsters.length + pack.spells.length + pack.items.length + pack.tables.length + pack.npcs.length
  if (total === 0) throw new Error('Dosyada içe aktarılabilir içerik bulunamadı.')

  return { pack, warnings }
}

export function exportPack(pack: BrewPack): string {
  return JSON.stringify({ ...pack, updatedAt: Date.now() }, null, 2)
}

export function downloadPack(pack: BrewPack): void {
  const blob = new Blob([exportPack(pack)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pack.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.brew.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Fetch a pack from a URL — for sharing brews via gist, GitHub raw, etc. */
export async function fetchPack(url: string): Promise<ImportReport> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Kaynak yanıt vermedi (${res.status})`)
  const json: unknown = await res.json()
  return parsePack(json, new URL(url).hostname)
}

/** Collapse every pack's tables into the map the oracle generators expect. */
export function tablesToExtra(packs: BrewPack[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const pack of packs) {
    for (const t of pack.tables) {
      if (t.hook === 'standalone') continue
      const rows = t.rows.filter((r) => r.trim())
      if (!rows.length) continue
      out[t.hook] = [...(out[t.hook] ?? []), ...rows]
    }
  }
  return out
}

export function countEntries(pack: BrewPack): number {
  return pack.monsters.length + pack.spells.length + pack.items.length + pack.tables.length + pack.npcs.length
}
