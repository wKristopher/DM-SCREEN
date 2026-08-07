/**
 * Whole-screen backup.
 *
 * Everything this app knows lives in one browser's localStorage: the party,
 * the session notes, the log, the homebrew, the settings. There is no account
 * and no server, which is the point — but it also means a cleared browser, a
 * private window, or simply picking up a different device loses the campaign.
 * The Ocak tab already exports homebrew; this exports the rest.
 *
 * It doubles as the way to move a campaign between devices, since a logged-in
 * site still keeps its data client-side.
 */

import type { BrewPack } from './homebrew'

export const BACKUP_FORMAT = 'kahin-backup/1'

/** Matches the store's persisted shape; kept loose so an older file still loads. */
export interface BackupData {
  combatants?: unknown[]
  round?: number
  turn?: number
  combatActive?: boolean
  party?: unknown[]
  notes?: string
  log?: unknown[]
  packs?: BrewPack[]
  activePackId?: string | null
  headline?: string
  /** Prepared fights. Lost prep is the kind of loss a backup exists to stop. */
  encounters?: unknown[]
  /**
   * Left as `unknown` on purpose: this module must not import the store's
   * Settings type, or the backup format would be pinned to whatever the app
   * happens to look like today and old files would stop parsing.
   */
  settings?: unknown
}

export interface Backup {
  format: string
  savedAt: string
  app: string
  data: BackupData
}

/** What a file contains, for showing the DM before anything is overwritten. */
export interface BackupSummary {
  savedAt: string
  party: number
  logEntries: number
  noteChars: number
  packs: number
  brewEntries: number
  encounters: number
  hasSettings: boolean
}

/**
 * Strip anything that must not travel in a file.
 *
 * A backup gets mailed to yourself, dropped in a shared folder, handed to a
 * friend who wants your homebrew. An API key riding along in it would be a
 * credential leak with a very innocent-looking cause, so the keys are removed
 * here rather than trusted to stay out.
 */
function scrubSettings(settings: unknown): Record<string, unknown> | undefined {
  if (!settings || typeof settings !== 'object') return undefined
  const s = { ...(settings as Record<string, unknown>) }
  const llm = s.llm
  if (llm && typeof llm === 'object') {
    // Keep the provider and model choices — those are preferences, not secrets.
    const { keys: _dropped, ...rest } = llm as Record<string, unknown>
    s.llm = { ...rest, keys: {}, enabled: false }
  }
  return s
}

export function buildBackup(state: BackupData): Backup {
  return {
    format: BACKUP_FORMAT,
    app: 'Kâhin DM Screen',
    savedAt: new Date().toISOString(),
    data: {
      combatants: state.combatants ?? [],
      round: state.round ?? 1,
      turn: state.turn ?? 0,
      combatActive: state.combatActive ?? false,
      party: state.party ?? [],
      notes: state.notes ?? '',
      log: state.log ?? [],
      packs: state.packs ?? [],
      activePackId: state.activePackId ?? null,
      headline: state.headline ?? '',
      encounters: state.encounters ?? [],
      settings: scrubSettings(state.settings),
    },
  }
}

function countBrewEntries(packs: BrewPack[] | undefined): number {
  if (!packs) return 0
  let n = 0
  for (const p of packs) {
    for (const key of ['monsters', 'spells', 'items', 'tables', 'npcs'] as const) {
      const list = (p as unknown as Record<string, unknown>)[key]
      if (Array.isArray(list)) n += list.length
    }
  }
  return n
}

export function summarise(backup: Backup): BackupSummary {
  const d = backup.data
  return {
    savedAt: backup.savedAt,
    party: d.party?.length ?? 0,
    logEntries: d.log?.length ?? 0,
    noteChars: d.notes?.length ?? 0,
    packs: d.packs?.length ?? 0,
    brewEntries: countBrewEntries(d.packs),
    encounters: d.encounters?.length ?? 0,
    hasSettings: Boolean(d.settings),
  }
}

/**
 * Read a file, refusing anything that is not recognisably one of ours.
 *
 * Restoring replaces the campaign, so a wrong file must fail loudly here
 * rather than half-apply and leave the screen in a state nobody asked for.
 */
export function parseBackup(raw: string): Backup {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('Dosya okunamadı — geçerli bir JSON değil.')
  }

  if (!json || typeof json !== 'object') throw new Error('Dosya boş ya da beklenen biçimde değil.')
  const b = json as Partial<Backup>

  if (typeof b.format !== 'string' || !b.format.startsWith('kahin-backup/')) {
    throw new Error('Bu bir Kâhin yedeği değil. (Derleme dosyaları Ocak sekmesinden içe aktarılır.)')
  }
  if (!b.data || typeof b.data !== 'object') throw new Error('Yedek içeriği eksik.')

  return {
    format: b.format,
    app: typeof b.app === 'string' ? b.app : 'Kâhin DM Screen',
    savedAt: typeof b.savedAt === 'string' ? b.savedAt : new Date(0).toISOString(),
    data: b.data,
  }
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = backup.savedAt.slice(0, 10)
  a.href = url
  a.download = `kahin-yedek-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Turkish date/time for the UI, tolerant of a missing or broken timestamp. */
export function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return 'tarihsiz'
  return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
}
