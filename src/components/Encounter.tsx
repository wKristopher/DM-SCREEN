/** XP budget calculator — how hard is this fight, actually. */

import { useMemo, useState } from 'react'
import { XP_THRESHOLDS, encounterMultiplier } from '../lib/srd'
import { searchMonsters, xpForCr, formatCr, type Monster } from '../lib/open5e'
import { useStore, useHomebrewMonsters } from '../store/useStore'
import { Icons, Panel, Empty, Modal } from './ui'
import { useUi } from '../store/useUi'

interface Slot {
  monster: Monster
  count: number
}

const DIFFICULTY = [
  { key: 'Kolay', color: 'var(--sage)' },
  { key: 'Orta', color: 'var(--accent)' },
  { key: 'Zor', color: 'var(--rose)' },
  { key: 'Ölümcül', color: 'var(--violet)' },
] as const

export function EncounterBuilder() {
  const party = useStore((s) => s.party)
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat)
  const hbMonsters = useHomebrewMonsters()

  const [slots, setSlots] = useState<Slot[]>([])
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Monster[]>([])
  // Fall back to a generic party when the roster is empty, so the tool is
  // usable before anyone has entered their characters.
  const [fallbackSize, setFallbackSize] = useState(4)
  const [fallbackLevel, setFallbackLevel] = useState(3)
  const [showLibrary, setShowLibrary] = useState(false)

  const encounters = useStore((s) => s.encounters)
  const saveEncounter = useStore((s) => s.saveEncounter)
  const removeEncounter = useStore((s) => s.removeEncounter)
  const setToast = useUi((s) => s.setToast)

  const partySize = party.length || fallbackSize
  const levels = party.length ? party.map((p) => p.level) : Array.from({ length: fallbackSize }, () => fallbackLevel)

  const thresholds = useMemo(() => {
    const totals = [0, 0, 0, 0]
    for (const lvl of levels) {
      const row = XP_THRESHOLDS[Math.max(1, Math.min(20, lvl))]
      for (let i = 0; i < 4; i++) totals[i] += row[i]
    }
    return totals
  }, [levels])

  const { rawXp, adjustedXp, monsterCount, difficulty } = useMemo(() => {
    const count = slots.reduce((n, s) => n + s.count, 0)
    const raw = slots.reduce((n, s) => n + xpForCr(s.monster.cr) * s.count, 0)
    const adjusted = Math.round(raw * encounterMultiplier(count, partySize))

    let diff = 'Önemsiz'
    if (adjusted >= thresholds[3]) diff = 'Ölümcül'
    else if (adjusted >= thresholds[2]) diff = 'Zor'
    else if (adjusted >= thresholds[1]) diff = 'Orta'
    else if (adjusted >= thresholds[0]) diff = 'Kolay'

    return { rawXp: raw, adjustedXp: adjusted, monsterCount: count, difficulty: diff }
  }, [slots, partySize, thresholds])

  const doSearch = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setFound([])
      return
    }
    const local = hbMonsters.filter((m) => m.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))

    // Paint the homebrew matches first. They are already in memory, so making
    // them wait on a network round trip is pure delay — and when the network is
    // down that delay is the full request timeout, during which the panel looks
    // empty despite having something to show.
    setFound(local)

    try {
      const res = await searchMonsters({ search: q, limit: 8 })
      // A slower response for an older query must not overwrite a newer one.
      setQuery((current) => {
        if (current === q) setFound([...local, ...res.results].slice(0, 10))
        return current
      })
    } catch {
      /* the local matches are already on screen */
    }
  }

  const add = (m: Monster) => {
    setSlots((prev) => {
      const i = prev.findIndex((s) => s.monster.slug === m.slug)
      if (i === -1) return [...prev, { monster: m, count: 1 }]
      return prev.map((s, j) => (j === i ? { ...s, count: s.count + 1 } : s))
    })
    setQuery('')
    setFound([])
  }

  const bump = (slug: string, d: number) =>
    setSlots((prev) =>
      prev.map((s) => (s.monster.slug === slug ? { ...s, count: Math.max(0, s.count + d) } : s)).filter((s) => s.count > 0),
    )

  const diffColor = DIFFICULTY.find((d) => d.key === difficulty)?.color ?? 'var(--ink-mute)'
  const maxScale = Math.max(thresholds[3] * 1.25, adjustedXp, 1)

  return (
    <Panel
      title="Karşılaşma Kurucu"
      subtitle={party.length ? `${party.length} kişilik grup` : 'Örnek grup (roster boş)'}
      icon={<Icons.skull />}
      actions={
        <>
          {slots.length > 0 && (
            <>
              <button
                className="btn btn-accent btn-xs"
                onClick={() => {
                  slots.forEach((s) => addMonsterToCombat(s.monster, s.count))
                  setSlots([])
                }}
              >
                <Icons.swords className="w-3 h-3" /> Savaşa gönder
              </button>
              <button
                className="btn btn-xs"
                onClick={() => {
                  const name = window.prompt('Karşılaşma adı:', slots.map((s) => s.monster.name).join(', ').slice(0, 40))
                  if (name === null) return
                  saveEncounter(name, slots)
                  setToast(`"${name || 'Adsız karşılaşma'}" kaydedildi`)
                }}
                title="Bu kurulumu sakla"
              >
                <Icons.download className="w-3 h-3" /> Kaydet
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setSlots([])}>
                Temizle
              </button>
            </>
          )}
          {encounters.length > 0 && (
            <button className="btn btn-xs" onClick={() => setShowLibrary(true)}>
              Hazırlar {encounters.length}
            </button>
          )}
        </>
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-3"
    >
      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Hazır karşılaşmalar">
        <div className="space-y-1.5">
          {encounters.map((e) => {
            const n = e.slots.reduce((t, s) => t + s.count, 0)
            return (
              <div key={e.id} className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-deep)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-[0.84rem] truncate flex-1">{e.name}</span>
                  <span className="text-[0.68rem] shrink-0" style={{ color: 'var(--ink-mute)' }}>
                    {n} yaratık
                  </span>
                </div>
                <p className="text-[0.7rem] truncate mb-1.5" style={{ color: 'var(--ink-mute)' }}>
                  {e.slots.map((s) => `${s.count}× ${s.monster.name}`).join(', ')}
                </p>
                <div className="flex gap-1.5">
                  <button
                    className="btn btn-accent btn-xs flex-1"
                    onClick={() => {
                      e.slots.forEach((s) => addMonsterToCombat(s.monster, s.count))
                      setShowLibrary(false)
                      setToast(`"${e.name}" savaşa gönderildi`)
                    }}
                  >
                    <Icons.swords className="w-3 h-3" /> Savaşa
                  </button>
                  <button
                    className="btn btn-xs flex-1"
                    onClick={() => {
                      setSlots(e.slots.map((s) => ({ ...s })))
                      setShowLibrary(false)
                    }}
                    title="Kurucuya yükle, üstünde oyna"
                  >
                    Kurucuya
                  </button>
                  <button
                    className="btn btn-icon btn-ghost"
                    style={{ color: 'var(--rose)' }}
                    onClick={() => removeEncounter(e.id)}
                  >
                    <Icons.trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {!party.length && (
        <div className="flex items-end gap-2 rounded-xl p-2.5" style={{ background: 'var(--bg-deep)' }}>
          <label className="flex-1">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Kişi sayısı
            </span>
            <input
              className="field field-sm text-center"
              type="number"
              min={1}
              max={8}
              value={fallbackSize}
              onChange={(e) => setFallbackSize(Math.max(1, Math.min(8, +e.target.value || 1)))}
            />
          </label>
          <label className="flex-1">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Seviye
            </span>
            <input
              className="field field-sm text-center"
              type="number"
              min={1}
              max={20}
              value={fallbackLevel}
              onChange={(e) => setFallbackLevel(Math.max(1, Math.min(20, +e.target.value || 1)))}
            />
          </label>
        </div>
      )}

      <div className="relative">
        <Icons.search
          className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ink-mute)' }}
        />
        <input
          className="field pl-8"
          placeholder="Yaratık ara ve ekle…"
          value={query}
          onChange={(e) => doSearch(e.target.value)}
        />
        {found.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 surface p-1 max-h-56 overflow-auto" style={{ boxShadow: 'var(--shadow-lift)' }}>
            {found.map((m) => (
              <button
                key={m.slug}
                className="w-full text-left px-3 py-1.5 rounded-lg text-[0.8rem] flex items-center justify-between gap-2 hover:brightness-125 transition"
                style={{ background: 'transparent' }}
                onClick={() => add(m)}
              >
                <span className="truncate">
                  {m.name} {m.homebrew && <span className="chip chip-violet">HB</span>}
                </span>
                <span className="shrink-0" style={{ color: 'var(--ink-mute)' }}>
                  CR {formatCr(m.cr)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {slots.length === 0 ? (
        <Empty icon={<Icons.skull className="w-8 h-8" />} title="Karşılaşma boş" hint="Yaratık ekle, zorluk anında hesaplansın." />
      ) : (
        <div className="space-y-1">
          {slots.map((s) => (
            <div key={s.monster.slug} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
              <div className="min-w-0 flex-1">
                <span className="text-[0.84rem] font-medium truncate block">{s.monster.name}</span>
                <span className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                  CR {formatCr(s.monster.cr)} · {xpForCr(s.monster.cr).toLocaleString('tr-TR')} XP
                </span>
              </div>
              <button className="btn btn-xs" onClick={() => bump(s.monster.slug, -1)}>
                −
              </button>
              <span className="w-6 text-center font-semibold text-[0.84rem]">{s.count}</span>
              <button className="btn btn-xs" onClick={() => bump(s.monster.slug, 1)}>
                +
              </button>
            </div>
          ))}
        </div>
      )}

      {/* difficulty gauge */}
      <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--bg-deep)' }}>
        <div className="flex items-baseline justify-between">
          <span className="panel-title font-semibold text-[1.05rem]" style={{ color: diffColor }}>
            {difficulty}
          </span>
          <span className="text-[0.72rem]" style={{ color: 'var(--ink-mute)' }}>
            {adjustedXp.toLocaleString('tr-TR')} XP
            {monsterCount > 1 && ` (×${encounterMultiplier(monsterCount, partySize)})`}
          </span>
        </div>

        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--line-soft)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (adjustedXp / maxScale) * 100)}%`, background: diffColor }}
          />
          {thresholds.map((t, i) => (
            <div
              key={i}
              className="absolute inset-y-0 w-px"
              style={{ left: `${Math.min(100, (t / maxScale) * 100)}%`, background: 'var(--ink-mute)', opacity: 0.5 }}
              title={DIFFICULTY[i].key}
            />
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          {DIFFICULTY.map((d, i) => (
            <div key={d.key}>
              <div className="text-[0.62rem] uppercase tracking-wide" style={{ color: d.color }}>
                {d.key}
              </div>
              <div className="text-[0.72rem]" style={{ color: 'var(--ink-mute)' }}>
                {thresholds[i].toLocaleString('tr-TR')}
              </div>
            </div>
          ))}
        </div>

        {monsterCount > 0 && (
          <p className="text-[0.7rem] pt-1" style={{ color: 'var(--ink-mute)' }}>
            Ham XP {rawXp.toLocaleString('tr-TR')} · {monsterCount} yaratık · grup ödülü{' '}
            {party.length ? Math.round(rawXp / party.length).toLocaleString('tr-TR') : Math.round(rawXp / fallbackSize).toLocaleString('tr-TR')} XP/kişi
          </p>
        )}
      </div>
    </Panel>
  )
}
