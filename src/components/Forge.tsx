/**
 * Homebrew forge — write your own content, or import someone else's.
 *
 * Anything created here shows up in the compendium alongside official material,
 * and any table hooked to a generator gets mixed into the oracle's draws.
 */

import { useRef, useState } from 'react'
import {
  emptyPack, blankMonster, blankSpell, blankItem, blankTable, blankNpc, blankEntry,
  parsePack, downloadPack, fetchPack, countEntries, TABLE_HOOKS,
  type BrewPack, type BrewTable, type BrewNpc,
} from '../lib/homebrew'
import type { Monster, Spell, MagicItem, NamedEntry } from '../lib/open5e'
import { CREATURE_TYPES } from '../lib/srd'
import { useStore } from '../store/useStore'
import { useUi } from '../store/useUi'
import { StatBlock } from './StatBlock'
import { Icons, Panel, Empty, Field, Modal } from './ui'

type Section = 'monsters' | 'spells' | 'items' | 'tables' | 'npcs'

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: 'monsters', label: 'Yaratıklar' },
  { key: 'spells', label: 'Büyüler' },
  { key: 'items', label: 'Eşyalar' },
  { key: 'tables', label: 'Tablolar' },
  { key: 'npcs', label: 'NPC’ler' },
]

/* ------------------------------------------------------------------ entries */

function EntryEditor({
  label,
  entries,
  onChange,
}: {
  label: string
  entries: NamedEntry[]
  onChange: (e: NamedEntry[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.72rem] font-medium" style={{ color: 'var(--ink-mute)' }}>
          {label}
        </span>
        <button className="btn btn-xs" onClick={() => onChange([...entries, blankEntry()])}>
          <Icons.plus className="w-3 h-3" />
        </button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="rounded-xl p-2 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
          <div className="flex gap-1.5">
            <input
              className="field field-sm"
              placeholder="Adı (ör. Multiattack)"
              value={e.name}
              onChange={(ev) => onChange(entries.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
            />
            <input
              className="field field-sm w-24"
              placeholder="2d6+3"
              value={e.damage_dice ?? ''}
              onChange={(ev) => onChange(entries.map((x, j) => (j === i ? { ...x, damage_dice: ev.target.value } : x)))}
              title="Hasar zarı — statblock’ta atılabilir buton olur"
            />
            <button
              className="btn btn-icon btn-ghost"
              style={{ color: 'var(--rose)' }}
              onClick={() => onChange(entries.filter((_, j) => j !== i))}
            >
              <Icons.x className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            className="field field-sm resize-y"
            rows={2}
            placeholder="Açıklama"
            value={e.desc}
            onChange={(ev) => onChange(entries.map((x, j) => (j === i ? { ...x, desc: ev.target.value } : x)))}
          />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ monster */

const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

function MonsterEditor({ m, onChange }: { m: Monster; onChange: (m: Monster) => void }) {
  const [preview, setPreview] = useState(false)
  const set = <K extends keyof Monster>(k: K, v: Monster[K]) => onChange({ ...m, [k]: v })

  if (preview) {
    return (
      <div className="space-y-3">
        <button className="btn btn-xs" onClick={() => setPreview(false)}>
          <Icons.pen className="w-3 h-3" /> Düzenlemeye dön
        </button>
        <StatBlock m={m} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn btn-xs" onClick={() => setPreview(true)}>
          <Icons.eye className="w-3 h-3" /> Önizle
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <Field label="İsim">
            <input className="field field-sm" value={m.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        </div>
        <Field label="Boyut">
          <select className="field field-sm" value={m.size} onChange={(e) => set('size', e.target.value)}>
            {['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Tür">
          <select className="field field-sm" value={m.type} onChange={(e) => set('type', e.target.value)}>
            {CREATURE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Alignment">
            <input className="field field-sm" value={m.alignment} onChange={(e) => set('alignment', e.target.value)} />
          </Field>
        </div>
        <Field label="AC">
          <input className="field field-sm text-center" type="number" value={m.armor_class} onChange={(e) => set('armor_class', +e.target.value || 0)} />
        </Field>
        <Field label="AC notu">
          <input className="field field-sm" placeholder="natural armor" value={m.armor_desc ?? ''} onChange={(e) => set('armor_desc', e.target.value)} />
        </Field>
        <Field label="HP">
          <input className="field field-sm text-center" type="number" value={m.hit_points} onChange={(e) => set('hit_points', +e.target.value || 0)} />
        </Field>
        <Field label="Hit dice">
          <input className="field field-sm" placeholder="4d8+4" value={m.hit_dice} onChange={(e) => set('hit_dice', e.target.value)} />
        </Field>
        <Field label="CR">
          <input
            className="field field-sm text-center"
            type="number"
            step={0.125}
            value={m.cr}
            onChange={(e) => {
              const cr = parseFloat(e.target.value) || 0
              onChange({ ...m, cr, challenge_rating: String(cr) })
            }}
          />
        </Field>
        <Field label="Hız (ft)">
          <input
            className="field field-sm text-center"
            type="number"
            value={typeof m.speed?.walk === 'number' ? m.speed.walk : 30}
            onChange={(e) => set('speed', { ...m.speed, walk: +e.target.value || 0 })}
          />
        </Field>
      </div>

      <div>
        <span className="block text-[0.7rem] font-medium mb-1" style={{ color: 'var(--ink-mute)' }}>
          Yetenekler
        </span>
        <div className="grid grid-cols-6 gap-1">
          {ABILITY_KEYS.map((k, i) => (
            <label key={k} className="text-center">
              <span className="block text-[0.62rem] font-semibold" style={{ color: 'var(--accent)' }}>
                {ABILITY_LABELS[i]}
              </span>
              <input
                className="field field-sm text-center"
                type="number"
                value={m[k]}
                onChange={(e) => set(k, (+e.target.value || 0) as Monster[typeof k])}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Senses">
          <input className="field field-sm" value={m.senses ?? ''} onChange={(e) => set('senses', e.target.value)} />
        </Field>
        <Field label="Languages">
          <input className="field field-sm" value={m.languages ?? ''} onChange={(e) => set('languages', e.target.value)} />
        </Field>
        <Field label="Damage resistances">
          <input className="field field-sm" value={m.damage_resistances ?? ''} onChange={(e) => set('damage_resistances', e.target.value)} />
        </Field>
        <Field label="Damage immunities">
          <input className="field field-sm" value={m.damage_immunities ?? ''} onChange={(e) => set('damage_immunities', e.target.value)} />
        </Field>
        <Field label="Condition immunities">
          <input className="field field-sm" value={m.condition_immunities ?? ''} onChange={(e) => set('condition_immunities', e.target.value)} />
        </Field>
        <Field label="Damage vulnerabilities">
          <input className="field field-sm" value={m.damage_vulnerabilities ?? ''} onChange={(e) => set('damage_vulnerabilities', e.target.value)} />
        </Field>
      </div>

      <EntryEditor label="Özel yetenekler" entries={m.special_abilities ?? []} onChange={(e) => set('special_abilities', e)} />
      <EntryEditor label="Aksiyonlar" entries={m.actions ?? []} onChange={(e) => set('actions', e)} />
      <EntryEditor label="Reaksiyonlar" entries={m.reactions ?? []} onChange={(e) => set('reactions', e)} />
      <EntryEditor label="Legendary actions" entries={m.legendary_actions ?? []} onChange={(e) => set('legendary_actions', e)} />

      <Field label="Açıklama">
        <textarea className="field field-sm resize-y" rows={3} value={m.desc ?? ''} onChange={(e) => set('desc', e.target.value)} />
      </Field>
    </div>
  )
}

/* ------------------------------------------------------------------ others */

function SpellEditor({ sp, onChange }: { sp: Spell; onChange: (s: Spell) => void }) {
  const set = <K extends keyof Spell>(k: K, v: Spell[K]) => onChange({ ...sp, [k]: v })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <Field label="İsim">
            <input className="field field-sm" value={sp.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        </div>
        <Field label="Seviye">
          <select
            className="field field-sm"
            value={sp.level_int}
            onChange={(e) => {
              const n = +e.target.value
              onChange({ ...sp, level_int: n, level: n === 0 ? 'cantrip' : `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}-level` })
            }}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Cantrip' : `${i}. seviye`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Okul">
          <select className="field field-sm" value={sp.school} onChange={(e) => set('school', e.target.value)}>
            {['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Casting time">
          <input className="field field-sm" value={sp.casting_time} onChange={(e) => set('casting_time', e.target.value)} />
        </Field>
        <Field label="Menzil">
          <input className="field field-sm" value={sp.range} onChange={(e) => set('range', e.target.value)} />
        </Field>
        <Field label="Bileşenler">
          <input className="field field-sm" value={sp.components} onChange={(e) => set('components', e.target.value)} />
        </Field>
        <Field label="Süre">
          <input className="field field-sm" value={sp.duration} onChange={(e) => set('duration', e.target.value)} />
        </Field>
        <Field label="Concentration">
          <select className="field field-sm" value={sp.concentration} onChange={(e) => set('concentration', e.target.value)}>
            <option value="no">Hayır</option>
            <option value="yes">Evet</option>
          </select>
        </Field>
        <Field label="Sınıflar">
          <input className="field field-sm" placeholder="Wizard, Sorcerer" value={sp.dnd_class} onChange={(e) => set('dnd_class', e.target.value)} />
        </Field>
      </div>
      <Field label="Açıklama">
        <textarea className="field field-sm resize-y" rows={5} value={sp.desc} onChange={(e) => set('desc', e.target.value)} />
      </Field>
      <Field label="At Higher Levels">
        <textarea className="field field-sm resize-y" rows={2} value={sp.higher_level ?? ''} onChange={(e) => set('higher_level', e.target.value)} />
      </Field>
    </div>
  )
}

function ItemEditor({ it, onChange }: { it: MagicItem; onChange: (i: MagicItem) => void }) {
  const set = <K extends keyof MagicItem>(k: K, v: MagicItem[K]) => onChange({ ...it, [k]: v })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Field label="İsim">
          <input className="field field-sm" value={it.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Tür">
          <input className="field field-sm" value={it.type} onChange={(e) => set('type', e.target.value)} />
        </Field>
        <Field label="Nadirlik">
          <select className="field field-sm" value={it.rarity} onChange={(e) => set('rarity', e.target.value)}>
            {['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 sm:col-span-3">
          <Field label="Attunement">
            <input className="field field-sm" placeholder="(by a wizard) — boş bırakırsan gerekmez" value={it.requires_attunement ?? ''} onChange={(e) => set('requires_attunement', e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Açıklama">
        <textarea className="field field-sm resize-y" rows={5} value={it.desc} onChange={(e) => set('desc', e.target.value)} />
      </Field>
    </div>
  )
}

function TableEditor({ t, onChange }: { t: BrewTable; onChange: (t: BrewTable) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Tablo adı">
          <input className="field field-sm" value={t.name} onChange={(e) => onChange({ ...t, name: e.target.value })} />
        </Field>
        <Field label="Nereye bağlansın" hint="Bir üreticiye bağlarsan kâhin senin satırlarını da çeker.">
          <select className="field field-sm" value={t.hook} onChange={(e) => onChange({ ...t, hook: e.target.value })}>
            {TABLE_HOOKS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[0.72rem] font-medium" style={{ color: 'var(--ink-mute)' }}>
            Satırlar (d{t.rows.filter((r) => r.trim()).length || '?'})
          </span>
          <button className="btn btn-xs" onClick={() => onChange({ ...t, rows: [...t.rows, ''] })}>
            <Icons.plus className="w-3 h-3" /> Satır
          </button>
        </div>
        {t.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-6 text-right text-[0.7rem] shrink-0" style={{ color: 'var(--ink-mute)' }}>
              {i + 1}
            </span>
            <input
              className="field field-sm"
              value={row}
              placeholder="…"
              onChange={(e) => onChange({ ...t, rows: t.rows.map((r, j) => (j === i ? e.target.value : r)) })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === t.rows.length - 1) onChange({ ...t, rows: [...t.rows, ''] })
              }}
            />
            <button
              className="btn btn-icon btn-ghost"
              style={{ color: 'var(--rose)' }}
              onClick={() => onChange({ ...t, rows: t.rows.filter((_, j) => j !== i) })}
            >
              <Icons.x className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <details>
        <summary className="text-[0.72rem] cursor-pointer" style={{ color: 'var(--ink-mute)' }}>
          Toplu yapıştır
        </summary>
        <textarea
          className="field field-sm resize-y mt-1.5"
          rows={4}
          placeholder="Her satıra bir madde yapıştır, alanı terk et."
          onBlur={(e) => {
            const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)
            if (lines.length) {
              onChange({ ...t, rows: [...t.rows.filter((r) => r.trim()), ...lines] })
              e.target.value = ''
            }
          }}
        />
      </details>
    </div>
  )
}

function NpcEditor({ n, onChange }: { n: BrewNpc; onChange: (n: BrewNpc) => void }) {
  const set = (k: keyof BrewNpc, v: string) => onChange({ ...n, [k]: v })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label="İsim">
        <input className="field field-sm" value={n.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Rolü">
        <input className="field field-sm" value={n.role} onChange={(e) => set('role', e.target.value)} />
      </Field>
      <Field label="Görünüş">
        <input className="field field-sm" value={n.appearance} onChange={(e) => set('appearance', e.target.value)} />
      </Field>
      <Field label="Tavır">
        <input className="field field-sm" value={n.quirk} onChange={(e) => set('quirk', e.target.value)} />
      </Field>
      <Field label="İstediği">
        <input className="field field-sm" value={n.motivation} onChange={(e) => set('motivation', e.target.value)} />
      </Field>
      <Field label="Sırrı">
        <input className="field field-sm" value={n.secret} onChange={(e) => set('secret', e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notlar">
          <textarea className="field field-sm resize-y" rows={3} value={n.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ panel */

export function Forge() {
  const { packs, activePackId, addPack, updatePack, removePack, setActivePack } = useStore()
  const setToast = useUi((s) => s.setToast)

  const [section, setSection] = useState<Section>('monsters')
  const [editing, setEditing] = useState<{ kind: Section; index: number } | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [showImport, setShowImport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pack = packs.find((p) => p.id === activePackId) ?? packs[0] ?? null

  const create = () => {
    const name = window.prompt('Derleme adı:', 'Kendi Derlemem')
    if (name) addPack(emptyPack(name))
  }

  const importFile = async (file: File) => {
    try {
      const { pack: imported, warnings } = parsePack(JSON.parse(await file.text()), file.name.replace(/\.\w+$/, ''))
      addPack(imported)
      setToast(
        `"${imported.name}" içe aktarıldı — ${countEntries(imported)} kayıt` +
          (warnings.length ? ` (${warnings.length} uyarı)` : ''),
      )
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Dosya okunamadı')
    }
  }

  const importFromUrl = async () => {
    try {
      const { pack: imported } = await fetchPack(importUrl)
      addPack(imported)
      setToast(`"${imported.name}" içe aktarıldı — ${countEntries(imported)} kayıt`)
      setShowImport(false)
      setImportUrl('')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Kaynak okunamadı')
    }
  }

  const addEntry = () => {
    if (!pack) return
    if (section === 'monsters') updatePack(pack.id, { monsters: [...pack.monsters, blankMonster(pack.name)] })
    if (section === 'spells') updatePack(pack.id, { spells: [...pack.spells, blankSpell(pack.name)] })
    if (section === 'items') updatePack(pack.id, { items: [...pack.items, blankItem(pack.name)] })
    if (section === 'tables') updatePack(pack.id, { tables: [...pack.tables, blankTable()] })
    if (section === 'npcs') updatePack(pack.id, { npcs: [...pack.npcs, blankNpc()] })
    setEditing({ kind: section, index: (pack[section] as unknown[]).length })
  }

  const removeEntry = (kind: Section, index: number) => {
    if (!pack) return
    updatePack(pack.id, { [kind]: (pack[kind] as unknown[]).filter((_, i) => i !== index) } as Partial<BrewPack>)
    setEditing(null)
  }

  const list = pack ? (pack[section] as Array<{ name: string }>) : []

  return (
    <Panel
      title="Ocak"
      subtitle={pack ? `${pack.name} · ${countEntries(pack)} kayıt` : 'Kendi içeriğini yaz'}
      icon={<Icons.hammer />}
      actions={
        <>
          <button className="btn btn-xs" onClick={() => fileRef.current?.click()}>
            <Icons.upload className="w-3 h-3" /> İçe
          </button>
          <button className="btn btn-xs" onClick={() => setShowImport(true)}>
            URL
          </button>
          {pack && (
            <button className="btn btn-xs" onClick={() => downloadPack(pack)}>
              <Icons.download className="w-3 h-3" /> Dışa
            </button>
          )}
          <button className="btn btn-accent btn-xs" onClick={create}>
            <Icons.plus className="w-3 h-3" /> Derleme
          </button>
        </>
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-3"
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importFile(f)
          e.target.value = ''
        }}
      />

      {packs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {packs.map((p) => (
            <button
              key={p.id}
              className="btn btn-xs"
              style={p.id === pack?.id ? { color: 'var(--accent)', borderColor: 'var(--accent-deep)' } : undefined}
              onClick={() => setActivePack(p.id)}
            >
              {p.name} <span style={{ opacity: 0.5 }}>{countEntries(p)}</span>
            </button>
          ))}
        </div>
      )}

      {!pack ? (
        <Empty
          icon={<Icons.hammer className="w-8 h-8" />}
          title="Henüz derlemen yok"
          hint="Yeni bir derleme aç ya da bir .brew.json dosyası içe aktar. Yazdığın her şey aramada resmî içerikle birlikte çıkar."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Field label="Derleme adı">
              <input className="field field-sm" value={pack.name} onChange={(e) => updatePack(pack.id, { name: e.target.value })} />
            </Field>
            <Field label="Yazar">
              <input className="field field-sm" value={pack.author} onChange={(e) => updatePack(pack.id, { author: e.target.value })} />
            </Field>
            <Field label="Açıklama">
              <input className="field field-sm" value={pack.description} onChange={(e) => updatePack(pack.id, { description: e.target.value })} />
            </Field>
          </div>

          <div className="flex gap-1 p-1 rounded-full overflow-x-auto" style={{ background: 'var(--bg-deep)' }}>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className="flex-1 whitespace-nowrap py-1.5 px-2 rounded-full text-[0.75rem] font-medium transition-all"
                style={
                  section === s.key
                    ? { background: 'var(--raised)', color: 'var(--accent)', boxShadow: 'var(--shadow-soft)' }
                    : { color: 'var(--ink-mute)' }
                }
                onClick={() => {
                  setSection(s.key)
                  setEditing(null)
                }}
              >
                {s.label} <span style={{ opacity: 0.6 }}>{(pack[s.key] as unknown[]).length}</span>
              </button>
            ))}
          </div>

          <button className="btn btn-xs w-full" onClick={addEntry}>
            <Icons.plus className="w-3 h-3" /> Yeni ekle
          </button>

          {list.length === 0 ? (
            <p className="text-[0.78rem] text-center py-6" style={{ color: 'var(--ink-mute)' }}>
              Bu bölüm boş.
            </p>
          ) : (
            <div className="space-y-1">
              {list.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
                  <span className="flex-1 min-w-0 truncate text-[0.84rem]">{entry.name || <em style={{ color: 'var(--ink-mute)' }}>isimsiz</em>}</span>
                  <button className="btn btn-xs" onClick={() => setEditing({ kind: section, index: i })}>
                    <Icons.pen className="w-3 h-3" />
                  </button>
                  <button className="btn btn-icon btn-ghost" style={{ color: 'var(--rose)' }} onClick={() => removeEntry(section, i)}>
                    <Icons.trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-xs" style={{ color: 'var(--rose)' }} onClick={() => removePack(pack.id)}>
            <Icons.trash className="w-3 h-3" /> Bu derlemeyi sil
          </button>
        </>
      )}

      {/* editor modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Düzenle" wide>
        {editing && pack && (
          <>
            {editing.kind === 'monsters' && pack.monsters[editing.index] && (
              <MonsterEditor
                m={pack.monsters[editing.index]}
                onChange={(m) => updatePack(pack.id, { monsters: pack.monsters.map((x, i) => (i === editing.index ? m : x)) })}
              />
            )}
            {editing.kind === 'spells' && pack.spells[editing.index] && (
              <SpellEditor
                sp={pack.spells[editing.index]}
                onChange={(s) => updatePack(pack.id, { spells: pack.spells.map((x, i) => (i === editing.index ? s : x)) })}
              />
            )}
            {editing.kind === 'items' && pack.items[editing.index] && (
              <ItemEditor
                it={pack.items[editing.index]}
                onChange={(it) => updatePack(pack.id, { items: pack.items.map((x, i) => (i === editing.index ? it : x)) })}
              />
            )}
            {editing.kind === 'tables' && pack.tables[editing.index] && (
              <TableEditor
                t={pack.tables[editing.index]}
                onChange={(t) => updatePack(pack.id, { tables: pack.tables.map((x, i) => (i === editing.index ? t : x)) })}
              />
            )}
            {editing.kind === 'npcs' && pack.npcs[editing.index] && (
              <NpcEditor
                n={pack.npcs[editing.index]}
                onChange={(n) => updatePack(pack.id, { npcs: pack.npcs.map((x, i) => (i === editing.index ? n : x)) })}
              />
            )}
          </>
        )}
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="URL’den içe aktar">
        <p className="text-[0.8rem] mb-3" style={{ color: 'var(--ink-soft)' }}>
          Bir arkadaşının paylaştığı derlemenin doğrudan JSON adresini yapıştır (GitHub raw, gist, kendi sunucun).
          Kendi formatımız da 5etools homebrew dosyaları da kabul edilir. Kaynağın CORS’a izin vermesi gerekir.
        </p>
        <input
          className="field mb-3"
          placeholder="https://raw.githubusercontent.com/…/pack.brew.json"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && importFromUrl()}
        />
        <button className="btn btn-accent w-full" disabled={!importUrl.trim()} onClick={importFromUrl}>
          Getir
        </button>
      </Modal>
    </Panel>
  )
}
