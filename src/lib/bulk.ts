/**
 * Folder import for the Forge.
 *
 * Importing one file at a time is fine for a pack someone sent you. It is not
 * fine for the way homebrew actually accumulates: a folder per campaign, a file
 * per monster, built up over months. This takes a whole directory in one go.
 *
 * Two problems have to be solved for that to be useful rather than merely
 * possible.
 *
 * The first is shape. Most files in such a folder are not Kâhin packs — they
 * are a bare monster, or an array of spells exported from some other tool. The
 * pack parser looks for `monsters`/`spells`/… arrays and would quietly import
 * nothing at all from them, so loose entries are recognised and sorted by what
 * their fields say they are.
 *
 * The second is grouping. Twenty monster files becoming twenty one-entry packs
 * is a worse mess than the folder was. So the folder itself is the unit: loose
 * files are gathered into one pack named after the directory holding them, and
 * a file that is already a proper pack keeps its own name and identity.
 */

import {
  BREW_FORMAT,
  emptyPack,
  parsePack,
  blankMonster,
  blankSpell,
  blankItem,
  blankTable,
  blankNpc,
  countEntries,
  type BrewPack,
  type BrewTable,
  type BrewNpc,
} from './homebrew'
import { isFiveToolsFile, convertFiveTools } from './fivetools'
import type { Monster, Spell, MagicItem } from './open5e'

/**
 * Parse whatever a file turns out to be.
 *
 * Kâhin's own format, a 5etools file, or something pack-shaped from another
 * tool — the caller should not have to know which, so the sniffing lives here
 * and every import route (single file, folder, URL) goes through it.
 */
export function parseAnyPack(raw: unknown, fallbackName: string): { pack: BrewPack; warnings: string[] } {
  if (isFiveToolsFile(raw)) return convertFiveTools(raw, fallbackName)
  return parsePack(raw, fallbackName)
}

/** Above this a "folder" is almost certainly a mistake — a whole Downloads dir. */
export const MAX_FILES = 600

export type EntryKind = 'monster' | 'spell' | 'item' | 'table' | 'npc'

export interface SkippedFile {
  path: string
  reason: string
}

export interface BulkReport {
  /** Ready to hand to addPack, in order. */
  packs: BrewPack[]
  skipped: SkippedFile[]
  warnings: string[]
  /** Everything that came out of the picker, including non-JSON. */
  scanned: number
}

/* ------------------------------------------------------------------ sniffing */

const has = (o: Record<string, unknown>, key: string) => o[key] !== undefined

/**
 * Work out what a loose object is from the fields it carries.
 *
 * Deliberately checks the fields that only one kind has — `challenge_rating`
 * for a monster, `casting_time` for a spell — rather than the ones several
 * share. `level`, for instance, appears on spells and on plenty of NPC
 * exports, so it is never the deciding vote on its own.
 */
export function sniffKind(value: unknown): EntryKind | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim()) return null

  if (has(o, 'challenge_rating') || has(o, 'armor_class') || has(o, 'hit_dice') || has(o, 'hit_points')) {
    return 'monster'
  }
  if (has(o, 'casting_time') || has(o, 'school') || (has(o, 'level') && has(o, 'components'))) {
    return 'spell'
  }
  if (has(o, 'rarity') || has(o, 'requires_attunement')) return 'item'
  if (Array.isArray(o.rows)) return 'table'
  if (has(o, 'motivation') || has(o, 'quirk') || has(o, 'appearance')) return 'npc'
  return null
}

function pushEntry(pack: BrewPack, kind: EntryKind, src: Record<string, unknown>): void {
  const name = pack.name
  switch (kind) {
    case 'monster':
      pack.monsters.push({ ...blankMonster(name), ...(src as Partial<Monster>), document__title: name, homebrew: true } as Monster)
      break
    case 'spell':
      pack.spells.push({ ...blankSpell(name), ...(src as Partial<Spell>), document__title: name, homebrew: true } as Spell)
      break
    case 'item':
      pack.items.push({ ...blankItem(name), ...(src as Partial<MagicItem>), document__title: name, homebrew: true } as MagicItem)
      break
    case 'table': {
      const rows = Array.isArray(src.rows) ? src.rows.map(String) : []
      pack.tables.push({ ...blankTable(), ...(src as Partial<BrewTable>), rows })
      break
    }
    case 'npc':
      pack.npcs.push({ ...blankNpc(), ...(src as Partial<BrewNpc>) })
      break
  }
}

/* ------------------------------------------------------------------ paths */

/** The directory a file sits in, or '' for the picker's top level. */
export function folderOf(path: string): string {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

/** The name to give a pack gathered from a folder. */
export function packNameFor(folder: string, fallback: string): string {
  const leaf = folder.split('/').filter(Boolean).pop()
  return leaf || fallback
}

/** webkitRelativePath when the browser gives one, otherwise the plain name. */
export function pathOf(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return rel && rel.length ? rel : file.name
}

/* ------------------------------------------------------------------ import */

interface Loose {
  folder: string
  kind: EntryKind
  src: Record<string, unknown>
}

function isJson(file: File): boolean {
  return file.type === 'application/json' || /\.json$/i.test(file.name)
}

/**
 * Read a directory's worth of files into packs.
 *
 * Nothing is added to the store here — the caller shows the report first. With
 * fifty files at once, "what is about to happen" is not a question anyone
 * should have to answer by watching it happen.
 */
export async function importFiles(files: File[], fallbackName = 'İçe aktarılan'): Promise<BulkReport> {
  const scanned = files.length
  const skipped: SkippedFile[] = []
  const warnings: string[] = []
  const packs: BrewPack[] = []
  const loose: Loose[] = []

  const json = files.filter(isJson)
  for (const f of files) {
    if (!isJson(f)) skipped.push({ path: pathOf(f), reason: 'JSON değil' })
  }

  if (json.length > MAX_FILES) {
    throw new Error(`${json.length} JSON dosyası fazla — en fazla ${MAX_FILES} dosya alınabilir. Daha küçük bir klasör seç.`)
  }

  const texts = await Promise.all(
    json.map(async (f) => {
      try {
        return { file: f, text: await f.text(), error: null as string | null }
      } catch {
        return { file: f, text: '', error: 'Dosya okunamadı' }
      }
    }),
  )

  for (const { file, text, error } of texts) {
    const path = pathOf(file)
    const folder = folderOf(path)

    if (error) {
      skipped.push({ path, reason: error })
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      skipped.push({ path, reason: 'Bozuk JSON' })
      continue
    }

    // A whole-screen backup in a homebrew folder is a plausible mistake, and
    // one worth naming rather than reporting as an empty import.
    const asObj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    if (asObj && typeof asObj.format === 'string' && asObj.format.startsWith('kahin-backup/')) {
      skipped.push({ path, reason: 'Bu bir yedek dosyası — Kampanya → Ayarlar’dan geri yükle' })
      continue
    }

    // Already a pack, or a 5etools file: either way it names itself, so it
    // keeps its own identity rather than being gathered under the folder.
    if (asObj && (asObj.format === BREW_FORMAT || isFiveToolsFile(parsed))) {
      try {
        const { pack, warnings: w } = parseAnyPack(parsed, file.name.replace(/\.\w+$/, ''))
        packs.push(pack)
        for (const line of w) warnings.push(`${path}: ${line}`)
      } catch (e) {
        skipped.push({ path, reason: e instanceof Error ? e.message : 'Okunamadı' })
      }
      continue
    }

    // An array of entries, all assumed to be the same kind as the first one
    // that can be identified.
    if (Array.isArray(parsed)) {
      let taken = 0
      for (const el of parsed) {
        const kind = sniffKind(el)
        if (!kind) continue
        loose.push({ folder, kind, src: el as Record<string, unknown> })
        taken++
      }
      if (taken === 0) skipped.push({ path, reason: 'Tanınan kayıt yok' })
      else if (taken < parsed.length) warnings.push(`${path}: ${parsed.length - taken} kayıt tanınmadı`)
      continue
    }

    // A single loose entry.
    const kind = sniffKind(parsed)
    if (kind) {
      loose.push({ folder, kind, src: asObj as Record<string, unknown> })
      continue
    }

    // A pack-shaped object without our format stamp — let the tolerant parser
    // have a go before giving up on it.
    if (asObj && ['monsters', 'spells', 'items', 'tables', 'npcs'].some((k) => Array.isArray(asObj[k]))) {
      try {
        const { pack, warnings: w } = parseAnyPack(parsed, file.name.replace(/\.\w+$/, ''))
        if (countEntries(pack) > 0) {
          packs.push(pack)
          for (const line of w) warnings.push(`${path}: ${line}`)
          continue
        }
      } catch {
        /* fall through to skipped */
      }
    }

    skipped.push({ path, reason: 'Tanınmayan içerik' })
  }

  // Gather the loose entries, one pack per folder they came from.
  const byFolder = new Map<string, Loose[]>()
  for (const l of loose) {
    const list = byFolder.get(l.folder)
    if (list) list.push(l)
    else byFolder.set(l.folder, [l])
  }

  for (const [folder, entries] of byFolder) {
    const pack = emptyPack(packNameFor(folder, fallbackName))
    pack.description = folder ? `${folder} klasöründen içe aktarıldı` : 'Dosyalardan içe aktarıldı'
    for (const e of entries) pushEntry(pack, e.kind, e.src)
    packs.push(pack)
  }

  return { packs, skipped, warnings, scanned }
}

/** Total entries across a report's packs, for the confirmation line. */
export function reportEntries(report: BulkReport): number {
  return report.packs.reduce((n, p) => n + countEntries(p), 0)
}
