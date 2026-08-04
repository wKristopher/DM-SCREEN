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
 *   2. The upstreams have very different shapes. dnd5eapi serves SRD only
 *      but answers in ~65ms warm; Open5e carries 10× the catalogue at ~500ms.
 *      Racing them and rendering progressively means results appear at ~65ms
 *      and the long tail fills in behind — instead of waiting 500ms for
 *      everything.
 *
 *   3. A generated 5etools catalogue, when the DM has one, is local: it answers
 *      from an in-memory index in well under a millisecond and carries far more
 *      than either network source. It joins the same race rather than replacing
 *      it, so a screen with no catalogue behaves exactly as before.
 */

import type { Monster, Spell, MagicItem, SourceId } from './open5e'
import { searchMonsters, searchSpells, searchMagicItems, DND5EAPI_PRECONNECT } from './open5e'
import * as srd from './dnd5eapi'
import * as five from './fivetools'
import type { RuleEntry } from './fivetools-convert'

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

/** Options every kind of live search understands. */
export interface LiveScope {
  documents?: string[]
  /** Race the fast SRD mirror alongside the full catalogue. */
  fast?: boolean
  /** Query the generated local 5etools catalogue. */
  local?: boolean
  /** Skip the network sources entirely — 5etools only. */
  localOnly?: boolean
}

/**
 * Split the DM's book filter by which side can answer it — a 5etools document
 * slug never matches an Open5e book, and vice versa.
 *
 * `null` means "no filter, search everything". An empty array means "there is
 * a filter and it excludes this side entirely", which is a different answer
 * and must not collapse back into "search everything".
 */
function docsFor(documents: string[] | undefined, side: 'local' | 'network'): string[] | null {
  if (!documents?.length) return null
  return documents.filter((d) => (d.startsWith('5et-') ? side === 'local' : side === 'network'))
}

/** A side is worth querying unless the filter has ruled out all of its books. */
function inScope(docs: string[] | null): boolean {
  return docs === null || docs.length > 0
}

export interface Side {
  /** Whether to query this side at all. */
  on: boolean
  /** Books to restrict to; undefined means all of them. */
  documents?: string[]
}

/**
 * Decide, once, which sides a search should hit and with what book filter.
 *
 * Skipping a side the filter has excluded is not just tidiness: a network
 * request that cannot match anything still costs the DM half a second of
 * "bekleniyor…" mid-turn.
 */
export function splitScope(q: LiveScope): { local: Side; network: Side } {
  const localDocs = docsFor(q.documents, 'local')
  const netDocs = docsFor(q.documents, 'network')
  return {
    local: { on: (q.local ?? true) && inScope(localDocs), documents: localDocs ?? undefined },
    network: { on: !q.localOnly && inScope(netDocs), documents: netDocs ?? undefined },
  }
}

export interface LiveMonsterQuery extends LiveScope {
  search: string
  cr?: string
}

export function liveSearchMonsters(
  q: LiveMonsterQuery,
  seed: Monster[],
  onSnapshot: OnSnapshot<Monster>,
  signal: AbortSignal,
): Promise<void> {
  const tasks: Array<RaceTask<Monster>> = []
  const { local, network } = splitScope(q)

  if (local.on) {
    tasks.push({
      source: '5etools',
      run: () => five.searchMonsters({ search: q.search, cr: q.cr, documents: local.documents }),
    })
  }

  if (!network.on) return race(tasks, q.search, seed, onSnapshot, signal)

  tasks.push({
    source: 'open5e',
    run: (s) =>
      searchMonsters(
        { search: q.search, cr: q.cr, documents: network.documents, limit: 40 },
        { signal: s },
      ).then((r) => r.results),
  })

  // The fast source only carries SRD, so skip it when the DM has filtered to
  // books it does not have — otherwise it would contribute nothing but latency.
  const srdInScope = (q.fast ?? true) && (!network.documents || network.documents.includes('wotc-srd'))
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

export interface LiveSpellQuery extends LiveScope {
  search: string
  level?: number
}

export function liveSearchSpells(
  q: LiveSpellQuery,
  seed: Spell[],
  onSnapshot: OnSnapshot<Spell>,
  signal: AbortSignal,
): Promise<void> {
  const tasks: Array<RaceTask<Spell>> = []
  const { local, network } = splitScope(q)

  if (local.on) {
    tasks.push({
      source: '5etools',
      run: () => five.searchSpells({ search: q.search, level: q.level, documents: local.documents }),
    })
  }

  if (!network.on) return race(tasks, q.search, seed, onSnapshot, signal)

  tasks.push({
    source: 'open5e',
    run: (s) =>
      searchSpells(
        { search: q.search, level: q.level, documents: network.documents, limit: 40 },
        { signal: s },
      ).then((r) => r.results),
  })

  const srdInScope = (q.fast ?? true) && (!network.documents || network.documents.includes('wotc-srd'))
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
  q: LiveScope & { search: string },
  seed: MagicItem[],
  onSnapshot: OnSnapshot<MagicItem>,
  signal: AbortSignal,
): Promise<void> {
  const tasks: Array<RaceTask<MagicItem>> = []
  const { local, network } = splitScope(q)

  if (local.on) {
    tasks.push({
      source: '5etools',
      run: () => five.searchItems({ search: q.search, documents: local.documents }),
    })
  }

  if (network.on) {
    tasks.push({
      source: 'open5e',
      run: (s) =>
        searchMagicItems({ search: q.search, documents: network.documents, limit: 40 }, { signal: s }).then(
          (r) => r.results,
        ),
    })
  }

  return race(tasks, q.search, seed, onSnapshot, signal)
}

/* ------------------------------------------------------------------ rules */

/**
 * Conditions, diseases, actions, senses and variant rules.
 *
 * Only the local catalogue carries these — Open5e's `sections` endpoint is
 * prose chapters rather than lookup-sized entries, which is the wrong shape
 * for "what does Grappled do again?" mid-turn.
 */
export function liveSearchRules(
  q: LiveScope & { search: string; kind?: string },
  seed: RuleEntry[],
  onSnapshot: OnSnapshot<RuleEntry>,
  signal: AbortSignal,
): Promise<void> {
  const { local } = splitScope(q)
  const tasks: Array<RaceTask<RuleEntry>> = local.on
    ? [
        {
          source: '5etools',
          run: () => five.searchRules({ search: q.search, kind: q.kind, documents: local.documents }),
        },
      ]
    : []

  return race(tasks, q.search, seed, onSnapshot, signal)
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

  // Pull the local search indexes in parallel; they are what make the local
  // catalogue answer instantly, and they cost nothing to read early.
  five.warmUp()

  const ping = (url: string) =>
    fetch(url, { headers: { Accept: 'application/json' }, mode: 'cors' }).catch(() => undefined)

  // Cheapest endpoints on each host — one row apiece.
  void ping(`${DND5EAPI_PRECONNECT}/api/2014/ability-scores/cha`)
  void ping('https://api.open5e.com/v1/documents/?limit=1')
}
