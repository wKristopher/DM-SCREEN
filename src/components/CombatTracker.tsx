/** Initiative order, HP, conditions, concentration, death saves. */

import { useState } from 'react'
import { useStore, type Combatant } from '../store/useStore'
import { CONDITIONS } from '../lib/srd'
import { roll, signed } from '../lib/dice'
import { StatBlock } from './StatBlock'
import { Icons, Panel, Empty, Modal, Hp, RichText } from './ui'

function ConditionPicker({ c, onClose }: { c: Combatant; onClose: () => void }) {
  const toggleCondition = useStore((s) => s.toggleCondition)
  return (
    <div className="space-y-1.5">
      {CONDITIONS.map((cond) => {
        const active = c.conditions.some((x) => x.name === cond.name)
        return (
          <button
            key={cond.name}
            className="w-full text-left rounded-xl px-3 py-2 transition-colors"
            style={{
              background: active ? 'var(--rose-wash)' : 'var(--bg-deep)',
              border: `1px solid ${active ? 'var(--rose)' : 'transparent'}`,
            }}
            onClick={() => toggleCondition(c.id, cond.name)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[0.82rem]" style={{ color: active ? 'var(--rose)' : 'var(--ink)' }}>
                {cond.name}
              </span>
              {cond.tag && <span className="chip chip-mute">{cond.tag}</span>}
            </div>
            <p className="text-[0.72rem] mt-0.5 leading-snug" style={{ color: 'var(--ink-mute)' }}>
              <RichText text={cond.desc} />
            </p>
          </button>
        )
      })}
      <button className="btn w-full mt-2" onClick={onClose}>
        Bitti
      </button>
    </div>
  )
}

function DeathSaves({ c }: { c: Combatant }) {
  const markDeathSave = useStore((s) => s.markDeathSave)
  const logRoll = useStore((s) => s.logRoll)
  const pushLog = useStore((s) => s.pushLog)

  return (
    <div className="flex items-center gap-3 pt-1.5">
      <button
        className="btn btn-xs"
        onClick={() => {
          const r = roll('1d20')
          logRoll(r, `${c.name} death save`)
          if (r.total === 20) {
            useStore.getState().heal(c.id, 1)
            pushLog('combat', `${c.name} nat 20 — 1 HP ile ayıldı`)
          } else if (r.total === 1) {
            markDeathSave(c.id, 'failure', 2)
          } else if (r.total >= 10) {
            markDeathSave(c.id, 'success', 1)
          } else {
            markDeathSave(c.id, 'failure', 1)
          }
        }}
      >
        <Icons.dice className="w-3 h-3" /> Death save
      </button>

      {(['success', 'failure'] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-1">
          <span className="text-[0.65rem]" style={{ color: 'var(--ink-mute)' }}>
            {kind === 'success' ? 'Başarı' : 'Hata'}
          </span>
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className="w-3.5 h-3.5 rounded-full transition-all"
              style={{
                background:
                  c.deathSaves[kind] > i
                    ? kind === 'success'
                      ? 'var(--sage)'
                      : 'var(--rose)'
                    : 'var(--line)',
              }}
              onClick={() => markDeathSave(c.id, kind, c.deathSaves[kind] > i ? -1 : 1)}
              aria-label={`${kind} ${i + 1}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Row({ c, index }: { c: Combatant; index: number }) {
  const { turn, combatActive, updateCombatant, removeCombatant, damage, heal, toggleCondition, setConcentration } =
    useStore()
  const showHpBars = useStore((s) => s.settings.showHpBars)
  const pushLog = useStore((s) => s.pushLog)
  const logRoll = useStore((s) => s.logRoll)

  const [delta, setDelta] = useState('')
  const [showConditions, setShowConditions] = useState(false)
  const [showStat, setShowStat] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isActive = combatActive && turn === index
  const down = c.hp === 0

  const apply = (sign: 1 | -1) => {
    const n = parseInt(delta, 10)
    if (!Number.isFinite(n) || n <= 0) return
    if (sign === -1) {
      damage(c.id, n)
      pushLog('combat', `${c.name} ${n} hasar aldı`)
      // Concentration is the rule everyone forgets; surface the DC immediately.
      if (c.concentration) {
        pushLog('combat', `${c.name} concentration check: DC ${Math.max(10, Math.floor(n / 2))} CON save`, c.concentration)
      }
    } else {
      heal(c.id, n)
      pushLog('combat', `${c.name} ${n} iyileşti`)
    }
    setDelta('')
  }

  return (
    <div
      className="rounded-2xl transition-all duration-200"
      style={{
        background: isActive ? 'var(--accent-wash)' : 'var(--bg-deep)',
        border: `1px solid ${isActive ? 'var(--accent-deep)' : 'transparent'}`,
        boxShadow: isActive ? 'var(--glow)' : 'none',
        opacity: down && !c.isPc ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* initiative */}
        <input
          className="field field-sm w-11 text-center font-semibold shrink-0"
          value={c.initiative}
          onChange={(e) => updateCombatant(c.id, { initiative: parseInt(e.target.value, 10) || 0 })}
          aria-label="İnisiyatif"
        />

        {/* name + meta */}
        <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-1.5">
            <span
              className="font-semibold text-[0.86rem] truncate"
              style={{ color: down ? 'var(--ink-mute)' : 'var(--ink)' }}
            >
              {c.name}
            </span>
            {c.isPc && <span className="chip chip-azure">PC</span>}
            {c.secret && <Icons.eyeOff className="w-3 h-3" />}
            {c.concentration && (
              <span className="chip chip-violet" title={`Concentration: ${c.concentration}`}>
                conc.
              </span>
            )}
          </div>
          {showHpBars && <div className="mt-1 pr-2"><Hp current={c.hp} max={c.maxHp} temp={c.tempHp} /></div>}
        </button>

        {/* AC */}
        <div className="flex items-center gap-1 shrink-0" title="Armor Class">
          <Icons.shield className="w-3.5 h-3.5" />
          <input
            className="field field-sm w-10 text-center"
            value={c.ac}
            onChange={(e) => updateCombatant(c.id, { ac: parseInt(e.target.value, 10) || 0 })}
            aria-label="AC"
          />
        </div>

        {/* HP */}
        <div className="flex items-center gap-1 shrink-0" title="Hit Points">
          <Icons.heart className="w-3.5 h-3.5" style={{ color: down ? 'var(--rose)' : undefined }} />
          <input
            className="field field-sm w-11 text-center font-semibold"
            value={c.hp}
            onChange={(e) => updateCombatant(c.id, { hp: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            aria-label="HP"
          />
          <span className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
            /{c.maxHp}
          </span>
          {c.tempHp > 0 && <span className="chip chip-azure">+{c.tempHp}</span>}
        </div>

        {/* damage / heal */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            className="field field-sm w-12 text-center"
            placeholder="0"
            value={delta}
            onChange={(e) => setDelta(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply(e.shiftKey ? 1 : -1)
            }}
            aria-label="Hasar veya iyileşme"
            title="Enter: hasar · Shift+Enter: iyileştir"
          />
          <button className="btn btn-xs" style={{ color: 'var(--rose)' }} onClick={() => apply(-1)} title="Hasar ver">
            −
          </button>
          <button className="btn btn-xs" style={{ color: 'var(--sage)' }} onClick={() => apply(1)} title="İyileştir">
            +
          </button>
        </div>

        <button className="btn btn-ghost btn-icon shrink-0" onClick={() => setExpanded((v) => !v)} aria-label="Detay">
          <Icons.chevronD
            className="w-4 h-4 transition-transform"
            {...(expanded ? { style: { transform: 'rotate(180deg)' } } : {})}
          />
        </button>
      </div>

      {/* conditions strip */}
      {c.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {c.conditions.map((cond) => (
            <button
              key={cond.name}
              className="chip chip-rose"
              onClick={() => toggleCondition(c.id, cond.name)}
              title="Kaldırmak için tıkla"
            >
              {cond.name}
              {cond.rounds !== null && ` (${cond.rounds})`}
              <Icons.x className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}

      {/* expanded controls */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 animate-fade" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <button className="btn btn-xs" onClick={() => setShowConditions(true)}>
              Durum ekle
            </button>
            <button
              className="btn btn-xs"
              onClick={() => {
                const spell = c.concentration ? null : window.prompt('Hangi büyüye konsantre?') || null
                setConcentration(c.id, spell)
              }}
            >
              {c.concentration ? `Conc: ${c.concentration} ✕` : 'Concentration'}
            </button>
            <button
              className="btn btn-xs"
              onClick={() => {
                const n = parseInt(window.prompt('Temp HP:') ?? '', 10)
                if (Number.isFinite(n)) updateCombatant(c.id, { tempHp: Math.max(0, n) })
              }}
            >
              Temp HP
            </button>
            <button
              className="btn btn-xs"
              onClick={() => logRoll(roll(`1d20${signed(c.dexMod)}`), `${c.name} inisiyatif`)}
            >
              <Icons.dice className="w-3 h-3" /> İnisiyatif at
            </button>
            {c.monster && (
              <button className="btn btn-xs" onClick={() => setShowStat(true)}>
                <Icons.book className="w-3 h-3" /> Statblock
              </button>
            )}
            <button className="btn btn-xs" onClick={() => updateCombatant(c.id, { secret: !c.secret })}>
              {c.secret ? <Icons.eyeOff className="w-3 h-3" /> : <Icons.eye className="w-3 h-3" />}
              {c.secret ? 'Gizli' : 'Açık'}
            </button>
            <button
              className="btn btn-xs ml-auto"
              style={{ color: 'var(--rose)' }}
              onClick={() => removeCombatant(c.id)}
            >
              <Icons.trash className="w-3 h-3" /> Çıkar
            </button>
          </div>

          <input
            className="field field-sm"
            placeholder="Not (ör. kapının arkasında, 2. turda kaçacak)"
            value={c.notes}
            onChange={(e) => updateCombatant(c.id, { notes: e.target.value })}
          />

          {c.isPc && down && <DeathSaves c={c} />}
        </div>
      )}

      <Modal open={showConditions} onClose={() => setShowConditions(false)} title={`${c.name} · durumlar`}>
        <ConditionPicker c={c} onClose={() => setShowConditions(false)} />
      </Modal>

      <Modal open={showStat} onClose={() => setShowStat(false)} title={c.monster?.name ?? ''} wide>
        {c.monster && <StatBlock m={c.monster} />}
      </Modal>
    </div>
  )
}

export function CombatTracker() {
  const {
    combatants, round, turn, combatActive,
    addCombatant, addPartyToCombat, rollAllInitiative, sortInitiative,
    nextTurn, prevTurn, startCombat, endCombat,
  } = useStore()
  const party = useStore((s) => s.party)

  const active = combatants[turn]

  return (
    <Panel
      title="Savaş"
      subtitle={combatActive ? `Tur ${round} · sıra: ${active?.name ?? '—'}` : `${combatants.length} katılımcı`}
      icon={<Icons.swords />}
      actions={
        <>
          {combatActive ? (
            <>
              <button className="btn btn-icon" onClick={prevTurn} title="Önceki sıra">
                <Icons.chevronL />
              </button>
              <button className="btn btn-accent" onClick={nextTurn}>
                Sıradaki <Icons.chevronR className="w-3.5 h-3.5" />
              </button>
              <button className="btn btn-ghost btn-xs" onClick={endCombat}>
                Bitir
              </button>
            </>
          ) : (
            <button className="btn btn-accent btn-xs" disabled={!combatants.length} onClick={startCombat}>
              Başlat
            </button>
          )}
        </>
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-2"
    >
      <div className="flex flex-wrap gap-1.5">
        <button
          className="btn btn-xs"
          onClick={() => {
            const name = window.prompt('İsim:')
            if (name) addCombatant({ name, initiative: roll('1d20').total })
          }}
        >
          <Icons.plus className="w-3 h-3" /> Ekle
        </button>
        <button className="btn btn-xs" disabled={!party.length} onClick={addPartyToCombat} title="Grubu ekle">
          <Icons.users className="w-3 h-3" /> Grup
        </button>
        <button className="btn btn-xs" disabled={!combatants.length} onClick={rollAllInitiative}>
          <Icons.dice className="w-3 h-3" /> Hepsini at
        </button>
        <button className="btn btn-xs" disabled={!combatants.length} onClick={sortInitiative}>
          Sırala
        </button>
      </div>

      {combatants.length === 0 ? (
        <Empty
          icon={<Icons.swords className="w-8 h-8" />}
          title="Sıra boş"
          hint="Derlemeden bir yaratık ekle, ya da grubunu getir. İnisiyatif otomatik atılır."
        />
      ) : (
        <div className="space-y-1.5">
          {combatants.map((c, i) => (
            <Row key={c.id} c={c} index={i} />
          ))}
        </div>
      )}
    </Panel>
  )
}
