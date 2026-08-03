/** Dice tray: quick buttons, free expression, and a rolling history. */

import { useState } from 'react'
import { roll, rollD20 } from '../lib/dice'
import { useStore } from '../store/useStore'
import { useUi } from '../store/useUi'
import { Icons, Panel, Empty, RichText } from './ui'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

export function DiceTray() {
  const [expr, setExpr] = useState('')
  const [mod, setMod] = useState(0)
  const { rolls, pushRoll, clearRolls } = useUi()
  const logRoll = useStore((s) => s.logRoll)
  const [tumbling, setTumbling] = useState(false)

  const fire = (expression: string, label?: string) => {
    const r = roll(expression)
    if (r.error) return
    pushRoll(r)
    logRoll(r, label)
    setTumbling(true)
    window.setTimeout(() => setTumbling(false), 620)
  }

  const d20 = (mode: 'normal' | 'adv' | 'dis') => {
    const r = rollD20(mod, mode)
    pushRoll(r)
    logRoll(r, mode === 'adv' ? 'Advantage' : mode === 'dis' ? 'Disadvantage' : undefined)
    setTumbling(true)
    window.setTimeout(() => setTumbling(false), 620)
  }

  const latest = rolls[0]

  return (
    <Panel
      title="Zar"
      icon={<Icons.dice className={tumbling ? 'animate-tumble' : ''} />}
      actions={
        rolls.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={clearRolls}>
            Temizle
          </button>
        )
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-2.5"
    >
      {latest && (
        <div
          className="rounded-2xl px-4 py-3 text-center animate-fade"
          style={{
            background: 'var(--bg-deep)',
            border: `1px solid ${latest.crit === true ? 'var(--sage)' : latest.crit === false ? 'var(--rose)' : 'var(--line-soft)'}`,
          }}
        >
          <div
            className="text-3xl font-bold panel-title leading-none"
            style={{
              color: latest.crit === true ? 'var(--sage)' : latest.crit === false ? 'var(--rose)' : 'var(--accent)',
            }}
          >
            {latest.total}
          </div>
          <p className="text-[0.72rem] mt-1.5" style={{ color: 'var(--ink-mute)' }}>
            <RichText text={latest.breakdown} />
          </p>
          {latest.crit === true && <p className="chip chip-sage mt-1.5">Kritik!</p>}
          {latest.crit === false && <p className="chip chip-rose mt-1.5">Nat 1</p>}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-[0.72rem] shrink-0" style={{ color: 'var(--ink-mute)' }}>
          Mod
        </span>
        <input
          className="field field-sm w-14 text-center"
          type="number"
          value={mod}
          onChange={(e) => setMod(parseInt(e.target.value, 10) || 0)}
        />
        <button className="btn btn-xs flex-1" onClick={() => d20('dis')}>
          Dez
        </button>
        <button className="btn btn-accent btn-xs flex-1" onClick={() => d20('normal')}>
          d20
        </button>
        <button className="btn btn-xs flex-1" onClick={() => d20('adv')}>
          Avantaj
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {QUICK.map((d) => (
          <button key={d} className="btn btn-xs" onClick={() => fire(`1${d}`)}>
            {d}
          </button>
        ))}
        <button className="btn btn-xs" onClick={() => fire('4d6kh3', 'Ability score')} title="4d6, en düşüğü at">
          4d6kh3
        </button>
      </div>

      <div className="flex gap-1.5">
        <input
          className="field"
          placeholder="2d8+1d6+3, 8d6!, 4d6r1…"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && expr.trim()) {
              fire(expr)
              setExpr('')
            }
          }}
        />
        <button
          className="btn"
          disabled={!expr.trim()}
          onClick={() => {
            fire(expr)
            setExpr('')
          }}
        >
          At
        </button>
      </div>

      {rolls.length <= 1 ? (
        <Empty icon={<Icons.dice className="w-7 h-7" />} title="Henüz zar yok" hint="kh/kl (tut), r (yeniden at), ! (patlayan) destekleniyor." />
      ) : (
        <div className="space-y-1">
          {rolls.slice(1).map((r, i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 px-2.5 py-1.5 rounded-xl text-[0.74rem]"
              style={{ background: 'var(--bg-deep)' }}
            >
              <span className="font-semibold w-10 shrink-0" style={{ color: 'var(--accent)' }}>
                {r.total}
              </span>
              <span className="truncate" style={{ color: 'var(--ink-mute)' }}>
                <RichText text={r.breakdown} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
