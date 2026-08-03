/**
 * Unified search over Open5e plus everything in your own brew packs.
 *
 * Homebrew is matched locally and merged ahead of official results — if you
 * wrote your own goblin, that is the one you meant.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  searchMonsters, searchSpells, searchMagicItems, listSources,
  formatCr, OfflineError,
  type Monster, type Spell, type MagicItem, type SourceDoc,
} from '../lib/open5e'
import { useStore, useHomebrewMonsters, useHomebrewSpells, useHomebrewItems } from '../store/useStore'
import { StatBlock, SpellCard, ItemCard } from './StatBlock'
import { Icons, Panel, Empty, Spinner, Modal } from './ui'

type Tab = 'monsters' | 'spells' | 'items'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'monsters', label: 'Yaratıklar' },
  { key: 'spells', label: 'Büyüler' },
  { key: 'items', label: 'Eşyalar' },
]

function matches(name: string, q: string): boolean {
  return name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))
}

export function Compendium({ initialQuery, initialTab }: { initialQuery?: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'monsters')
  const [query, setQuery] = useState(initialQuery ?? '')
  const [cr, setCr] = useState('')
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceDoc[]>([])
  const [showSources, setShowSources] = useState(false)

  const [monsters, setMonsters] = useState<Monster[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [items, setItems] = useState<MagicItem[]>([])
  const [selected, setSelected] = useState<Monster | Spell | MagicItem | null>(null)

  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat)

  const hbMonsters = useHomebrewMonsters()
  const hbSpells = useHomebrewSpells()
  const hbItems = useHomebrewItems()

  // Guards against a slow early request overwriting a newer one's results.
  const reqId = useRef(0)

  useEffect(() => {
    listSources().then(setSources).catch(() => setSources([]))
  }, [])

  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery)
    if (initialTab) setTab(initialTab)
  }, [initialQuery, initialTab])

  const search = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    try {
      if (tab === 'monsters') {
        const res = await searchMonsters({
          search: query,
          cr: cr || undefined,
          documents: settings.sources,
          limit: 40,
        })
        if (id === reqId.current) setMonsters(res.results)
      } else if (tab === 'spells') {
        const res = await searchSpells({
          search: query,
          level: level === '' ? undefined : parseInt(level, 10),
          documents: settings.sources,
          limit: 40,
        })
        if (id === reqId.current) setSpells(res.results)
      } else {
        const res = await searchMagicItems({ search: query, documents: settings.sources, limit: 40 })
        if (id === reqId.current) setItems(res.results)
      }
    } catch (err) {
      if (id !== reqId.current) return
      setError(
        err instanceof OfflineError
          ? 'Çevrimdışısın — sadece homebrew ve daha önce açtıkların görünür.'
          : err instanceof Error
            ? err.message
            : 'Arama başarısız',
      )
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, query, cr, level, settings.sources])

  // Debounce so typing "goblin" is one request, not six.
  useEffect(() => {
    const t = window.setTimeout(search, 320)
    return () => window.clearTimeout(t)
  }, [search])

  const results = useMemo(() => {
    if (tab === 'monsters') {
      const local = hbMonsters.filter((m) => (!query || matches(m.name, query)) && (!cr || String(m.cr) === cr))
      return [...local, ...monsters.filter((m) => !local.some((l) => l.name === m.name))]
    }
    if (tab === 'spells') {
      const local = hbSpells.filter(
        (sp) => (!query || matches(sp.name, query)) && (level === '' || sp.level_int === parseInt(level, 10)),
      )
      return [...local, ...spells.filter((sp) => !local.some((l) => l.name === sp.name))]
    }
    const local = hbItems.filter((it) => !query || matches(it.name, query))
    return [...local, ...items.filter((it) => !local.some((l) => l.name === it.name))]
  }, [tab, query, cr, level, monsters, spells, items, hbMonsters, hbSpells, hbItems])

  const toggleSource = (slug: string) => {
    const cur = settings.sources
    setSettings({ sources: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] })
  }

  return (
    <Panel
      title="Derleme"
      subtitle={`${results.length} sonuç${settings.sources.length ? ` · ${settings.sources.length} kaynak` : ' · tüm kaynaklar'}`}
      icon={<Icons.book />}
      actions={
        <button className="btn btn-xs" onClick={() => setShowSources(true)}>
          Kaynaklar
        </button>
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

      {error && (
        <p className="text-[0.75rem] px-2 py-1.5 rounded-lg" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          {error}
        </p>
      )}

      {loading && !results.length ? (
        <Spinner />
      ) : results.length === 0 ? (
        <Empty icon={<Icons.search className="w-8 h-8" />} title="Sonuç yok" hint="Aramayı sadeleştir veya kaynak filtresini genişlet." />
      ) : (
        <div className="space-y-1">
          {results.map((r) => {
            const isMonster = 'challenge_rating' in r
            const isSpell = 'level_int' in r
            return (
              <div
                key={r.slug}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--bg-deep)' }}
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
                <span className="chip chip-mute shrink-0">{s.license?.includes('ORC') ? 'ORC' : s.license?.includes('Creative') ? 'CC' : 'OGL'}</span>
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
