/** Full monster statblock, laid out the way the printed page does it. */

import type { Monster, Spell, MagicItem, NamedEntry } from '../lib/open5e'
import { formatCr, speedToString, xpForCr, profBonusForCr } from '../lib/open5e'
import { abilityMod, signed, roll } from '../lib/dice'
import { useStore } from '../store/useStore'
import { Icons, RichText } from './ui'

const ABILITIES: Array<[string, keyof Monster]> = [
  ['STR', 'strength'],
  ['DEX', 'dexterity'],
  ['CON', 'constitution'],
  ['INT', 'intelligence'],
  ['WIS', 'wisdom'],
  ['CHA', 'charisma'],
]

const SAVES: Array<[string, keyof Monster]> = [
  ['STR', 'strength_save'],
  ['DEX', 'dexterity_save'],
  ['CON', 'constitution_save'],
  ['INT', 'intelligence_save'],
  ['WIS', 'wisdom_save'],
  ['CHA', 'charisma_save'],
]

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

function Section({ title, entries }: { title?: string; entries?: NamedEntry[] | null }) {
  const logRoll = useStore((s) => s.logRoll)
  if (!entries?.length) return null

  return (
    <div className="space-y-2">
      {title && (
        // lang="en" so Turkish casing doesn't render "Actions" as "ACTİONS".
        <h4
          lang="en"
          className="panel-title text-[0.82rem] font-semibold pb-1 uppercase tracking-wide"
          style={{ color: 'var(--accent)', borderBottom: '1px solid var(--line)' }}
        >
          {title}
        </h4>
      )}
      {entries.map((e, i) => (
        <div key={`${e.name}-${i}`} className="text-[0.8rem] leading-relaxed prose-sb">
          <span className="font-semibold italic" style={{ color: 'var(--ink)' }}>
            {e.name}.
          </span>{' '}
          <span style={{ color: 'var(--ink-soft)' }}>{e.desc}</span>
          {e.damage_dice && (
            <button
              className="btn btn-xs ml-1.5 align-middle"
              onClick={() => {
                const bonus = e.attack_bonus ? `+${e.attack_bonus}` : ''
                logRoll(roll(e.damage_dice!), `${e.name} hasar`)
                if (bonus) logRoll(roll(`1d20${bonus}`), `${e.name} isabet`)
              }}
              title="Hasar (ve varsa isabet) at"
            >
              <Icons.dice className="w-3 h-3" /> {e.damage_dice}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function StatBlock({ m, onAdd }: { m: Monster; onAdd?: () => void }) {
  const logRoll = useStore((s) => s.logRoll)

  const skills = m.skills
    ? Object.entries(m.skills)
        .map(([k, v]) => `${k[0].toLocaleUpperCase('tr')}${k.slice(1)} ${signed(v)}`)
        .join(', ')
    : ''

  const saves = SAVES.filter(([, key]) => m[key] != null)
    .map(([label, key]) => `${label} ${signed(m[key] as number)}`)
    .join(', ')

  return (
    <article className="space-y-3 animate-fade">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="panel-title text-lg font-bold leading-tight">{m.name}</h3>
          <p className="text-[0.75rem] italic" style={{ color: 'var(--ink-mute)' }}>
            {m.size} {m.type}
            {m.subtype ? ` (${m.subtype})` : ''}, {m.alignment}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {m.homebrew ? (
            <span className="chip chip-violet">homebrew</span>
          ) : (
            <span className="chip chip-mute">{m.document__title}</span>
          )}
          {onAdd && (
            <button className="btn btn-accent btn-xs" onClick={onAdd}>
              <Icons.swords className="w-3 h-3" /> Savaşa
            </button>
          )}
        </div>
      </header>

      <div className="rounded-xl px-3 py-2 space-y-0.5" style={{ background: 'var(--bg-deep)' }}>
        <Line label="Armor Class" value={`${m.armor_class}${m.armor_desc ? ` (${m.armor_desc})` : ''}`} />
        <p className="text-[0.8rem]">
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            Hit Points
          </span>{' '}
          <span style={{ color: 'var(--ink-soft)' }}>
            {m.hit_points} {m.hit_dice && `(${m.hit_dice})`}
          </span>
          {m.hit_dice && (
            <button
              className="btn btn-xs ml-1.5 align-middle"
              onClick={() => logRoll(roll(m.hit_dice), `${m.name} HP`)}
              title="HP at"
            >
              <Icons.dice className="w-3 h-3" />
            </button>
          )}
        </p>
        <Line label="Speed" value={speedToString(m.speed)} />
      </div>

      <div className="grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map(([label, key]) => {
          const score = m[key] as number
          const mod = abilityMod(score)
          return (
            <button
              key={label}
              className="rounded-lg py-1.5 transition-colors hover:brightness-125"
              style={{ background: 'var(--bg-deep)' }}
              onClick={() => logRoll(roll(`1d20${signed(mod)}`), `${m.name} ${label}`)}
              title={`${label} kontrolü at`}
            >
              <div className="text-[0.62rem] font-semibold" style={{ color: 'var(--accent)' }}>
                {label}
              </div>
              <div className="text-[0.8rem] font-semibold">{score}</div>
              <div className="text-[0.68rem]" style={{ color: 'var(--ink-mute)' }}>
                {signed(mod)}
              </div>
            </button>
          )
        })}
      </div>

      <div className="space-y-0.5">
        <Line label="Saving Throws" value={saves} />
        <Line label="Skills" value={skills} />
        <Line label="Damage Vulnerabilities" value={m.damage_vulnerabilities} />
        <Line label="Damage Resistances" value={m.damage_resistances} />
        <Line label="Damage Immunities" value={m.damage_immunities} />
        <Line label="Condition Immunities" value={m.condition_immunities} />
        <Line label="Senses" value={m.senses} />
        <Line label="Languages" value={m.languages || '—'} />
        <p className="text-[0.8rem]">
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            Challenge
          </span>{' '}
          <span style={{ color: 'var(--ink-soft)' }}>
            {formatCr(m.cr)} ({xpForCr(m.cr).toLocaleString('tr-TR')} XP) · Prof {signed(profBonusForCr(m.cr))}
          </span>
        </p>
      </div>

      <Section entries={m.special_abilities} />
      <Section title="Actions" entries={m.actions} />
      <Section title="Bonus Actions" entries={m.bonus_actions} />
      <Section title="Reactions" entries={m.reactions} />
      {!!m.legendary_actions?.length && (
        <>
          <h4
            lang="en"
            className="panel-title text-[0.82rem] font-semibold pb-1 uppercase tracking-wide"
            style={{ color: 'var(--accent)', borderBottom: '1px solid var(--line)' }}
          >
            Legendary Actions
          </h4>
          {m.legendary_desc && (
            <p className="text-[0.78rem] italic" style={{ color: 'var(--ink-mute)' }}>
              {m.legendary_desc}
            </p>
          )}
          <Section entries={m.legendary_actions} />
        </>
      )}

      {m.desc && (
        <p className="text-[0.78rem] italic pt-1" style={{ color: 'var(--ink-mute)' }}>
          <RichText text={m.desc.slice(0, 600)} />
        </p>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ spells */

export function SpellCard({ sp }: { sp: Spell }) {
  return (
    <article className="space-y-2 animate-fade">
      <header>
        <div className="flex items-start gap-2">
          <h3 className="panel-title text-lg font-bold leading-tight flex-1">{sp.name}</h3>
          {sp.homebrew ? (
            <span className="chip chip-violet">homebrew</span>
          ) : (
            <span className="chip chip-mute">{sp.document__title}</span>
          )}
        </div>
        <p className="text-[0.75rem] italic" style={{ color: 'var(--ink-mute)' }}>
          {sp.level_int === 0 ? `${sp.school} cantrip` : `${sp.level} ${sp.school}`}
          {sp.ritual === 'yes' ? ' (ritual)' : ''}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl px-3 py-2" style={{ background: 'var(--bg-deep)' }}>
        <Line label="Casting Time" value={sp.casting_time} />
        <Line label="Range" value={sp.range} />
        <Line label="Components" value={sp.components} />
        <Line label="Duration" value={`${sp.concentration === 'yes' ? 'Concentration, ' : ''}${sp.duration}`} />
      </div>

      {sp.material && (
        <p className="text-[0.72rem] italic" style={{ color: 'var(--ink-mute)' }}>
          Malzeme: {sp.material}
        </p>
      )}

      <div className="text-[0.8rem] leading-relaxed prose-sb" style={{ color: 'var(--ink-soft)' }}>
        <RichText text={sp.desc} />
      </div>

      {sp.higher_level && (
        <p className="text-[0.8rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          <span className="font-semibold italic" style={{ color: 'var(--ink)' }}>
            At Higher Levels.
          </span>{' '}
          <RichText text={sp.higher_level} />
        </p>
      )}

      <p className="text-[0.72rem]" style={{ color: 'var(--ink-mute)' }}>
        {sp.dnd_class}
      </p>
    </article>
  )
}

/* ------------------------------------------------------------------ items */

const RARITY_CHIP: Record<string, string> = {
  common: 'chip-mute',
  uncommon: 'chip-sage',
  rare: 'chip-azure',
  'very rare': 'chip-violet',
  legendary: 'chip-accent',
  artifact: 'chip-rose',
}

export function ItemCard({ it }: { it: MagicItem }) {
  const chip = RARITY_CHIP[it.rarity?.toLowerCase() ?? ''] ?? 'chip-mute'
  return (
    <article className="space-y-2 animate-fade">
      <header>
        <div className="flex items-start gap-2">
          <h3 className="panel-title text-lg font-bold leading-tight flex-1">{it.name}</h3>
          {it.homebrew ? (
            <span className="chip chip-violet">homebrew</span>
          ) : (
            <span className="chip chip-mute">{it.document__title}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`chip ${chip}`}>{it.rarity}</span>
          <span className="text-[0.75rem] italic" style={{ color: 'var(--ink-mute)' }}>
            {it.type}
            {it.requires_attunement ? ` · attunement gerekir ${it.requires_attunement}` : ''}
          </span>
        </div>
      </header>
      <div className="text-[0.8rem] leading-relaxed prose-sb" style={{ color: 'var(--ink-soft)' }}>
        <RichText text={it.desc} />
      </div>
    </article>
  )
}
