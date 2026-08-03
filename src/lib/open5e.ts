/**
 * Open5e API client.
 *
 * Open5e aggregates openly-licensed 5e content (OGL / CC-BY / ORC): the SRD
 * core rules plus third-party books like Tome of Beasts, Creature Codex,
 * Deep Magic, Black Flag and Tal'Dorei. We deliberately use only these
 * openly-licensed sources — scraping closed content would be both illegal
 * and fragile.
 *
 * Everything fetched is cached in localStorage so the screen keeps working
 * when the venue wifi inevitably dies mid-session.
 */

export const API_ROOT = 'https://api.open5e.com/v1'

export type ResourceKind = 'monsters' | 'spells' | 'magicitems' | 'conditions' | 'sections' | 'feats' | 'races' | 'classes' | 'backgrounds' | 'planes' | 'weapons' | 'armor'

/** A source book, as Open5e models it. */
export interface SourceDoc {
  slug: string
  title: string
  license: string
  url?: string
}

export interface Monster {
  slug: string
  name: string
  size: string
  type: string
  subtype?: string
  alignment: string
  armor_class: number
  armor_desc?: string
  hit_points: number
  hit_dice: string
  speed: Record<string, number | boolean>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save?: number | null
  dexterity_save?: number | null
  constitution_save?: number | null
  intelligence_save?: number | null
  wisdom_save?: number | null
  charisma_save?: number | null
  perception?: number | null
  skills?: Record<string, number>
  damage_vulnerabilities?: string
  damage_resistances?: string
  damage_immunities?: string
  condition_immunities?: string
  senses?: string
  languages?: string
  challenge_rating: string
  cr: number
  actions?: NamedEntry[] | null
  bonus_actions?: NamedEntry[] | null
  reactions?: NamedEntry[] | null
  legendary_desc?: string
  legendary_actions?: NamedEntry[] | null
  special_abilities?: NamedEntry[] | null
  desc?: string
  environments?: string[]
  document__slug: string
  document__title: string
  /** Set locally for user-authored creatures. */
  homebrew?: boolean
}

export interface NamedEntry {
  name: string
  desc: string
  attack_bonus?: number
  damage_dice?: string
}

export interface Spell {
  slug: string
  name: string
  desc: string
  higher_level?: string
  range: string
  components: string
  material?: string
  ritual: string
  duration: string
  concentration: string
  casting_time: string
  level: string
  level_int: number
  school: string
  dnd_class: string
  document__slug: string
  document__title: string
  homebrew?: boolean
}

export interface MagicItem {
  slug: string
  name: string
  type: string
  desc: string
  rarity: string
  requires_attunement?: string
  document__slug: string
  document__title: string
  homebrew?: boolean
}

export interface Condition {
  slug: string
  name: string
  desc: string
  document__slug: string
  homebrew?: boolean
}

export interface RuleSection {
  slug: string
  name: string
  desc: string
  parent?: string
  document__slug: string
}

interface Paged<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/* ------------------------------------------------------------------ cache */

const CACHE_PREFIX = 'kahin.cache.'
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30 // 30 days — this data changes rarely
const memory = new Map<string, unknown>()

interface CacheEnvelope<T> {
  at: number
  data: T
}

function cacheGet<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const env = JSON.parse(raw) as CacheEnvelope<T>
    if (Date.now() - env.at > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    memory.set(key, env.data)
    return env.data
  } catch {
    return null
  }
}

function cacheSet<T>(key: string, data: T): void {
  memory.set(key, data)
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // Storage full — evict the oldest cache entries and let memory carry it.
    pruneCache()
  }
}

function pruneCache(): void {
  try {
    const entries: Array<{ key: string; at: number }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(CACHE_PREFIX)) continue
      try {
        const env = JSON.parse(localStorage.getItem(key) ?? '{}') as CacheEnvelope<unknown>
        entries.push({ key, at: env.at ?? 0 })
      } catch {
        entries.push({ key, at: 0 })
      }
    }
    entries.sort((a, b) => a.at - b.at)
    for (const e of entries.slice(0, Math.ceil(entries.length / 2))) localStorage.removeItem(e.key)
  } catch {
    /* nothing else we can do */
  }
}

export function clearCache(): void {
  memory.clear()
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) doomed.push(key)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export function cacheStats(): { entries: number; bytes: number } {
  let entries = 0
  let bytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(CACHE_PREFIX)) continue
      entries++
      bytes += (localStorage.getItem(key) ?? '').length * 2
    }
  } catch {
    /* ignore */
  }
  return { entries, bytes }
}

/* ------------------------------------------------------------------ fetch */

export class OfflineError extends Error {
  constructor() {
    super('Çevrimdışısın ve bu sorgu önbellekte yok.')
    this.name = 'OfflineError'
  }
}

/**
 * Venue wifi fails by hanging, not by refusing. Without a deadline the panel
 * would spin indefinitely instead of falling back to cache and homebrew.
 */
const REQUEST_TIMEOUT_MS = 12_000

async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${API_ROOT}/${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  const key = url.toString().replace(API_ROOT, '')

  const cached = cacheGet<T>(key)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Open5e ${res.status}: ${res.statusText}`)
    const data = (await res.json()) as T
    cacheSet(key, data)
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Kaynak zaman aşımına uğradı — bağlantını kontrol et.')
    }
    // A network-level failure is indistinguishable from being offline here,
    // and the useful advice is the same.
    if (err instanceof TypeError) throw new OfflineError()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ queries */

export async function listSources(): Promise<SourceDoc[]> {
  const data = await apiGet<Paged<SourceDoc>>('documents/', { limit: 60 })
  return data.results
}

export interface MonsterQuery {
  search?: string
  cr?: string
  crGte?: number
  crLte?: number
  type?: string
  documents?: string[]
  ordering?: string
  limit?: number
  page?: number
}

export async function searchMonsters(q: MonsterQuery): Promise<Paged<Monster>> {
  return apiGet<Paged<Monster>>('monsters/', {
    name__icontains: q.search || undefined,
    cr: q.cr,
    cr__gte: q.crGte,
    cr__lte: q.crLte,
    type__icontains: q.type || undefined,
    document__slug__in: q.documents?.length ? q.documents.join(',') : undefined,
    ordering: q.ordering ?? 'name',
    limit: q.limit ?? 30,
    page: q.page,
  })
}

export async function getMonster(slug: string): Promise<Monster> {
  return apiGet<Monster>(`monsters/${slug}/`)
}

export interface SpellQuery {
  search?: string
  level?: number
  school?: string
  dndClass?: string
  documents?: string[]
  limit?: number
  page?: number
}

export async function searchSpells(q: SpellQuery): Promise<Paged<Spell>> {
  return apiGet<Paged<Spell>>('spells/', {
    name__icontains: q.search || undefined,
    level_int: q.level,
    school__icontains: q.school || undefined,
    dnd_class__icontains: q.dndClass || undefined,
    document__slug__in: q.documents?.length ? q.documents.join(',') : undefined,
    ordering: 'level_int,name',
    limit: q.limit ?? 30,
    page: q.page,
  })
}

export async function searchMagicItems(q: {
  search?: string
  rarity?: string
  documents?: string[]
  limit?: number
  page?: number
}): Promise<Paged<MagicItem>> {
  return apiGet<Paged<MagicItem>>('magicitems/', {
    name__icontains: q.search || undefined,
    rarity__icontains: q.rarity || undefined,
    document__slug__in: q.documents?.length ? q.documents.join(',') : undefined,
    ordering: 'name',
    limit: q.limit ?? 30,
    page: q.page,
  })
}

export async function listConditions(): Promise<Condition[]> {
  const data = await apiGet<Paged<Condition>>('conditions/', { limit: 40 })
  return data.results
}

export async function searchRules(search: string): Promise<RuleSection[]> {
  const data = await apiGet<Paged<RuleSection>>('sections/', {
    name__icontains: search || undefined,
    limit: 25,
  })
  return data.results
}

/* ------------------------------------------------------------------ helpers */

export const CR_XP: Record<string, number> = {
  '0': 10, '0.125': 25, '0.25': 50, '0.5': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900,
  '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000,
  '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
}

export function xpForCr(cr: number | string): number {
  const key = typeof cr === 'number' ? String(cr) : cr.replace('1/8', '0.125').replace('1/4', '0.25').replace('1/2', '0.5')
  return CR_XP[key] ?? 0
}

export function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

/** Proficiency bonus a creature of this CR is assumed to have. */
export function profBonusForCr(cr: number): number {
  if (cr <= 4) return 2
  return Math.floor((cr - 1) / 4) + 2
}

export function speedToString(speed: Record<string, number | boolean> | undefined): string {
  if (!speed) return '—'
  return Object.entries(speed)
    .filter(([, v]) => v !== false && v !== 0)
    .map(([k, v]) => (k === 'walk' ? `${v} ft.` : typeof v === 'boolean' ? k : `${k} ${v} ft.`))
    .join(', ')
}

/** Monsters carry a passive Perception in `senses`; fall back to WIS if absent. */
export function passivePerception(m: Monster): number {
  const match = /passive Perception (\d+)/i.exec(m.senses ?? '')
  if (match) return parseInt(match[1], 10)
  const wisMod = Math.floor((m.wisdom - 10) / 2)
  return 10 + (m.perception ?? wisMod)
}
