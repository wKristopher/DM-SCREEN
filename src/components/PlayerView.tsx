/**
 * The screen the players look at.
 *
 * Opened as a second window and dragged onto a TV or a spare monitor. It is
 * the same app, the same origin and the same login — no second account, no
 * second device, no server in between, which is the part that makes this
 * practical at a real table.
 *
 * State crosses over through localStorage: the DM's window persists on every
 * change, and the `storage` event fires in *other* tabs of the same origin,
 * so this one rehydrates the moment anything moves. That event never fires in
 * the tab that caused it, which is exactly the shape needed here.
 *
 * Everything is sized for a screen being read from across a table, and what it
 * may show at all is decided in lib/table.ts rather than here.
 */

import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { tableRows, activeRowId } from '../lib/table'
import { Icons } from './ui'

/** The hash that turns this window into the player screen. */
export const PLAYER_HASH = '#/masa'

export function isPlayerWindow(): boolean {
  return typeof location !== 'undefined' && location.hash === PLAYER_HASH
}

export function openPlayerWindow(): void {
  window.open(`${location.origin}${location.pathname}${PLAYER_HASH}`, 'kahin-masa', 'width=1100,height=800')
}

/** Pull the DM window's writes into this one. */
function useMirror(): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'kahin.state') void useStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
}

export function PlayerView() {
  useMirror()

  const combatants = useStore((s) => s.combatants)
  const round = useStore((s) => s.round)
  const turn = useStore((s) => s.turn)
  const combatActive = useStore((s) => s.combatActive)
  const headline = useStore((s) => s.headline)

  const rows = tableRows(combatants)
  const activeId = activeRowId(combatants, turn)

  return (
    <div className="min-h-screen px-6 py-6 sm:px-10 sm:py-8" style={{ background: 'var(--bg)' }}>
      <header className="flex items-baseline justify-between gap-4 mb-6">
        <h1 className="panel-title text-2xl sm:text-3xl font-bold">
          {combatActive ? `Tur ${round}` : 'Masa'}
        </h1>
        <span className="text-[0.8rem]" style={{ color: 'var(--ink-mute)' }}>
          oyuncu ekranı
        </span>
      </header>

      {headline && (
        <p
          className="mb-6 rounded-2xl px-5 py-4 text-xl sm:text-2xl leading-snug whitespace-pre-wrap"
          style={{ background: 'var(--bg-deep)', color: 'var(--ink-soft)' }}
        >
          {headline}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-center text-lg py-16" style={{ color: 'var(--ink-mute)' }}>
          {headline ? '' : 'Henüz kimse sırada değil.'}
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const active = r.id === activeId
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors"
                style={{
                  background: active ? 'var(--accent-wash, var(--bg-deep))' : 'var(--bg-deep)',
                  border: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  opacity: r.down ? 0.55 : 1,
                }}
              >
                <span
                  className="w-12 shrink-0 text-center text-xl font-bold tabular-nums"
                  style={{ color: active ? 'var(--accent)' : 'var(--ink-mute)' }}
                >
                  {r.initiative}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xl sm:text-2xl font-semibold truncate"
                      style={{ textDecoration: r.down ? 'line-through' : undefined }}
                    >
                      {r.name}
                    </span>
                    {r.isPc && <span className="chip chip-azure">PC</span>}
                    {r.concentrating && <span className="chip chip-violet">konsantrasyon</span>}
                    {r.conditions.map((c) => (
                      <span key={c} className="chip chip-rose">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {r.isPc ? (
                    <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ink-soft)' }}>
                      {r.hp}
                      <span style={{ color: 'var(--ink-mute)' }}>/{r.maxHp}</span>
                      {r.tempHp > 0 && <span className="chip chip-azure ml-1.5">+{r.tempHp}</span>}
                    </span>
                  ) : (
                    <span className="text-base" style={{ color: r.down ? 'var(--ink-mute)' : 'var(--rose)' }}>
                      {r.woundLabel}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ control */

/** The DM-side control: open the window, and push a line to it. */
export function PlayerScreenControl() {
  const headline = useStore((s) => s.headline)
  const setHeadline = useStore((s) => s.setHeadline)

  return (
    <div className="flex gap-1.5">
      <input
        className="field field-sm flex-1"
        placeholder="Masaya yaz: “Kapı içeriden sürgülü.”"
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
      />
      {headline && (
        <button className="btn btn-icon btn-ghost" title="Yazıyı kaldır" onClick={() => setHeadline('')}>
          <Icons.x className="w-3.5 h-3.5" />
        </button>
      )}
      <button className="btn btn-xs" onClick={openPlayerWindow} title="Oyuncu ekranını ayrı pencerede aç">
        <Icons.eye className="w-3 h-3" /> Oyuncu ekranı
      </button>
    </div>
  )
}
