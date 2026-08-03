/**
 * Live query layer.
 *
 * Data is fetched from the network on every search — the cache is a fallback
 * for going offline, never the answer. Two things make that feel instant
 * rather than slow, both driven by measurement:
 *
 *   1. TLS handshakes dominate. Measured cold vs warm on the same connection:
 *      dnd5eapi 684ms → 65ms, Open5e 1012ms → ~500ms. So connections are
 *      opened at boot (see `warmUp` and the preconnect hints in index.html)
 *      and kept alive; almost every real query runs warm.
 *
 *   2. The two upstreams have very different shapes. dnd5eapi serves SRD only
 *      but answers in ~65ms warm; Open5e carries 10× the catalogue at ~500ms.
 *      Racing them and rendering progressively means results appear at ~65ms
 *      and the long tail fills in behind — instead of waiting 500ms for
 *      everything.
 */

import type { Monster, Spell, MagicItem, SourceId } from './open5e'
import { searchMonsters, searchSpells, searchMagicItems, DND5EAPI_PRECONNECT } from './open5e'
import * as srd from './dnd5eapi'

export interface SourceTiming {
  source: SourceId
  ms: number
  count: number
  error?: string
}

export interface LiveSnapshot<T> {
  items: T[]
  timings: SourceTiming[]
  /** True while at least one source is still in flight. */
  pending: boolean
}

export type OnSnapshot<T> = (snap: LiveSnapshot<T>) => void

/** How many SRD detail records to hydrate per search. */
const SRD_DETAIL_LIMIT = 12

/* ------------------------------------------------------------------ merging */

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('tr')
}

/**
 * Merge a newly-arrived batch into what is already on screen.
 *
 * Existing entries win on collision: once the DM is looking at a row, having
 * it swap underneath them because a second source described the same monster
 * is worse than showing slightly different provenance.
 */
function merge<T extends { name: string; document__slug: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((x) => `${nameKey(x.name)}|${x.document__slug}`))
  const added = incoming.filter((x) => !seen.has(`${nameKey(x.name)}|${x.document__slug}`))
  return [...current, ...added]
}

/** Exact matches first, then alphabetical — the thing you typed stays on top. */
function rank<T extends { name: string }>(items: T[], query: string): T[] {
  const q = nameKey(query)
  if (!q) return [...items].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  return [...items].sort((a, b) => {
    const an = nameKey(a.name)
    const bn = nameKey(b.name)
    const aScore = an === q ? 0 : an.startsWith(q) ? 1 : 2
    const bScore = bn === q ? 0 : bn.startsWith(q) ? 1 : 2
    return aScore - bScore || a.name.localeCompare(b.name, 'tr')
  })
}

/* ------------------------------------------------------------------ runner */

interface RaceTask<T> {
  source: SourceId
  run: (signal: AbortSignal) => Promise<T[]>
}

/**
 * Run every source in parallel, emitting a new snapshot each time one lands.
 * A failing source degrades the result set instead of failing the search.
 */
async function race<T extends { name: string; document__slug: string }>(
  tasks: Array<RaceTask<T>>,
  query: string,
  seed: T[],
  onSnapshot: OnSnapshot<T>,
  signal: AbortSignal,
): Promise<void> {
  let items = seed
  const timings: SourceTiming[] = []
  let remaining = tasks.length

  const emit = () => {
    if (signal.aborted) return
    onSnapshot({ items: rank(items, query), timings: [...timings], pending: remaining > 0 })
  }

  emit()

  await Promise.all(
    tasks.map(async (task) => {
      const started = performance.now()
      try {
        const result = await task.run(signal)
        if (signal.aborted) return
        items = merge(items, result)
        timings.push({ source: task.source, ms: Math.round(performance.now() - started), count: result.length })
      } catch (err) {
        if (signal.aborted) return
        timings.push({
          source: task.source,
          ms: Math.round(performance.now() - started),
          count: 0,
          error: err instanceof Error ? err.message : 'hata',
        })
      } finally {
        remaining--
        emit()
      }
    }),
  )
}

/* ------------------------------------------------------------------ monsters */

export interface LiveMonsterQuery {
  search: string
  cr?: string
  documents?: string[]
  /** Race the fast SRD mirror alongside the full catalogue. */
  fast?: boolean
}

export function liveSearchMonsters(
  q: LiveMonsterQuery,
  seed: Monster[],
  onSnapshot: OnSnapshot<Monster>,
  signal: AbortSignal,
): Promise<void> {
  const tasks: Array<RaceTask<Monster>> = [
    {
      source: 'open5e',
      run: (s) =>
        searchMonsters({ search: q.search, cr: q.cr, documents: q.documents, limit: 40 }, { signal: s }).then(
          (r) => r.results,
        ),
    },
  ]

  // The fast source only carries SRD, so skip it when the DM has filtered to
  // books it does not have — otherwise it would contribute nothing but latency.
  const srdInScope = (q.fast ?? true) && (!q.documents?.length || q.documents.includes('wotc-srd'))
  if (srdInScope) {
    tasks.push({
      source: 'dnd5eapi',
      run: async (s) => {
        const names = await srd.searchMonsterNames(q.search, s)
        if (!names.length) return []
        // Detail fetches go out together on the warm connection, so a page of
        // twelve costs about as much as one.
        const monsters = await srd.getMonsters(
          names.slice(0, SRD_DETAIL_LIMIT).map((n) => n.index),
          s,
        )
        return q.cr ? monsters.filter((m) => String(m.cr) === q.cr) : monsters
      },
    })
  }

  return race(tasks, q.search, seed, onSnapshot, signal)
}

/* ------------------------------------------------------------------ spells */

export interface LiveSpellQuery {
  search: string
  level?: number
  documents?: string[]
  fast?: boolean
}

export function liveSearchSpells(
  q: LiveSpellQuery,
  seed: Spell[],
  onSnapshot: OnSnapshot<Spell>,
  signal: AbortSignal,
): Promise<void> {
  const tasks: Array<RaceTask<Spell>> = [
    {
      source: 'open5e',
      run: (s) =>
        searchSpells({ search: q.search, level: q.level, documents: q.documents, limit: 40 }, { signal: s }).then(
          (r) => r.results,
        ),
    },
  ]

  const srdInScope = (q.fast ?? true) && (!q.documents?.length || q.documents.includes('wotc-srd'))
  if (srdInScope) {
    tasks.push({
      source: 'dnd5eapi',
      run: async (s) => {
        const names = await srd.searchSpellNames(q.search, s)
        if (!names.length) return []
        const spells = await srd.getSpells(
          names.slice(0, SRD_DETAIL_LIMIT).map((n) => n.index),
          s,
        )
        return q.level === undefined ? spells : spells.filter((sp) => sp.level_int === q.level)
      },
    })
  }

  return race(tasks, q.search, seed, onSnapshot, signal)
}

/* ------------------------------------------------------------------ items */

export function liveSearchItems(
  q: { search: string; documents?: string[] },
  seed: MagicItem[],
  onSnapshot: OnSnapshot<MagicItem>,
  signal: AbortSignal,
): Promise<void> {
  return race(
    [
      {
        source: 'open5e',
        run: (s) =>
          searchMagicItems({ search: q.search, documents: q.documents, limit: 40 }, { signal: s }).then((r) => r.results),
      },
    ],
    q.search,
    seed,
    onSnapshot,
    signal,
  )
}

/* ------------------------------------------------------------------ warm-up */

let warmed = false

/**
 * Open both connections at boot.
 *
 * `<link rel="preconnect">` covers DNS + TCP + TLS, which measured as ~90% of
 * a cold request. This follows it with a tiny real request so the HTTP/2
 * session is fully established and the first search a DM runs is a warm one.
 */
export function warmUp(): void {
  if (warmed || typeof fetch === 'undefined') return
  warmed = true

  const ping = (url: string) =>
    fetch(url, { headers: { Accept: 'application/json' }, mode: 'cors' }).catch(() => undefined)

  // Cheapest endpoints on each host — one row apiece.
  void ping(`${DND5EAPI_PRECONNECT}/api/2014/ability-scores/cha`)
  void ping('https://api.open5e.com/v1/documents/?limit=1')
}
