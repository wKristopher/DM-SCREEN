/**
 * Unified search over the local 5etools catalogue, both network upstreams and
 * your own brew packs.
 *
 * Every keystroke queries all of them — there is no "load once and read from
 * storage" step. Results stream in as each source answers, so the local
 * catalogue paints in under a millisecond, the fast SRD mirror follows at
 * ~65ms and the full remote catalogue fills in behind.
 *
 * The local catalogue answers searches from a compact index, so its rows are
 * summaries. The full record is fetched on hover (prefetch) and awaited on
 * click, which is why opening a statblock and adding one to combat both go
 * through `hydrated`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listSources, formatCr, OfflineError,
  type Monster, type Spell, type MagicItem, type SourceDoc, type SourceId,
} from '../lib/open5e'
import {
  liveSearchMonsters, liveSearchSpells, liveSearchItems, liveSearchRules,
  warmUp, type SourceTiming,
} from '../lib/live'
import * as srdApi from '../lib/dnd5eapi'
import * as five from '../lib/fivetools'
import type { RuleEntry } from '../lib/fivetools-convert'
import { useStore, useHomebrewMonsters, useHomebrewSpells, useHomebrewItems } from '../store/useStore'
import { StatBlock, SpellCard, ItemCard, RuleCard } from './StatBlock'
import { Icons, Panel, Empty, Spinner, Modal } from './ui'

type Tab = five.FiveKind
type Result = Monster | Spell | MagicItem | RuleEntry

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'monsters', label: 'Yaratıklar' },
  { key: 'spells', label: 'Büyüler' },
  { key: 'items', label: 'Eşyalar' },
  { key: 'rules', label: 'Kurallar' },
]

const SOURCE_LABEL: Record<SourceId, string> = {
  dnd5eapi: 'SRD (hızlı)',
  open5e: 'Open5e',
  homebrew: 'homebrew',
  '5etools': '5etools (yerel)',
}

const PLACEHOLDER: Record<Tab, string> = {
  monsters: 'goblin, dragon…',
  spells: 'fireball…',
  items: 'bag of holding…',
  rules: 'grappled, dash…',
}

/**
 * Warm connections dominated by round trip, not handshake, so this only needs
 * to be long enough to skip the middle of a word.
 */
const DEBOUNCE_MS = 150

function matches(name: string, q: string): boolean {
  return name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))
}

function isMonster(r: Result): r is Monster {
  return 'challenge_rating' in r
}
function isSpell(r: Result): r is Spell {
  return 'level_int' in r
}
function isItem(r: Result): r is MagicItem {
  return 'rarity' in r
}

function TimingBar({ timings, pending }: { timings: SourceTiming[]; pending: boolean }) {
  if (!timings.length && !pending) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {timings.map((t) => (
        <span
          key={t.source}
          className={`chip ${t.error ? 'chip-rose' : t.ms < 150 ? 'chip-sage' : t.ms < 600 ? 'chip-accent' : 'chip-mute'}`}
          title={t.error ?? `${t.count} sonuç`}
        >
          {SOURCE_LABEL[t.source]} {t.error ? '✕' : `${t.ms}ms`}
        </span>
      ))}
      {pending && <span className="chip chip-mute animate-pulse-soft">bekleniyor…</span>}
    </div>
  )
}

export function Compendium({ initialQuery, initialTab }: { initialQuery?: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'monsters')
  const [query, setQuery] = useState(initialQuery ?? '')
  const [cr, setCr] = useState('')
  const [level, setLevel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceDoc[]>([])
  const [showSources, setShowSources] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('')
  const [catalogue, setCatalogue] = useState<five.FiveManifest | null>(null)

  const [monsters, setMonsters] = useState<Monster[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [items, setItems] = useState<MagicItem[]>([])
  const [rules, setRules] = useState<RuleEntry[]>([])
  const [timings, setTimings] = useState<SourceTiming[]>([])
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState<Result | null>(null)

  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat)

  const hbMonsters = useHomebrewMonsters()
  const hbSpells = useHomebrewSpells()
  const hbItems = useHomebrewItems()

  const abort = useRef<AbortController | null>(null)

  const fiveOn = settings.fiveTools.enabled
  const fiveOnly = settings.fiveTools.enabled && settings.fiveTools.only

  // Pointing at a different catalogue invalidates every cached index, so this
  // has to run before anything queries it.
  useEffect(() => {
    five.setBaseUrl(settings.fiveTools.baseUrl)
  }, [settings.fiveTools.baseUrl])

  useEffect(() => {
    warmUp()
    let alive = true
    void (async () => {
      const [remote, local, manifest] = await Promise.all([
        listSources().catch(() => [] as SourceDoc[]),
        five.listSources().catch(() => [] as SourceDoc[]),
        five.loadManifest().catch(() => null),
      ])
      if (!alive) return
      setCatalogue(manifest)
      setSources([...local, ...remote])
    })()
    return () => {
      alive = false
    }
  }, [settings.fiveTools.baseUrl])

  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery)
    if (initialTab) setTab(initialTab)
  }, [initialQuery, initialTab])

  const search = useCallback(() => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller

    setError(null)
    setPending(true)
    setTimings([])

    const scope = {
      documents: settings.sources,
      fast: settings.fastSource,
      local: fiveOn,
      localOnly: fiveOnly,
    }

    const onError = (err: unknown) => {
      if (controller.signal.aborted) return
      setError(
        err instanceof OfflineError
          ? 'Çevrimdışısın — yerel katalog, homebrew ve son görülenler gösteriliyor.'
          : err instanceof Error
            ? err.message
            : 'Arama başarısız',
      )
    }

    const sink = <T,>(set: (items: T[]) => void) => (snap: { items: T[]; timings: SourceTiming[]; pending: boolean }) => {
      set(snap.items)
      setTimings(snap.timings)
      setPending(snap.pending)
    }

    if (tab === 'monsters') {
      liveSearchMonsters({ ...scope, search: query, cr: cr || undefined }, [], sink(setMonsters), controller.signal)
        .catch(onError)
    } else if (tab === 'spells') {
      liveSearchSpells(
        { ...scope, search: query, level: level === '' ? undefined : parseInt(level, 10) },
        [],
        sink(setSpells),
        controller.signal,
      ).catch(onError)
    } else if (tab === 'items') {
      liveSearchItems({ ...scope, search: query }, [], sink(setItems), controller.signal).catch(onError)
    } else {
      liveSearchRules({ ...scope, search: query }, [], sink(setRules), controller.signal).catch(onError)
    }
  }, [tab, query, cr, level, settings.sources, settings.fastSource, fiveOn, fiveOnly])

  useEffect(() => {
    const t = window.setTimeout(search, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search])

  // Cancel any in-flight request when the panel goes away.
  useEffect(() => () => abort.current?.abort(), [])

  const results: Result[] = useMemo(() => {
    if (tab === 'monsters') {
      const local = hbMonsters.filter((m) => (!query || matches(m.name, query)) && (!cr || String(m.cr) === cr))
      return [...local, ...monsters]
    }
    if (tab === 'spells') {
      const local = hbSpells.filter(
        (sp) => (!query || matches(sp.name, query)) && (level === '' || sp.level_int === parseInt(level, 10)),
      )
      return [...local, ...spells]
    }
    if (tab === 'items') {
      const local = hbItems.filter((it) => !query || matches(it.name, query))
      return [...local, ...items]
    }
    return rules
  }, [tab, query, cr, level, monsters, spells, items, rules, hbMonsters, hbSpells, hbItems])

  /**
   * Warm the detail record while the pointer is on its way to the click.
   * Costs one cheap request — or one local shard read — and removes the wait
   * from opening a statblock.
   */
  const prefetch = (r: Result) => {
    if (r.source === '5etools') return five.prefetch(tab, r)
    if (r.source !== 'dnd5eapi') return
    if (isMonster(r)) void srdApi.getMonster(r.slug).catch(() => undefined)
  }

  /** Index rows carry only what the list needs; everything else awaits this. */
  const hydrated = useCallback(async <T extends Result>(kind: five.FiveKind, r: T): Promise<T> => {
    if (r.source !== '5etools' || !r.partial) return r
    try {
      return await five.hydrate(kind, r)
    } catch {
      setError('Yerel katalog parçası okunamadı — dışa aktarımı yenilemeyi dene.')
      return r
    }
  }, [])

  const open = async (r: Result) => {
    setSelected(r)
    const full = await hydrated(tab, r)
    // The DM may have moved on while the shard was read.
    setSelected((cur) => (cur && cur.slug === r.slug ? full : cur))
  }

  /** Never let a summary row reach the tracker — it would arrive with 0 HP. */
  const toCombat = async (m: Monster, count: number) => {
    addMonsterToCombat(await hydrated('monsters', m), count)
  }

  const toggleSource = (slug: string) => {
    const cur = settings.sources
    setSettings({ sources: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] })
  }

  const visibleSources = useMemo(() => {
    const q = sourceFilter.trim().toLocaleLowerCase('tr')
    return q ? sources.filter((s) => s.title.toLocaleLowerCase('tr').includes(q)) : sources
  }, [sources, sourceFilter])

  const catalogueCount = catalogue
    ? Object.values(catalogue.kinds).reduce((acc, k) => acc + k.count, 0)
    : 0

  return (
    <Panel
      title="Derleme"
      subtitle={`${results.length} sonuç · ${fiveOnly ? 'yerel' : 'canlı'}${settings.sources.length ? ` · ${settings.sources.length} kitap` : ''}`}
      icon={<Icons.book />}
      actions={
        <>
          <button className="btn btn-ghost btn-icon" onClick={search} title="Yenile">
            <Icons.refresh className={pending ? 'animate-pulse-soft' : ''} />
          </button>
          <button className="btn btn-xs" onClick={() => setShowSources(true)}>
            Kaynaklar
          </button>
        </>
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-2.5"
    >
      <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--bg-deep)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className="flex-1 py-1.5 rounded-full text-[0.78rem] font-medium transition-all"
            style={
              tab === t.key
                ? { background: 'var(--raised)', color: 'var(--accent)', boxShadow: 'var(--shadow-soft)' }
                : { color: 'var(--ink-mute)' }
            }
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Icons.search
            className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--ink-mute)' }}
          />
          <input
            className="field pl-8"
            placeholder={PLACEHOLDER[tab]}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {tab === 'monsters' && (
          <select className="field w-24" value={cr} onChange={(e) => setCr(e.target.value)} aria-label="CR">
            <option value="">CR</option>
            {['0', '0.125', '0.25', '0.5', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].map((v) => (
              <option key={v} value={v}>
                {formatCr(parseFloat(v))}
              </option>
            ))}
          </select>
        )}
        {tab === 'spells' && (
          <select className="field w-24" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Seviye">
            <option value="">Sv.</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Cantrip' : `${i}. seviye`}
              </option>
            ))}
          </select>
        )}
      </div>

      {settings.showTimings && <TimingBar timings={timings} pending={pending} />}

      {error && (
        <p className="text-[0.75rem] px-2 py-1.5 rounded-lg" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          {error}
        </p>
      )}

      {tab === 'rules' && !catalogue ? (
        <Empty
          icon={<Icons.book className="w-8 h-8" />}
          title="Yerel katalog yok"
          hint="Kurallar yalnızca 5etools kataloğundan gelir. `npm run data:5etools -- --src <5etools-dizini>` ile oluştur."
        />
      ) : pending && !results.length ? (
        <Spinner label="Kaynaklara soruluyor…" />
      ) : results.length === 0 ? (
        <Empty icon={<Icons.search className="w-8 h-8" />} title="Sonuç yok" hint="Aramayı sadeleştir veya kaynak filtresini genişlet." />
      ) : (
        <div className="space-y-1">
          {results.map((r) => (
            <div
              key={`${r.source ?? 'hb'}:${r.slug}`}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors animate-fade"
              style={{ background: 'var(--bg-deep)' }}
              onMouseEnter={() => prefetch(r)}
              onFocus={() => prefetch(r)}
              onClick={() => void open(r)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[0.84rem] truncate">{r.name}</span>
                  {r.homebrew && <span className="chip chip-violet">HB</span>}
                </div>
                <p className="text-[0.7rem] truncate" style={{ color: 'var(--ink-mute)' }}>
                  {isMonster(r)
                    ? `${r.size} ${r.type} · CR ${formatCr(r.cr)}`
                    : isSpell(r)
                      ? `${r.level_int === 0 ? 'Cantrip' : r.level} · ${r.school}`
                      : isItem(r)
                        ? `${r.rarity} · ${r.type}`
                        : r.kind}
                </p>
              </div>
              {/* The same spell often exists in several books (SRD and A5e both
                  have Fireball). Without the source they are indistinguishable. */}
              {!r.homebrew && (
                <span className="text-[0.62rem] shrink-0 hidden sm:block max-w-24 truncate" style={{ color: 'var(--ink-mute)' }}>
                  {r.document__title}
                </span>
              )}
              {isMonster(r) && (
                <button
                  className="btn btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    void toCombat(r, 1)
                  }}
                  title="Savaşa ekle"
                >
                  <Icons.swords className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} wide>
        {selected?.partial ? (
          <Spinner label="Kayıt açılıyor…" />
        ) : (
          selected && (
            <>
              {isMonster(selected) && (
                <>
                  <StatBlock m={selected} onAdd={() => void toCombat(selected, 1)} />
                  <div className="flex gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <span className="text-[0.75rem] self-center" style={{ color: 'var(--ink-mute)' }}>
                      Toplu ekle:
                    </span>
                    {[2, 3, 4, 6, 8].map((n) => (
                      <button key={n} className="btn btn-xs" onClick={() => void toCombat(selected, n)}>
                        ×{n}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {isSpell(selected) && <SpellCard sp={selected} />}
              {isItem(selected) && <ItemCard it={selected} />}
              {!isMonster(selected) && !isSpell(selected) && !isItem(selected) && <RuleCard r={selected} />}
            </>
          )
        )}
      </Modal>

      <Modal open={showSources} onClose={() => setShowSources(false)} title="Kaynaklar">
        <p className="text-[0.78rem] mb-3" style={{ color: 'var(--ink-mute)' }}>
          Hiçbiri seçili değilse hepsi taranır. Open5e kitapları açık lisanslıdır (OGL / CC / ORC);
          5etools kitapları senin yerel kopyandan üretilir.
        </p>

        <div
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl mb-2"
          style={{ background: 'var(--bg-deep)' }}
        >
          <div className="min-w-0">
            <p className="text-[0.82rem] font-medium">5etools yerel kataloğu</p>
            <p className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
              {catalogue
                ? `${catalogueCount.toLocaleString('tr-TR')} kayıt · ${new Date(catalogue.generatedAt).toLocaleDateString('tr-TR')}`
                : 'Bulunamadı — npm run data:5etools'}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              className={`btn btn-xs ${fiveOn ? 'btn-accent' : ''}`}
              onClick={() => setSettings({ fiveTools: { ...settings.fiveTools, enabled: !fiveOn } })}
              disabled={!catalogue}
            >
              {fiveOn ? 'açık' : 'kapalı'}
            </button>
            <button
              className={`btn btn-xs ${fiveOnly ? 'btn-accent' : ''}`}
              onClick={() => setSettings({ fiveTools: { ...settings.fiveTools, only: !settings.fiveTools.only } })}
              disabled={!catalogue || !fiveOn}
              title="Ağ kaynaklarını tamamen atla"
            >
              yalnız yerel
            </button>
          </div>
        </div>

        <input
          className="field mb-2"
          placeholder="Kitap ara…"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        />

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {visibleSources.map((s) => {
            const on = settings.sources.includes(s.slug)
            const isLocal = s.license === '5etools'
            return (
              <button
                key={s.slug}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-colors"
                style={{
                  background: on ? 'var(--accent-wash)' : 'var(--bg-deep)',
                  border: `1px solid ${on ? 'var(--accent-deep)' : 'transparent'}`,
                }}
                onClick={() => toggleSource(s.slug)}
              >
                <span className="text-[0.82rem] font-medium truncate">{s.title}</span>
                <span className={`chip shrink-0 ${isLocal ? 'chip-sage' : 'chip-mute'}`}>
                  {isLocal
                    ? '5etools'
                    : s.license?.includes('ORC')
                      ? 'ORC'
                      : s.license?.includes('Creative')
                        ? 'CC'
                        : 'OGL'}
                </span>
              </button>
            )
          })}
        </div>
        <button className="btn w-full mt-3" onClick={() => setSettings({ sources: [] })}>
          Filtreyi temizle
        </button>
      </Modal>
    </Panel>
  )
}
