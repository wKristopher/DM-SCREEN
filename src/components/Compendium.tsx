/**
 * Unified live search over both upstreams plus your own brew packs.
 *
 * Every keystroke queries the network — there is no "load once and read from
 * storage" step. Results stream in as each source answers, so the fast SRD
 * mirror paints in ~65ms on a warm connection and the full catalogue fills in
 * behind it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listSources, formatCr, OfflineError,
  type Monster, type Spell, type MagicItem, type SourceDoc, type SourceId,
} from '../lib/open5e'
import { liveSearchMonsters, liveSearchSpells, liveSearchItems, warmUp, type SourceTiming } from '../lib/live'
import * as srdApi from '../lib/dnd5eapi'
import { useStore, useHomebrewMonsters, useHomebrewSpells, useHomebrewItems } from '../store/useStore'
import { StatBlock, SpellCard, ItemCard } from './StatBlock'
import { Icons, Panel, Empty, Spinner, Modal } from './ui'

type Tab = 'monsters' | 'spells' | 'items'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'monsters', label: 'Yaratıklar' },
  { key: 'spells', label: 'Büyüler' },
  { key: 'items', label: 'Eşyalar' },
]

const SOURCE_LABEL: Record<SourceId, string> = {
  dnd5eapi: 'SRD (hızlı)',
  open5e: 'Open5e',
  homebrew: 'homebrew',
}

/**
 * Warm connections dominated by round trip, not handshake, so this only needs
 * to be long enough to skip the middle of a word.
 */
const DEBOUNCE_MS = 150

function matches(name: string, q: string): boolean {
  return name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))
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

  const [monsters, setMonsters] = useState<Monster[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [items, setItems] = useState<MagicItem[]>([])
  const [timings, setTimings] = useState<SourceTiming[]>([])
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState<Monster | Spell | MagicItem | null>(null)

  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat)

  const hbMonsters = useHomebrewMonsters()
  const hbSpells = useHomebrewSpells()
  const hbItems = useHomebrewItems()

  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    warmUp()
    listSources().then(setSources).catch(() => setSources([]))
  }, [])

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

    const docs = settings.sources
    const onError = (err: unknown) => {
      if (controller.signal.aborted) return
      setError(
        err instanceof OfflineError
          ? 'Çevrimdışısın — homebrew ve son görülenler gösteriliyor.'
          : err instanceof Error
            ? err.message
            : 'Arama başarısız',
      )
    }

    if (tab === 'monsters') {
      liveSearchMonsters(
        { search: query, cr: cr || undefined, documents: docs, fast: settings.fastSource },
        [],
        (snap) => {
          setMonsters(snap.items)
          setTimings(snap.timings)
          setPending(snap.pending)
        },
        controller.signal,
      ).catch(onError)
    } else if (tab === 'spells') {
      liveSearchSpells(
        { search: query, level: level === '' ? undefined : parseInt(level, 10), documents: docs, fast: settings.fastSource },
        [],
        (snap) => {
          setSpells(snap.items)
          setTimings(snap.timings)
          setPending(snap.pending)
        },
        controller.signal,
      ).catch(onError)
    } else {
      liveSearchItems(
        { search: query, documents: docs },
        [],
        (snap) => {
          setItems(snap.items)
          setTimings(snap.timings)
          setPending(snap.pending)
        },
        controller.signal,
      ).catch(onError)
    }
  }, [tab, query, cr, level, settings.sources, settings.fastSource])

  useEffect(() => {
    const t = window.setTimeout(search, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search])

  // Cancel any in-flight request when the panel goes away.
  useEffect(() => () => abort.current?.abort(), [])

  const results = useMemo(() => {
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
    const local = hbItems.filter((it) => !query || matches(it.name, query))
    return [...local, ...items]
  }, [tab, query, cr, level, monsters, spells, items, hbMonsters, hbSpells, hbItems])

  /**
   * Warm the detail record while the pointer is on its way to the click.
   * Costs one cheap request and removes the wait from opening a statblock.
   */
  const prefetch = (r: Monster | Spell | MagicItem) => {
    if (r.source !== 'dnd5eapi') return
    if ('challenge_rating' in r) void srdApi.getMonster(r.slug).catch(() => undefined)
  }

  const toggleSource = (slug: string) => {
    const cur = settings.sources
    setSettings({ sources: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] })
  }

  return (
    <Panel
      title="Derleme"
      subtitle={`${results.length} sonuç · canlı${settings.sources.length ? ` · ${settings.sources.length} kitap` : ''}`}
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
            placeholder={tab === 'monsters' ? 'goblin, dragon…' : tab === 'spells' ? 'fireball…' : 'bag of holding…'}
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

      {pending && !results.length ? (
        <Spinner label="Kaynaklara soruluyor…" />
      ) : results.length === 0 ? (
        <Empty icon={<Icons.search className="w-8 h-8" />} title="Sonuç yok" hint="Aramayı sadeleştir veya kaynak filtresini genişlet." />
      ) : (
        <div className="space-y-1">
          {results.map((r) => {
            const isMonster = 'challenge_rating' in r
            const isSpell = 'level_int' in r
            return (
              <div
                key={`${r.source ?? 'hb'}:${r.slug}`}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors animate-fade"
                style={{ background: 'var(--bg-deep)' }}
                onMouseEnter={() => prefetch(r)}
                onFocus={() => prefetch(r)}
                onClick={() => setSelected(r)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[0.84rem] truncate">{r.name}</span>
                    {r.homebrew && <span className="chip chip-violet">HB</span>}
                  </div>
                  <p className="text-[0.7rem] truncate" style={{ color: 'var(--ink-mute)' }}>
                    {isMonster
                      ? `${(r as Monster).size} ${(r as Monster).type} · CR ${formatCr((r as Monster).cr)}`
                      : isSpell
                        ? `${(r as Spell).level_int === 0 ? 'Cantrip' : (r as Spell).level} · ${(r as Spell).school}`
                        : `${(r as MagicItem).rarity} · ${(r as MagicItem).type}`}
                  </p>
                </div>
                {/* The same spell often exists in several books (SRD and A5e both
                    have Fireball). Without the source they are indistinguishable. */}
                {!r.homebrew && (
                  <span className="text-[0.62rem] shrink-0 hidden sm:block max-w-24 truncate" style={{ color: 'var(--ink-mute)' }}>
                    {r.document__title}
                  </span>
                )}
                {isMonster && (
                  <button
                    className="btn btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      addMonsterToCombat(r as Monster, 1)
                    }}
                    title="Savaşa ekle"
                  >
                    <Icons.swords className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} wide>
        {selected && 'challenge_rating' in selected && (
          <>
            <StatBlock m={selected as Monster} onAdd={() => addMonsterToCombat(selected as Monster, 1)} />
            <div className="flex gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <span className="text-[0.75rem] self-center" style={{ color: 'var(--ink-mute)' }}>
                Toplu ekle:
              </span>
              {[2, 3, 4, 6, 8].map((n) => (
                <button key={n} className="btn btn-xs" onClick={() => addMonsterToCombat(selected as Monster, n)}>
                  ×{n}
                </button>
              ))}
            </div>
          </>
        )}
        {selected && 'level_int' in selected && <SpellCard sp={selected as Spell} />}
        {selected && 'rarity' in selected && <ItemCard it={selected as MagicItem} />}
      </Modal>

      <Modal open={showSources} onClose={() => setShowSources(false)} title="Kaynaklar">
        <p className="text-[0.78rem] mb-3" style={{ color: 'var(--ink-mute)' }}>
          Hiçbiri seçili değilse hepsi taranır. Hepsi açık lisanslı (OGL / CC / ORC) içeriktir.
        </p>
        <div className="space-y-1">
          {sources.map((s) => {
            const on = settings.sources.includes(s.slug)
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
                <span className="chip chip-mute shrink-0">
                  {s.license?.includes('ORC') ? 'ORC' : s.license?.includes('Creative') ? 'CC' : 'OGL'}
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
