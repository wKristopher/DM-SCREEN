/**
 * Homebrew forge — write your own content, or import someone else's.
 *
 * Anything created here shows up in the compendium alongside official material,
 * and any table hooked to a generator gets mixed into the oracle's draws.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  emptyPack, blankMonster, blankSpell, blankItem, blankTable, blankNpc, blankEntry,
  downloadPack, countEntries, TABLE_HOOKS,
  type BrewPack, type BrewTable, type BrewNpc,
} from '../lib/homebrew'
import { importFiles, reportEntries, parseAnyPack, type BulkReport } from '../lib/bulk'
import {
  HOMEBREW_INDEX, parseCatalogue, rawUrlFor, toRawUrl, convertFiveTools,
  type CatalogueFile,
} from '../lib/fivetools'
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

/* ------------------------------------------------------- 5etools catalogue */

const KIND_LABELS: Record<string, string> = {
  monster: 'yaratık',
  spell: 'büyü',
  item: 'eşya',
  baseitem: 'eşya',
  magicvariant: 'eşya',
}

/**
 * Browse github.com/TheGiddyLimit/homebrew from inside the app.
 *
 * The repository publishes its own file listing at a raw URL, which is the
 * whole reason this can exist: no GitHub API, so no token, no rate limit, and
 * no server of ours in the middle. The browser fetches the index, then one
 * file, and converts it locally.
 */
function FiveToolsBrowser({ onImported }: { onImported: (name: string, n: number) => void }) {
  const addPack = useStore((s) => s.addPack)
  const setToast = useUi((s) => s.setToast)
  const [files, setFiles] = useState<CatalogueFile[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  // A plain string path while a single file is being taken, or the sentinel
  // below while a batch is running — either way, "truthy busy" disables the
  // whole list so two imports can't race each other.
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkFailed, setBulkFailed] = useState<{ path: string; reason: string }[]>([])

  const BULK_BUSY = '__bulk__'

  useEffect(() => {
    let alive = true
    fetch(HOMEBREW_INDEX, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Liste alınamadı (${r.status})`))))
      .then((raw) => alive && setFiles(parseCatalogue(raw)))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Liste alınamadı'))
    return () => {
      alive = false
    }
  }, [])

  const matches = useMemo(() => {
    if (!files) return []
    const needle = q.trim().toLocaleLowerCase('tr')
    const hits = needle
      ? files.filter((f) => f.path.toLocaleLowerCase('tr').includes(needle))
      : files
    // The full list is 700-odd rows; the browser renders them fine but nobody
    // scrolls that far, so searching is the intended way in.
    return hits.slice(0, 120)
  }, [files, q])

  const take = async (f: CatalogueFile) => {
    setBusy(f.path)
    setErr(null)
    try {
      const res = await fetch(rawUrlFor(f.path), { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Dosya alınamadı (${res.status})`)
      const fallback = f.path.split('/').pop()?.replace(/\.\w+$/, '') ?? 'İçe aktarılan'
      const { pack } = convertFiveTools(await res.json(), fallback)
      const n = countEntries(pack)
      if (!n) throw new Error('Bu dosyada aktarılabilir kayıt çıkmadı.')
      addPack(pack)
      onImported(pack.name, n)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Alınamadı')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allMatchesSelected = matches.length > 0 && matches.every((f) => selected.has(f.path))

  const toggleAllMatches = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allMatchesSelected) {
        for (const f of matches) next.delete(f.path)
      } else {
        for (const f of matches) next.add(f.path)
      }
      return next
    })
  }

  /**
   * Fetch every selected file and import whichever ones convert cleanly.
   *
   * A handful of requests in flight at once is plenty faster than one at a
   * time without leaning on raw.githubusercontent.com hard enough to get
   * throttled. One bad file (broken JSON, nothing importable in it) should
   * not stop the rest — it's reported at the end instead.
   */
  const takeMany = async () => {
    if (!files) return
    const picked = files.filter((f) => selected.has(f.path))
    if (!picked.length) return

    setBusy(BULK_BUSY)
    setErr(null)
    setBulkFailed([])
    setProgress({ done: 0, total: picked.length })

    const failed: { path: string; reason: string }[] = []
    let packCount = 0
    let entryCount = 0

    const CONCURRENCY = 4
    let cursor = 0
    const worker = async () => {
      while (cursor < picked.length) {
        const f = picked[cursor++]
        try {
          const res = await fetch(rawUrlFor(f.path), { headers: { Accept: 'application/json' } })
          if (!res.ok) throw new Error(`alınamadı (${res.status})`)
          const fallback = f.path.split('/').pop()?.replace(/\.\w+$/, '') ?? 'İçe aktarılan'
          const { pack } = convertFiveTools(await res.json(), fallback)
          const n = countEntries(pack)
          if (!n) throw new Error('aktarılabilir kayıt yok')
          addPack(pack)
          packCount++
          entryCount += n
        } catch (e) {
          failed.push({ path: f.path, reason: e instanceof Error ? e.message : 'alınamadı' })
        } finally {
          setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, worker))

    setBusy(null)
    setProgress(null)
    setBulkFailed(failed)
    // Only the successful ones leave the selection — a failed file stays
    // checked, so retrying is a matter of clicking the button again.
    setSelected(new Set(failed.map((f) => f.path)))

    if (packCount) {
      setToast(`${packCount} dosya içe aktarıldı — ${entryCount} kayıt` + (failed.length ? ` (${failed.length} başarısız)` : ''))
    } else if (failed.length) {
      setErr(`${failed.length} dosyanın hiçbiri aktarılamadı.`)
    }
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        <strong>TheGiddyLimit/homebrew</strong> — topluluğun paylaştığı 5etools homebrew’u. Bir dosya seç,
        tarayıcın doğrudan GitHub’dan çekip Kâhin biçimine çevirsin.
      </p>

      <input
        className="field"
        placeholder="Ara: kobold, tome of beasts, spell…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      {err && (
        <p className="text-[0.75rem] px-2 py-1 rounded-lg" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          {err}
        </p>
      )}

      {!files && !err && (
        <p className="text-[0.78rem]" style={{ color: 'var(--ink-mute)' }}>
          Liste alınıyor…
        </p>
      )}

      {files && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[0.68rem]" style={{ color: 'var(--ink-mute)' }}>
              {files.length} dosya · {matches.length} gösteriliyor
              {selected.size > 0 && ` · ${selected.size} seçili`}
            </p>
            <button
              className="btn btn-xs ml-auto"
              disabled={matches.length === 0 || !!busy}
              onClick={toggleAllMatches}
            >
              {allMatchesSelected ? 'Görünenleri bırak' : 'Görünenleri seç'}
            </button>
            <button
              className="btn btn-accent btn-xs"
              disabled={selected.size === 0 || !!busy}
              onClick={() => void takeMany()}
              title="Seçili dosyaları toplu içe aktar"
            >
              {busy === BULK_BUSY
                ? `Alınıyor… ${progress?.done ?? 0}/${progress?.total ?? 0}`
                : `Seçilenleri içe aktar${selected.size ? ` (${selected.size})` : ''}`}
            </button>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {matches.map((f) => {
              const kinds = [...new Set(f.kinds.map((k) => KIND_LABELS[k] ?? k))]
              return (
                <div
                  key={f.path}
                  className="w-full flex items-baseline gap-2 px-2.5 py-1.5 rounded-xl text-[0.74rem]"
                  style={{ background: 'var(--bg-deep)' }}
                >
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={selected.has(f.path)}
                    disabled={!!busy}
                    onChange={() => toggle(f.path)}
                  />
                  <button
                    className="flex-1 min-w-0 text-left truncate hover:opacity-80"
                    disabled={!!busy}
                    onClick={() => void take(f)}
                    title="Tek başına içe aktar"
                  >
                    <span className="truncate" style={{ color: 'var(--ink-soft)' }}>
                      {f.path.replace(/\.json$/, '')}
                    </span>
                  </button>
                  <span className="ml-auto shrink-0 text-[0.66rem]" style={{ color: 'var(--ink-mute)' }}>
                    {busy === f.path ? 'alınıyor…' : kinds.join(' · ')}
                  </span>
                </div>
              )
            })}
            {matches.length === 0 && (
              <p className="text-[0.75rem] py-2" style={{ color: 'var(--ink-mute)' }}>
                Eşleşme yok.
              </p>
            )}
          </div>

          {bulkFailed.length > 0 && (
            <details>
              <summary className="text-[0.74rem] cursor-pointer" style={{ color: 'var(--rose)' }}>
                {bulkFailed.length} dosya aktarılamadı
              </summary>
              <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto pr-1">
                {bulkFailed.map((f, i) => (
                  <p key={i} className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                    {f.path.replace(/\.json$/, '')}: {f.reason}
                  </p>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <p className="text-[0.64rem] leading-relaxed" style={{ color: 'var(--ink-mute)' }}>
        Bu içerik topluluk üyelerinin kendi yazdığı ve paylaştığı homebrew’dur; resmî kitap metni değildir.
        Alınan her şey yalnızca senin tarayıcında durur.
      </p>
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
  const [showBrowser, setShowBrowser] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [bulk, setBulk] = useState<BulkReport | null>(null)
  const [reading, setReading] = useState(false)

  const pack = packs.find((p) => p.id === activePackId) ?? packs[0] ?? null

  const create = () => {
    const name = window.prompt('Derleme adı:', 'Kendi Derlemem')
    if (name) addPack(emptyPack(name))
  }

  const importFile = async (file: File) => {
    try {
      const { pack: imported, warnings } = parseAnyPack(JSON.parse(await file.text()), file.name.replace(/\.\w+$/, ''))
      addPack(imported)
      setToast(
        `"${imported.name}" içe aktarıldı — ${countEntries(imported)} kayıt` +
          (warnings.length ? ` (${warnings.length} uyarı)` : ''),
      )
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Dosya okunamadı')
    }
  }

  /**
   * Read a whole selection without committing it.
   *
   * A folder can hold fifty files; the report is shown first so nobody has to
   * discover what happened by scrolling through the pack list afterwards.
   */
  const readBulk = async (files: File[]) => {
    if (!files.length) return
    setReading(true)
    try {
      setBulk(await importFiles(files))
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Klasör okunamadı')
    } finally {
      setReading(false)
    }
  }

  const commitBulk = () => {
    if (!bulk) return
    for (const p of bulk.packs) addPack(p)
    setToast(`${bulk.packs.length} derleme · ${reportEntries(bulk)} kayıt içe aktarıldı`)
    setBulk(null)
  }

  const importFromUrl = async () => {
    try {
      // A github.com link pasted from the address bar points at an HTML page,
      // which answers with a web page and no CORS header. Rewrite rather than
      // explain the difference.
      const url = toRawUrl(importUrl.trim())
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Kaynak yanıt vermedi (${res.status})`)
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').replace(/\.\w+$/, '')
      const { pack: imported } = parseAnyPack(await res.json(), name || 'İçe aktarılan')
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
            <Icons.upload className="w-3 h-3" /> Dosya
          </button>
          <button
            className="btn btn-xs"
            disabled={reading}
            onClick={() => folderRef.current?.click()}
            title="Bir klasördeki tüm JSON dosyaları"
          >
            <Icons.upload className="w-3 h-3" /> {reading ? 'Okunuyor…' : 'Klasör'}
          </button>
          <button className="btn btn-xs" onClick={() => setShowBrowser(true)} title="5etools topluluk homebrew’u">
            5etools
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
        multiple
        className="hidden"
        onChange={(e) => {
          const list = [...(e.target.files ?? [])]
          // One file keeps the old single-import message; several go through
          // the report, same as a folder.
          if (list.length === 1) void importFile(list[0])
          else void readBulk(list)
          e.target.value = ''
        }}
      />

      <input
        ref={folderRef}
        type="file"
        className="hidden"
        // Not in React's typings, but it is what turns the file picker into a
        // directory picker in every browser that supports one.
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          void readBulk([...(e.target.files ?? [])])
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

      <Modal open={!!bulk} onClose={() => setBulk(null)} title="Klasörden içe aktar">
        {bulk && (
          <div className="space-y-3">
            <p className="text-[0.82rem]" style={{ color: 'var(--ink-soft)' }}>
              {bulk.scanned} dosya tarandı → <strong>{bulk.packs.length} derleme</strong>, {reportEntries(bulk)} kayıt.
            </p>

            {bulk.packs.length > 0 ? (
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {bulk.packs.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-2 px-2.5 py-1.5 rounded-xl text-[0.76rem]"
                    style={{ background: 'var(--bg-deep)' }}
                  >
                    <span className="font-medium truncate" style={{ color: 'var(--ink-soft)' }}>
                      {p.name}
                    </span>
                    <span className="ml-auto shrink-0" style={{ color: 'var(--ink-mute)' }}>
                      {countEntries(p)} kayıt
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.78rem]" style={{ color: 'var(--rose)' }}>
                Bu klasörde okunabilecek bir şey çıkmadı.
              </p>
            )}

            {/* Skips are listed, not counted: "12 dosya atlandı" tells a DM
                nothing about which twelve or what to fix. */}
            {bulk.skipped.length > 0 && (
              <details>
                <summary className="text-[0.74rem] cursor-pointer" style={{ color: 'var(--ink-mute)' }}>
                  {bulk.skipped.length} dosya atlandı
                </summary>
                <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto pr-1">
                  {bulk.skipped.map((s, i) => (
                    <p key={i} className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{s.path}</span> — {s.reason}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {bulk.warnings.length > 0 && (
              <details>
                <summary className="text-[0.74rem] cursor-pointer" style={{ color: 'var(--ink-mute)' }}>
                  {bulk.warnings.length} uyarı
                </summary>
                <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto pr-1">
                  {bulk.warnings.map((w, i) => (
                    <p key={i} className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                      {w}
                    </p>
                  ))}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <button className="btn flex-1" onClick={() => setBulk(null)}>
                Vazgeç
              </button>
              <button className="btn btn-accent flex-1" disabled={bulk.packs.length === 0} onClick={commitBulk}>
                İçe aktar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showBrowser} onClose={() => setShowBrowser(false)} title="5etools homebrew">
        <FiveToolsBrowser
          onImported={(name, n) => {
            setToast(`"${name}" içe aktarıldı — ${n} kayıt`)
            setShowBrowser(false)
          }}
        />
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="URL’den içe aktar">
        <p className="text-[0.8rem] mb-3" style={{ color: 'var(--ink-soft)' }}>
          Bir arkadaşının paylaştığı derlemenin doğrudan JSON adresini yapıştır (GitHub raw, gist, kendi sunucun).
          Kaynağın CORS’a izin vermesi gerekir.
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
