/**
 * A player character, shown the way a stat block is shown.
 *
 * Two halves of the same thing: a card to read mid-session, and an editor to
 * fill in once. The card deliberately mirrors StatBlock — at the table a DM is
 * flipping between a goblin and a paladin, and having the two read differently
 * costs a second every time.
 *
 * Nothing derived is editable and nothing editable is derived. Passives, saves,
 * skill totals and the spell DC are worked out from the scores and the ticks,
 * so they cannot drift; the DM types the scores, not the consequences.
 */

import { useState } from 'react'
import { roll, signed, abilityMod } from '../lib/dice'
import {
  ABILITIES, SKILLS, PASSIVE_SKILLS, blankAttack, proficiencyBonus,
  modOf, saveMod, skillMod, passiveOf, isPassiveManual, spellSaveDc, spellAttackBonus,
  trainedSkills, type AbilityKey, type PassiveSkill,
} from '../lib/character'
import { useStore, type PartyMember } from '../store/useStore'
import { Icons, Field } from './ui'

/* ------------------------------------------------------------------ card */

function Line({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <p className="text-[0.8rem]">
      <span className="font-semibold" style={{ color: 'var(--accent)' }}>
        {label}
      </span>{' '}
      <span style={{ color: 'var(--ink-soft)' }}>{value}</span>
    </p>
  )
}

export function CharacterCard({ c }: { c: PartyMember }) {
  const logRoll = useStore((s) => s.logRoll)
  const prof = proficiencyBonus(c.level)
  const dc = spellSaveDc(c)
  const atk = spellAttackBonus(c)
  const skills = trainedSkills(c)

  const saves = ABILITIES.filter((a) => c.saveProfs.includes(a.key))
    .map((a) => `${a.label} ${signed(saveMod(c, a.key))}`)
    .join(', ')

  return (
    <article className="space-y-3 animate-fade">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="panel-title text-lg font-bold leading-tight">{c.name || 'İsimsiz'}</h3>
          <p className="text-[0.75rem] italic" style={{ color: 'var(--ink-mute)' }}>
            {[c.race, c.cls, c.level && `seviye ${c.level}`].filter(Boolean).join(' ')}
            {c.player ? ` — ${c.player}` : ''}
          </p>
        </div>
        <span className="chip chip-azure shrink-0">yeterlilik {signed(prof)}</span>
      </header>

      <div className="rounded-xl px-3 py-2 space-y-0.5" style={{ background: 'var(--bg-deep)' }}>
        <Line label="Armor Class" value={String(c.ac)} />
        <Line label="Hit Points" value={String(c.maxHp)} />
        <Line label="Speed" value={`${c.speed} ft.`} />
        <p className="text-[0.8rem]">
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            Initiative
          </span>{' '}
          <span style={{ color: 'var(--ink-soft)' }}>{signed(modOf(c, 'dex'))}</span>
          <button
            className="btn btn-xs ml-1.5 align-middle"
            onClick={() => logRoll(roll(`1d20${signed(modOf(c, 'dex'))}`), `${c.name} inisiyatif`)}
            title="İnisiyatif at"
          >
            <Icons.dice className="w-3 h-3" />
          </button>
        </p>
      </div>

      {/* The three numbers a DM reads without asking for a roll. */}
      <div className="grid grid-cols-3 gap-1.5">
        {PASSIVE_SKILLS.map((s) => (
          <div key={s} className="rounded-xl py-1.5 text-center" style={{ background: 'var(--bg-deep)' }}>
            <div className="text-[0.6rem] font-semibold" style={{ color: 'var(--accent)' }}>
              passive {s}
            </div>
            <div className="text-[1.05rem] font-bold">{passiveOf(c, s)}</div>
            {isPassiveManual(c, s) && (
              <div className="text-[0.56rem]" style={{ color: 'var(--ink-mute)' }}>
                elle
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map((a) => {
          const mod = modOf(c, a.key)
          return (
            <button
              key={a.key}
              className="rounded-lg py-1.5 transition-colors hover:brightness-125"
              style={{ background: 'var(--bg-deep)' }}
              onClick={() => logRoll(roll(`1d20${signed(mod)}`), `${c.name} ${a.label}`)}
              title={`${a.long} kontrolü at`}
            >
              <div className="text-[0.62rem] font-semibold" style={{ color: 'var(--accent)' }}>
                {a.label}
              </div>
              <div className="text-[0.8rem] font-semibold">{c.abilities[a.key]}</div>
              <div className="text-[0.68rem]" style={{ color: 'var(--ink-mute)' }}>
                {signed(mod)}
              </div>
            </button>
          )
        })}
      </div>

      <div className="space-y-0.5">
        <Line label="Saving Throws" value={saves} />
        <Line
          label="Skills"
          value={skills.map((s) => `${s.skill} ${signed(s.mod)}${s.expert ? '∗' : ''}`).join(', ')}
        />
        <Line label="Senses" value={c.senses} />
        <Line label="Languages" value={c.languages} />
        <Line label="Defenses" value={c.defenses} />
        {dc !== null && <Line label="Spell save DC" value={`${dc} · saldırı ${signed(atk ?? 0)}`} />}
      </div>

      {c.attacks.length > 0 && (
        <div className="space-y-1">
          <h4 lang="en" className="panel-title text-[0.82rem] font-semibold pb-1 uppercase tracking-wide" style={{ borderBottom: '1px solid var(--line-soft)', color: 'var(--accent)' }}>
            Attacks
          </h4>
          {c.attacks.map((a) => (
            <p key={a.id} className="text-[0.8rem]">
              <strong>{a.name || '—'}</strong>
              {a.bonus && <span style={{ color: 'var(--ink-soft)' }}> · {a.bonus} isabet</span>}
              {a.damage && (
                <>
                  <span style={{ color: 'var(--ink-soft)' }}> · {a.damage}</span>
                  <button
                    className="btn btn-xs ml-1.5 align-middle"
                    onClick={() => logRoll(roll(a.damage), `${c.name} ${a.name} hasar`)}
                    title="Hasar at"
                  >
                    <Icons.dice className="w-3 h-3" />
                  </button>
                </>
              )}
              {a.notes && <span style={{ color: 'var(--ink-mute)' }}> — {a.notes}</span>}
            </p>
          ))}
        </div>
      )}

      {c.notes && (
        <p className="text-[0.8rem] whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>
          {c.notes}
        </p>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ editor */

function Toggle({ on, label, hint, onClick }: { on: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      className={`text-left px-2 py-1 rounded-lg text-[0.72rem] transition-colors ${on ? 'btn-accent' : ''}`}
      style={on ? undefined : { background: 'var(--bg-deep)', color: 'var(--ink-mute)' }}
      onClick={onClick}
      title={hint}
    >
      {label}
    </button>
  )
}

export function CharacterEditor({ c, onChange }: { c: PartyMember; onChange: (patch: Partial<PartyMember>) => void }) {
  const prof = proficiencyBonus(c.level)

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <Field label="İsim">
            <input className="field field-sm" value={c.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Oyuncu">
            <input className="field field-sm" value={c.player} onChange={(e) => onChange({ player: e.target.value })} />
          </Field>
        </div>
        <Field label="Irk">
          <input className="field field-sm" value={c.race} onChange={(e) => onChange({ race: e.target.value })} />
        </Field>
        <Field label="Sınıf">
          <input className="field field-sm" value={c.cls} onChange={(e) => onChange({ cls: e.target.value })} />
        </Field>
        <Field label={`Seviye (yeterlilik ${signed(prof)})`}>
          <input
            className="field field-sm text-center"
            type="number"
            min={1}
            max={20}
            value={c.level}
            onChange={(e) => onChange({ level: Math.min(20, Math.max(1, +e.target.value || 1)) })}
          />
        </Field>
        <Field label="Hız (ft)">
          <input className="field field-sm text-center" type="number" value={c.speed} onChange={(e) => onChange({ speed: +e.target.value || 0 })} />
        </Field>
        <Field label="AC">
          <input className="field field-sm text-center" type="number" value={c.ac} onChange={(e) => onChange({ ac: +e.target.value || 0 })} />
        </Field>
        <Field label="Max HP">
          <input className="field field-sm text-center" type="number" value={c.maxHp} onChange={(e) => onChange({ maxHp: +e.target.value || 0 })} />
        </Field>
      </div>

      {/* Scores first, because everything below is a consequence of them. */}
      <div>
        <span className="block text-[0.7rem] font-medium mb-1" style={{ color: 'var(--ink-mute)' }}>
          Yetenek puanları — kurtarma yeterliliği için üstlerine tıkla
        </span>
        <div className="grid grid-cols-6 gap-1">
          {ABILITIES.map((a) => {
            const on = c.saveProfs.includes(a.key)
            return (
              <div key={a.key} className="text-center">
                <button
                  className="w-full text-[0.62rem] font-semibold rounded-t-lg py-0.5"
                  style={{
                    background: on ? 'var(--accent)' : 'var(--bg-deep)',
                    color: on ? 'var(--bg-deep)' : 'var(--accent)',
                  }}
                  onClick={() =>
                    onChange({ saveProfs: toggleIn(c.saveProfs, a.key) as AbilityKey[] })
                  }
                  title={on ? 'Kurtarma yeterliliği var' : 'Kurtarma yeterliliği yok'}
                >
                  {a.label}
                </button>
                <input
                  className="field field-sm text-center rounded-t-none"
                  type="number"
                  value={c.abilities[a.key]}
                  onChange={(e) => onChange({ abilities: { ...c.abilities, [a.key]: +e.target.value || 0 } })}
                />
                <div className="text-[0.64rem] mt-0.5" style={{ color: 'var(--ink-mute)' }}>
                  {signed(abilityMod(c.abilities[a.key]))}
                  {on && <span style={{ color: 'var(--accent)' }}> · {signed(saveMod(c, a.key))}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <span className="block text-[0.7rem] font-medium mb-1" style={{ color: 'var(--ink-mute)' }}>
          Beceriler — bir kez tıkla yeterlilik, iki kez uzmanlık (∗)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {SKILLS.map((s) => {
            const p = c.skillProfs.includes(s)
            const e = c.expertise.includes(s)
            return (
              <Toggle
                key={s}
                on={p || e}
                label={`${s} ${signed(skillMod(c, s))}${e ? '∗' : ''}`}
                onClick={() => {
                  // none → proficient → expert → none
                  if (e) onChange({ skillProfs: c.skillProfs.filter((x) => x !== s), expertise: c.expertise.filter((x) => x !== s) })
                  else if (p) onChange({ expertise: [...c.expertise, s] })
                  else onChange({ skillProfs: [...c.skillProfs, s] })
                }}
              />
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PASSIVE_SKILLS.map((s) => (
          <Field key={s} label={`passive ${s}`}>
            <div className="flex gap-1">
              <input
                className="field field-sm text-center"
                type="number"
                value={passiveOf(c, s)}
                onChange={(e) =>
                  onChange({ passiveOverrides: { ...c.passiveOverrides, [s]: +e.target.value || 0 } })
                }
              />
              {isPassiveManual(c, s) && (
                <button
                  className="btn btn-icon btn-ghost"
                  title="Hesaplanan değere dön"
                  onClick={() => {
                    const next = { ...c.passiveOverrides }
                    delete next[s as PassiveSkill]
                    onChange({ passiveOverrides: next })
                  }}
                >
                  <Icons.x className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </Field>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Duyular">
          <input className="field field-sm" placeholder="darkvision 60 ft." value={c.senses} onChange={(e) => onChange({ senses: e.target.value })} />
        </Field>
        <Field label="Diller">
          <input className="field field-sm" placeholder="Common, Elvish" value={c.languages} onChange={(e) => onChange({ languages: e.target.value })} />
        </Field>
        <Field label="Direnç / bağışıklık">
          <input className="field field-sm" placeholder="fire resistance" value={c.defenses} onChange={(e) => onChange({ defenses: e.target.value })} />
        </Field>
        <Field label="Büyü yeteneği">
          <select
            className="field field-sm"
            value={c.spellAbility}
            onChange={(e) => onChange({ spellAbility: e.target.value as AbilityKey | '' })}
          >
            <option value="">büyü yapmıyor</option>
            {ABILITIES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.long}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {c.spellAbility && (
        <p className="text-[0.74rem] px-2.5 py-1.5 rounded-xl" style={{ background: 'var(--bg-deep)', color: 'var(--ink-soft)' }}>
          Spell save <strong style={{ color: 'var(--accent)' }}>DC {spellSaveDc(c)}</strong> · büyü saldırısı{' '}
          <strong style={{ color: 'var(--accent)' }}>{signed(spellAttackBonus(c) ?? 0)}</strong>
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-medium" style={{ color: 'var(--ink-mute)' }}>
            Saldırılar
          </span>
          <button className="btn btn-xs" onClick={() => onChange({ attacks: [...c.attacks, blankAttack()] })}>
            <Icons.plus className="w-3 h-3" />
          </button>
        </div>
        {c.attacks.map((a, i) => (
          <div key={a.id} className="flex gap-1.5">
            <input
              className="field field-sm flex-1"
              placeholder="Longsword"
              value={a.name}
              onChange={(e) => onChange({ attacks: c.attacks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
            />
            <input
              className="field field-sm w-16 text-center"
              placeholder="+7"
              value={a.bonus}
              onChange={(e) => onChange({ attacks: c.attacks.map((x, j) => (j === i ? { ...x, bonus: e.target.value } : x)) })}
            />
            <input
              className="field field-sm w-28"
              placeholder="1d8+4"
              value={a.damage}
              onChange={(e) => onChange({ attacks: c.attacks.map((x, j) => (j === i ? { ...x, damage: e.target.value } : x)) })}
              title="Zar ifadesi — kartta atılabilir olur"
            />
            <button
              className="btn btn-icon btn-ghost"
              style={{ color: 'var(--rose)' }}
              onClick={() => onChange({ attacks: c.attacks.filter((_, j) => j !== i) })}
            >
              <Icons.x className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Field label="Notlar">
        <textarea className="field field-sm resize-y" rows={3} value={c.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
    </div>
  )
}

/* ------------------------------------------------------------------ combined */

export function CharacterSheetView({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useStore((s) => s.party.find((p) => p.id === id))
  const updatePartyMember = useStore((s) => s.updatePartyMember)
  const removePartyMember = useStore((s) => s.removePartyMember)
  const [editing, setEditing] = useState(false)

  if (!c) return null

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button className={`btn btn-xs flex-1 ${editing ? '' : 'btn-accent'}`} onClick={() => setEditing(false)}>
          <Icons.eye className="w-3 h-3" /> Kart
        </button>
        <button className={`btn btn-xs flex-1 ${editing ? 'btn-accent' : ''}`} onClick={() => setEditing(true)}>
          <Icons.pen className="w-3 h-3" /> Düzenle
        </button>
        <button
          className="btn btn-icon btn-ghost"
          style={{ color: 'var(--rose)' }}
          title="Karakteri sil"
          onClick={() => {
            removePartyMember(c.id)
            onClose()
          }}
        >
          <Icons.trash className="w-3.5 h-3.5" />
        </button>
      </div>

      {editing ? <CharacterEditor c={c} onChange={(patch) => updatePartyMember(c.id, patch)} /> : <CharacterCard c={c} />}
    </div>
  )
}
