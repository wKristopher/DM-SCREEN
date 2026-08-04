/**
 * Local 5etools catalogue.
 *
 * `scripts/export-5etools.mjs` turns a 5etools checkout into a compact index
 * plus content shards under `public/5etools/`; this reads them.
 *
 * The split matters at the table. A search touches only the index — one file
 * per kind, a few hundred KB, loaded once and then answered from memory in
 * under a millisecond, which is why this source wins every race against the
 * network. Opening a statblock pulls exactly one shard (~120 records) and
 * nothing else, so the 15 MB catalogue never lands in the browser at once.
 *
 * Everything fetched is mirrored into IndexedDB, so the second session works
 * with the venue wifi unplugged.
 */

import type { Monster, Spell, MagicItem, SourceDoc } from './open5e'
import type { RuleEntry } from './fivetools-convert'

export type FiveKind = 'monsters' | 'spells' | 'items' | 'rules'

export interface FiveSource {
  slug: string
  title: string
  abbr: string
  index: number
  /** False for books that contributed nothing after filtering. */
  used: boolean
}

export interface FiveManifest {
  format: string
  generatedAt: number
  shardSize: number
  sources: FiveSource[]
  kinds: Record<FiveKind, { count: number; shards: number; indexBytes: number; shardBytes: number }>
}

/** Anything the catalogue can return; all four share provenance fields. */
export type FiveRecord = Monster | Spell | MagicItem | RuleEntry

/* ------------------------------------------------------------------ base */

/**
 * Where the generated catalogue lives. Defaults to the copy shipped beside
 * the app, but a DM running several tables can point every screen at one host.
 */
let base = new URL('5etools/', typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).href

export function setBaseUrl(url: string): void {
  const next = url.trim()
  const resolved = next
    ? new URL(next.endsWith('/') ? next : `${next}/`, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).href
    : new URL('5etools/', typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).href
  if (resolved === base) return
  base = resolved
  // A different catalogue means every cached artefact describes the wrong data,
  // including the decoded indexes — those hold book titles from the old
  // manifest, so leaving them would mis-attribute every result.
  manifestPromise = null
  memory.clear()
  indexes.clear()
}

export function getBaseUrl(): string {
  return base
}

/* ----------------------------------------------------------------- store */

/**
 * Tiny IndexedDB key/value store.
 *
 * The index files are ~300 KB each, well past what localStorage can hold
 * alongside the campaign state, and they must survive a reload to be worth
 * anything offline.
 */
const DB_NAME = 'kahin.5etools'
const STORE = 'files'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
  } catch {
    /* quota or private mode — memory cache still carries the session */
  }
}

/** Drop the offline mirror; the next search refetches from the base URL. */
export async function clearCache(): Promise<void> {
  memory.clear()
  indexes.clear()
  manifestPromise = null
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------------- fetch */

const memory = new Map<string, unknown>()

/**
 * Network first, mirror second. The catalogue is regenerated whenever the DM
 * re-runs the export, so a stale mirror would quietly hide new content; but a
 * failed fetch must never be the end of the session.
 */
async function getJson<T>(rel: string, signal?: AbortSignal): Promise<T> {
  const key = base + rel
  const cached = memory.get(key)
  if (cached !== undefined) return cached as T

  try {
    const res = await fetch(key, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`5etools ${res.status}`)
    const data = (await res.json()) as T
    memory.set(key, data)
    void idbSet(key, data)
    return data
  } catch (err) {
    if (signal?.aborted) throw err
    const mirrored = await idbGet<T>(key)
    if (mirrored !== null) {
      memory.set(key, mirrored)
      return mirrored
    }
    throw err
  }
}

/* -------------------------------------------------------------- manifest */

let manifestPromise: Promise<FiveManifest | null> | null = null

/**
 * Resolves to null when no catalogue has been generated — the app must stay
 * fully usable for someone who never ran the export script.
 */
export function loadManifest(): Promise<FiveManifest | null> {
  if (!manifestPromise) {
    manifestPromise = getJson<FiveManifest>('manifest.json')
      .then((m) => (m?.format?.startsWith('dm-screen-5etools/') ? m : null))
      .catch(() => null)
  }
  return manifestPromise
}

export async function isAvailable(): Promise<boolean> {
  return (await loadManifest()) !== null
}

export async function listSources(): Promise<SourceDoc[]> {
  const manifest = await loadManifest()
  if (!manifest) return []
  return manifest.sources
    .filter((s) => s.used)
    .map((s) => ({ slug: s.slug, title: s.title, license: '5etools' }))
    .sort((a, b) => a.title.localeCompare(b.title, 'tr'))
}

/* --------------------------------------------------------------- decoding */

/**
 * Index rows are positional arrays — at 4.5k creatures, field names would cost
 * more than the data. These rebuild them into records the panels can render
 * directly, marked `partial` until `hydrate` swaps in the full version.
 */

type Row = Array<string | number>

function bookOf(manifest: FiveManifest, idx: number): { slug: string; title: string } {
  const src = manifest.sources[idx]
  return src ? { slug: src.slug, title: src.title } : { slug: '5et-unknown', title: '5etools' }
}

function decodeMonster(row: Row, manifest: FiveManifest): Monster {
  const book = bookOf(manifest, row[5] as number)
  const cr = row[4] as number
  return {
    slug: row[0] as string,
    name: row[1] as string,
    size: row[2] as string,
    type: row[3] as string,
    alignment: '',
    armor_class: 0,
    hit_points: 0,
    hit_dice: '',
    speed: {},
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    challenge_rating: String(cr),
    cr,
    document__slug: book.slug,
    document__title: book.title,
    homebrew: row[6] === 1,
    source: '5etools',
    partial: true,
    shard: row[7] as number,
  }
}

function decodeSpell(row: Row, manifest: FiveManifest): Spell {
  const book = bookOf(manifest, row[4] as number)
  const level = row[2] as number
  return {
    slug: row[0] as string,
    name: row[1] as string,
    desc: '',
    range: '',
    components: '',
    ritual: 'no',
    duration: '',
    concentration: 'no',
    casting_time: '',
    level: level === 0 ? 'cantrip' : `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'}-level`,
    level_int: level,
    school: row[3] as string,
    dnd_class: '',
    document__slug: book.slug,
    document__title: book.title,
    homebrew: row[5] === 1,
    source: '5etools',
    partial: true,
    shard: row[6] as number,
  }
}

function decodeItem(row: Row, manifest: FiveManifest): MagicItem {
  const book = bookOf(manifest, row[4] as number)
  return {
    slug: row[0] as string,
    name: row[1] as string,
    rarity: row[2] as string,
    type: row[3] as string,
    desc: '',
    document__slug: book.slug,
    document__title: book.title,
    homebrew: row[5] === 1,
    source: '5etools',
    partial: true,
    shard: row[6] as number,
  }
}

function decodeRule(row: Row, manifest: FiveManifest): RuleEntry {
  const book = bookOf(manifest, row[3] as number)
  return {
    slug: row[0] as string,
    name: row[1] as string,
    kind: row[2] as string,
    desc: '',
    document__slug: book.slug,
    document__title: book.title,
    homebrew: row[4] === 1,
    source: '5etools',
    partial: true,
    shard: row[5] as number,
  }
}

const DECODERS = {
  monsters: decodeMonster,
  spells: decodeSpell,
  items: decodeItem,
  rules: decodeRule,
} as const

/* ---------------------------------------------------------------- search */

const indexes = new Map<FiveKind, Promise<FiveRecord[]>>()

async function loadIndex(kind: FiveKind): Promise<FiveRecord[]> {
  const existing = indexes.get(kind)
  if (existing) return existing

  const run = (async () => {
    const manifest = await loadManifest()
    if (!manifest) return []
    const rows = await getJson<Row[]>(`${kind}/index.json`)
    const decode = DECODERS[kind] as (row: Row, m: FiveManifest) => FiveRecord
    return rows.map((row) => decode(row, manifest))
  })().catch(() => [] as FiveRecord[])

  indexes.set(kind, run)
  return run
}

function fold(s: string): string {
  return s.toLocaleLowerCase('tr')
}

/**
 * Exact match, then prefix, then anything containing the query — the same
 * ordering the live sources are ranked by, so a merged list stays coherent.
 */
function rankAndCap<T extends { name: string }>(items: T[], query: string, limit: number): T[] {
  const q = fold(query)
  const scored = items.map((it) => {
    const n = fold(it.name)
    return { it, score: n === q ? 0 : n.startsWith(q) ? 1 : 2 }
  })
  scored.sort((a, b) => a.score - b.score || a.it.name.localeCompare(b.it.name, 'tr'))
  return scored.slice(0, limit).map((s) => s.it)
}

export interface FiveQuery {
  search?: string
  /** Document slugs to keep; empty means every book. */
  documents?: string[]
  limit?: number
}

async function query<T extends FiveRecord>(
  kind: FiveKind,
  q: FiveQuery,
  extra: (rec: T) => boolean = () => true,
): Promise<T[]> {
  const all = (await loadIndex(kind)) as T[]
  if (!all.length) return []

  const needle = fold(q.search ?? '')
  const docs = q.documents?.length ? new Set(q.documents) : null

  const hits: T[] = []
  for (const rec of all) {
    if (docs && !docs.has(rec.document__slug)) continue
    if (needle && !fold(rec.name).includes(needle)) continue
    if (!extra(rec)) continue
    hits.push(rec)
  }
  return rankAndCap(hits, q.search ?? '', q.limit ?? 40)
}

export function searchMonsters(q: FiveQuery & { cr?: string }): Promise<Monster[]> {
  return query<Monster>('monsters', q, (m) => q.cr === undefined || q.cr === '' || String(m.cr) === q.cr)
}

export function searchSpells(q: FiveQuery & { level?: number }): Promise<Spell[]> {
  return query<Spell>('spells', q, (s) => q.level === undefined || s.level_int === q.level)
}

export function searchItems(q: FiveQuery & { rarity?: string }): Promise<MagicItem[]> {
  return query<MagicItem>('items', q, (i) => !q.rarity || i.rarity === q.rarity)
}

export function searchRules(q: FiveQuery & { kind?: string }): Promise<RuleEntry[]> {
  return query<RuleEntry>('rules', q, (r) => !q.kind || r.kind === q.kind)
}

/* --------------------------------------------------------------- hydrate */

/**
 * Swap an index row for its full record.
 *
 * Safe to call on anything: records that are already complete, or that came
 * from another source entirely, are returned untouched.
 */
export async function hydrate<T extends FiveRecord>(kind: FiveKind, rec: T, signal?: AbortSignal): Promise<T> {
  if (!rec?.partial || rec.shard === undefined) return rec
  const shard = await getJson<T[]>(`${kind}/${String(rec.shard).padStart(3, '0')}.json`, signal)
  const full = shard.find((r) => r.slug === rec.slug)
  return full ? ({ ...full, partial: false } as T) : rec
}

/**
 * Pull the shard a record lives in without waiting for the result.
 *
 * Called on hover: by the time the click lands the shard is usually in memory,
 * so opening a statblock is instant.
 */
export function prefetch(kind: FiveKind, rec: FiveRecord): void {
  if (!rec?.partial || rec.shard === undefined) return
  void getJson(`${kind}/${String(rec.shard).padStart(3, '0')}.json`).catch(() => undefined)
}

/**
 * Load the indexes in the background at boot.
 *
 * They are the only thing standing between a keystroke and a result, and they
 * are local files — reading them early costs nothing and makes the first
 * search as fast as the tenth.
 */
export function warmUp(): void {
  void loadManifest().then((m) => {
    if (!m) return
    for (const kind of ['monsters', 'spells', 'items', 'rules'] as FiveKind[]) void loadIndex(kind)
  })
}
