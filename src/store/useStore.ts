/**
 * Application state.
 *
 * Everything lives in localStorage: a DM screen that loses the initiative
 * order on a refresh mid-combat is worse than no DM screen. There is no
 * server and no account — the campaign is the browser's.
 */

import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Monster } from '../lib/open5e'
import { passivePerception } from '../lib/open5e'
import type { BrewPack } from '../lib/homebrew'
import type { BackupData } from '../lib/backup'
import type { ProviderId } from '../lib/ai/providers'
import { PROVIDERS } from '../lib/ai/providers'
import { emptyPack, tablesToExtra } from '../lib/homebrew'
import { roll, abilityMod, setAmbientFavour, FAVOUR_LEVELS } from '../lib/dice'
import type { RollResult, FavourLevel } from '../lib/dice'
import { blankSheet, normaliseSheet, type CharacterSheet, type PassiveSkill } from '../lib/character'

/* ------------------------------------------------------------------ types */

export interface Condition {
  name: string
  /** Rounds remaining; null means "until removed". */
  rounds: number | null
}

export interface Combatant {
  id: string
  name: string
  initiative: number
  /** DEX modifier, used to break initiative ties the way the rules suggest. */
  dexMod: number
  ac: number
  hp: number
  maxHp: number
  tempHp: number
  conditions: Condition[]
  concentration: string | null
  isPc: boolean
  /** Death save tallies, PCs only. */
  deathSaves: { success: number; failure: number }
  /** Full statblock for monsters pulled from the compendium. */
  monster?: Monster
  notes: string
  /** Hidden from a shared/player view. */
  secret: boolean
}

export interface PartyMember extends CharacterSheet {
  id: string
  name: string
  player: string
  cls: string
  level: number
  ac: number
  maxHp: number
  notes: string
}

/**
 * A fight prepared before the session.
 *
 * The monsters are stored whole rather than as slugs. A saved encounter that
 * needs a network round trip before it can be used is not prep — it is a
 * promise, and it breaks in the one place it matters: a table with bad wifi.
 * The cost is a few KB each, which localStorage carries without noticing.
 */
export interface SavedEncounter {
  id: string
  name: string
  createdAt: number
  slots: Array<{ monster: Monster; count: number }>
  notes: string
}

export interface LogEntry {
  id: string
  at: number
  kind: 'roll' | 'note' | 'combat' | 'oracle'
  text: string
  detail?: string
}

export type ThemeName = 'dusk' | 'parchment'

/** Keys are held per provider so switching between them doesn't lose any. */
export interface LlmSettings {
  enabled: boolean
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  models: Partial<Record<ProviderId, string>>
  /** Only meaningful for the OpenAI-compatible provider. */
  baseUrl: string
}

export interface Settings {
  theme: ThemeName
  /** Open5e document slugs to include in searches; empty means all. */
  sources: string[]
  llm: LlmSettings
  autoRollInitiative: boolean
  showHpBars: boolean
  /** Race the fast SRD mirror alongside the full catalogue. */
  fastSource: boolean
  /** Surface per-source response times in the compendium header. */
  showTimings: boolean
  dice: DiceSettings
}

export interface DiceSettings {
  /** 'fair' is an honest die; 'favoured' leans the roller high. */
  mode: 'fair' | 'favoured'
  level: FavourLevel['id']
}

interface State {
  /* combat */
  combatants: Combatant[]
  round: number
  turn: number
  combatActive: boolean

  /* campaign */
  party: PartyMember[]
  notes: string
  log: LogEntry[]

  /** A line the DM pushes to the player screen. */
  headline: string

  /* prep */
  encounters: SavedEncounter[]

  /* content */
  packs: BrewPack[]
  activePackId: string | null

  /* prefs */
  settings: Settings

  /* -------------------------------------------------- combat actions */
  addCombatant: (c: Partial<Combatant> & { name: string }) => string
  addMonsterToCombat: (m: Monster, count?: number) => void
  addPartyToCombat: () => void
  updateCombatant: (id: string, patch: Partial<Combatant>) => void
  removeCombatant: (id: string) => void
  damage: (id: string, amount: number) => void
  heal: (id: string, amount: number) => void
  toggleCondition: (id: string, name: string, rounds?: number | null) => void
  setConcentration: (id: string, spell: string | null) => void
  markDeathSave: (id: string, kind: 'success' | 'failure', delta: number) => void
  rollAllInitiative: () => void
  sortInitiative: () => void
  nextTurn: () => void
  prevTurn: () => void
  startCombat: () => void
  endCombat: () => void

  /* -------------------------------------------------- party */
  addPartyMember: () => void
  updatePartyMember: (id: string, patch: Partial<PartyMember>) => void
  removePartyMember: (id: string) => void

  /* -------------------------------------------------- log & notes */
  pushLog: (kind: LogEntry['kind'], text: string, detail?: string) => void
  logRoll: (r: RollResult, label?: string) => void
  clearLog: () => void
  setNotes: (n: string) => void
  setHeadline: (h: string) => void

  /* -------------------------------------------------- prep */
  saveEncounter: (name: string, slots: SavedEncounter['slots'], notes?: string) => void
  removeEncounter: (id: string) => void
  renameEncounter: (id: string, name: string) => void

  /* -------------------------------------------------- homebrew */
  addPack: (p: BrewPack) => void
  updatePack: (id: string, patch: Partial<BrewPack>) => void
  removePack: (id: string) => void
  setActivePack: (id: string | null) => void
  ensurePack: () => BrewPack

  /* -------------------------------------------------- settings */
  setSettings: (patch: Partial<Settings>) => void

  /** Everything worth keeping, in the shape a backup file carries. */
  snapshot: () => BackupData
  /** Replace the campaign with a backup's contents. */
  restore: (data: BackupData) => void
}

/* ------------------------------------------------------------------ helpers */

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Goblin, Goblin 2, Goblin 3 — never two identically-named things on the tracker. */
function uniqueName(existing: Combatant[], base: string): string {
  const taken = new Set(existing.map((c) => c.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dusk',
  sources: [],
  llm: {
    enabled: false,
    provider: 'anthropic',
    keys: {},
    models: {},
    baseUrl: PROVIDERS.compatible.defaultBaseUrl,
  },
  autoRollInitiative: true,
  showHpBars: true,
  fastSource: true,
  showTimings: true,
  dice: { mode: 'fair', level: 'medium' },
}

/* ------------------------------------------------------------------ store */

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      combatants: [],
      round: 1,
      turn: 0,
      combatActive: false,
      party: [],
      notes: '',
      log: [],
      headline: '',
      encounters: [],
      packs: [],
      activePackId: null,
      settings: DEFAULT_SETTINGS,

      /* ---------------------------------------------------------- combat */

      addCombatant: (c) => {
        const id = newId()
        set((s) => ({
          combatants: [
            ...s.combatants,
            {
              id,
              name: uniqueName(s.combatants, c.name),
              initiative: c.initiative ?? 0,
              dexMod: c.dexMod ?? 0,
              ac: c.ac ?? 10,
              hp: c.hp ?? 1,
              maxHp: c.maxHp ?? c.hp ?? 1,
              tempHp: 0,
              conditions: [],
              concentration: null,
              isPc: c.isPc ?? false,
              deathSaves: { success: 0, failure: 0 },
              monster: c.monster,
              notes: c.notes ?? '',
              secret: c.secret ?? false,
            },
          ],
        }))
        return id
      },

      addMonsterToCombat: (m, count = 1) => {
        const auto = get().settings.autoRollInitiative
        const dexMod = abilityMod(m.dexterity)
        for (let i = 0; i < count; i++) {
          // Each monster rolls its own initiative and HP, so a pack of four
          // goblins doesn't act as one blob.
          const hp = m.hit_dice ? Math.max(1, roll(m.hit_dice).total) : m.hit_points
          get().addCombatant({
            name: m.name,
            initiative: auto ? roll(`1d20${dexMod >= 0 ? '+' : ''}${dexMod}`).total : 0,
            dexMod,
            ac: m.armor_class,
            hp,
            maxHp: hp,
            isPc: false,
            monster: m,
          })
        }
        get().pushLog('combat', `${m.name} ×${count} savaşa eklendi`)
      },

      addPartyToCombat: () => {
        const { party, combatants, settings } = get()
        for (const p of party) {
          if (combatants.some((c) => c.isPc && c.name === p.name)) continue
          // The roster knows their DEX now, so initiative is rolled properly
          // rather than as a bare d20 the DM has to adjust in their head.
          const dexMod = abilityMod(p.abilities?.dex ?? 10)
          get().addCombatant({
            name: p.name,
            initiative: settings.autoRollInitiative ? roll(`1d20${dexMod >= 0 ? '+' : ''}${dexMod}`).total : 0,
            dexMod,
            ac: p.ac,
            hp: p.maxHp,
            maxHp: p.maxHp,
            isPc: true,
          })
        }
      },

      updateCombatant: (id, patch) =>
        set((s) => ({ combatants: s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      removeCombatant: (id) =>
        set((s) => {
          const idx = s.combatants.findIndex((c) => c.id === id)
          const combatants = s.combatants.filter((c) => c.id !== id)
          // Keep the turn pointer on the same creature when one ahead is removed.
          let turn = s.turn
          if (idx !== -1 && idx < s.turn) turn = Math.max(0, s.turn - 1)
          if (turn >= combatants.length) turn = 0
          return { combatants, turn }
        }),

      damage: (id, amount) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            // Temp HP soaks first, and is spent before real HP.
            const fromTemp = Math.min(c.tempHp, amount)
            const rest = amount - fromTemp
            return { ...c, tempHp: c.tempHp - fromTemp, hp: Math.max(0, c.hp - rest) }
          }),
        })),

      heal: (id, amount) =>
        set((s) => ({
          combatants: s.combatants.map((c) =>
            c.id === id
              ? {
                  ...c,
                  hp: Math.min(c.maxHp, c.hp + amount),
                  // Any healing brings a dying PC back, clearing the tally.
                  deathSaves: amount > 0 && c.hp === 0 ? { success: 0, failure: 0 } : c.deathSaves,
                }
              : c,
          ),
        })),

      toggleCondition: (id, name, rounds = null) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            const has = c.conditions.some((x) => x.name === name)
            return {
              ...c,
              conditions: has
                ? c.conditions.filter((x) => x.name !== name)
                : [...c.conditions, { name, rounds }],
            }
          }),
        })),

      setConcentration: (id, spell) =>
        set((s) => ({ combatants: s.combatants.map((c) => (c.id === id ? { ...c, concentration: spell } : c)) })),

      markDeathSave: (id, kind, delta) =>
        set((s) => ({
          combatants: s.combatants.map((c) => {
            if (c.id !== id) return c
            const next = Math.max(0, Math.min(3, c.deathSaves[kind] + delta))
            return { ...c, deathSaves: { ...c.deathSaves, [kind]: next } }
          }),
        })),

      rollAllInitiative: () => {
        set((s) => ({
          combatants: s.combatants.map((c) => ({
            ...c,
            initiative: roll(`1d20${c.dexMod >= 0 ? '+' : ''}${c.dexMod}`).total,
          })),
        }))
        get().sortInitiative()
      },

      sortInitiative: () =>
        set((s) => ({
          combatants: [...s.combatants].sort(
            (a, b) => b.initiative - a.initiative || b.dexMod - a.dexMod || a.name.localeCompare(b.name, 'tr'),
          ),
          turn: 0,
        })),

      nextTurn: () =>
        set((s) => {
          if (!s.combatants.length) return s
          const next = s.turn + 1
          const wrapped = next >= s.combatants.length
          const round = wrapped ? s.round + 1 : s.round

          // Timed conditions tick down at the end of a full round.
          const combatants = wrapped
            ? s.combatants.map((c) => ({
                ...c,
                conditions: c.conditions
                  .map((x) => (x.rounds === null ? x : { ...x, rounds: x.rounds - 1 }))
                  .filter((x) => x.rounds === null || x.rounds > 0),
              }))
            : s.combatants

          return { turn: wrapped ? 0 : next, round, combatants }
        }),

      prevTurn: () =>
        set((s) => {
          if (!s.combatants.length) return s
          const prev = s.turn - 1
          if (prev < 0) return { turn: s.combatants.length - 1, round: Math.max(1, s.round - 1) }
          return { turn: prev }
        }),

      startCombat: () => {
        get().sortInitiative()
        set({ combatActive: true, round: 1, turn: 0 })
        get().pushLog('combat', 'Savaş başladı')
      },

      endCombat: () => {
        set({ combatActive: false, round: 1, turn: 0, combatants: [] })
        get().pushLog('combat', 'Savaş bitti')
      },

      /* ---------------------------------------------------------- party */

      addPartyMember: () =>
        set((s) => ({
          party: [
            ...s.party,
            {
              id: newId(),
              name: 'Yeni Karakter',
              player: '',
              cls: '',
              level: 1,
              ac: 14,
              maxHp: 10,
              notes: '',
              ...blankSheet(),
            },
          ],
        })),

      updatePartyMember: (id, patch) =>
        set((s) => ({ party: s.party.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removePartyMember: (id) => set((s) => ({ party: s.party.filter((p) => p.id !== id) })),

      /* ---------------------------------------------------------- log */

      pushLog: (kind, text, detail) =>
        set((s) => ({
          // Cap the log so a long campaign can't blow the storage quota.
          log: [{ id: newId(), at: Date.now(), kind, text, detail }, ...s.log].slice(0, 300),
        })),

      logRoll: (r, label) => {
        if (r.error) return
        get().pushLog('roll', `${label ? `${label}: ` : ''}${r.expression} → ${r.total}`, r.breakdown)
      },

      clearLog: () => set({ log: [] }),

      setNotes: (n) => set({ notes: n }),

      setHeadline: (h) => set({ headline: h }),

      saveEncounter: (name, slots, notes = '') =>
        set((s) => ({
          encounters: [
            { id: newId(), name: name.trim() || 'Adsız karşılaşma', createdAt: Date.now(), slots, notes },
            ...s.encounters,
          ],
        })),

      removeEncounter: (id) => set((s) => ({ encounters: s.encounters.filter((e) => e.id !== id) })),

      renameEncounter: (id, name) =>
        set((s) => ({ encounters: s.encounters.map((e) => (e.id === id ? { ...e, name } : e)) })),

      /* ---------------------------------------------------------- homebrew */

      addPack: (p) => set((s) => ({ packs: [...s.packs, p], activePackId: p.id })),

      updatePack: (id, patch) =>
        set((s) => ({
          packs: s.packs.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
        })),

      removePack: (id) =>
        set((s) => ({
          packs: s.packs.filter((p) => p.id !== id),
          activePackId: s.activePackId === id ? null : s.activePackId,
        })),

      setActivePack: (id) => set({ activePackId: id }),

      ensurePack: () => {
        const { packs, activePackId } = get()
        const found = packs.find((p) => p.id === activePackId) ?? packs[0]
        if (found) {
          if (activePackId !== found.id) set({ activePackId: found.id })
          return found
        }
        const pack = emptyPack()
        set((s) => ({ packs: [...s.packs, pack], activePackId: pack.id }))
        return pack
      },

      /* ---------------------------------------------------------- settings */

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      snapshot: () => {
        const s = get()
        return {
          combatants: s.combatants,
          round: s.round,
          turn: s.turn,
          combatActive: s.combatActive,
          party: s.party,
          notes: s.notes,
          log: s.log,
          packs: s.packs,
          activePackId: s.activePackId,
          headline: s.headline,
          encounters: s.encounters,
          settings: s.settings,
        }
      },

      restore: (data) =>
        set((s) => {
          const incoming = (data.settings ?? {}) as Partial<Settings>
          return {
            combatants: (data.combatants as Combatant[]) ?? [],
            round: data.round ?? 1,
            turn: data.turn ?? 0,
            combatActive: data.combatActive ?? false,
            party: (data.party as PartyMember[]) ?? [],
            notes: data.notes ?? '',
            log: (data.log as LogEntry[]) ?? [],
            packs: data.packs ?? [],
            activePackId: data.activePackId ?? null,
            headline: data.headline ?? '',
            encounters: (data.encounters as SavedEncounter[]) ?? [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...incoming,
              // Backups deliberately carry no API keys, so restoring one must
              // not wipe the keys already typed into this browser.
              llm: { ...DEFAULT_SETTINGS.llm, ...(incoming.llm ?? {}), keys: s.settings.llm.keys, enabled: s.settings.llm.enabled },
              dice: { ...DEFAULT_SETTINGS.dice, ...(incoming.dice ?? {}) },
            },
          }
        }),
    }),
    {
      name: 'kahin.state',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        combatants: s.combatants,
        round: s.round,
        turn: s.turn,
        combatActive: s.combatActive,
        party: s.party,
        notes: s.notes,
        log: s.log,
        headline: s.headline,
        encounters: s.encounters,
        packs: s.packs,
        activePackId: s.activePackId,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        // Settings gain fields between releases; keep defaults for new ones.
        const p = (persisted ?? {}) as Partial<State>
        const saved = (p.settings ?? {}) as Partial<Settings> & {
          // Pre-multi-provider shape, carried forward so an existing key survives.
          llmKey?: string
          llmEnabled?: boolean
        }

        const llm: LlmSettings = {
          ...DEFAULT_SETTINGS.llm,
          ...(saved.llm ?? {}),
        }
        if (!saved.llm && saved.llmKey) {
          llm.keys = { anthropic: saved.llmKey }
          llm.enabled = saved.llmEnabled ?? false
        }

        const dice = { ...DEFAULT_SETTINGS.dice, ...(saved.dice ?? {}) }

        /**
         * Rosters written before character sheets existed stored the three
         * passive scores as plain numbers and had no ability scores to
         * recompute them from. Deriving would silently replace a real 15 with
         * a 10, so they are carried across as manual values instead.
         */
        const party = (p.party ?? []).map((raw) => {
          const m = raw as PartyMember & Partial<Record<`passive${PassiveSkill}`, number>>
          const sheet = normaliseSheet(m)
          const overrides = { ...sheet.passiveOverrides }

          // `abilities` is the marker that a member has already been through
          // here. Without it the legacy numbers would be re-applied on every
          // load — deleting them below only cleans the in-memory copy, and the
          // raw localStorage entry keeps them until the next write. That made
          // "back to the derived value" undo itself on refresh.
          if (!m.abilities) {
            const legacy: Array<[PassiveSkill, number | undefined]> = [
              ['Perception', m.passivePerception],
              ['Investigation', m.passiveInvestigation],
              ['Insight', m.passiveInsight],
            ]
            for (const [skill, value] of legacy) {
              if (typeof value === 'number' && overrides[skill] === undefined) overrides[skill] = value
            }
          }
          // Drop the legacy fields once carried across. Leaving them would make
          // the migration re-apply them on every load, so "back to the derived
          // value" would appear to work and then silently undo itself.
          const migrated = { ...m, ...sheet, passiveOverrides: overrides }
          delete migrated.passivePerception
          delete migrated.passiveInvestigation
          delete migrated.passiveInsight
          return migrated
        })

        return {
          ...current,
          ...p,
          party,
          settings: { ...DEFAULT_SETTINGS, ...saved, llm, dice },
        }
      },
    },
  ),
)

/* ------------------------------------------------------------------ derived */

/**
 * Derived views are hooks rather than plain selectors on purpose.
 *
 * Zustand compares snapshots with Object.is, so a selector that builds a fresh
 * array or object on every call reports "changed" on every render and spins
 * forever. Selecting the stable `packs` reference and deriving with useMemo
 * gives a stable result.
 */

const selectPacks = (s: State) => s.packs

/** Favour currently in force, 0 when the roller is honest. */
export function diceFavourOf(dice: DiceSettings): number {
  if (dice.mode !== 'favoured') return 0
  return FAVOUR_LEVELS.find((l) => l.id === dice.level)?.favour ?? 0
}

/**
 * Push the dice setting into the engine.
 *
 * The engine cannot read the store — the store reads the engine — so the value
 * travels the one direction that does not close a cycle. Mounted once at the
 * app root so every roll site inherits it without threading a prop anywhere.
 */
export function useDiceFavourSync(): void {
  const dice = useStore((s) => s.settings.dice)
  useEffect(() => {
    setAmbientFavour(diceFavourOf(dice))
  }, [dice])
}

export function useExtraTables(): Record<string, string[]> {
  const packs = useStore(selectPacks)
  return useMemo(() => tablesToExtra(packs), [packs])
}

export function useHomebrewMonsters(): Monster[] {
  const packs = useStore(selectPacks)
  return useMemo(() => packs.flatMap((p) => p.monsters), [packs])
}

export function useHomebrewSpells() {
  const packs = useStore(selectPacks)
  return useMemo(() => packs.flatMap((p) => p.spells), [packs])
}

export function useHomebrewItems() {
  const packs = useStore(selectPacks)
  return useMemo(() => packs.flatMap((p) => p.items), [packs])
}

export function useStandaloneTables() {
  const packs = useStore(selectPacks)
  return useMemo(() => packs.flatMap((p) => p.tables.filter((t) => t.hook === 'standalone')), [packs])
}

export const selectActive = (s: State): Combatant | undefined => s.combatants[s.turn]

export { passivePerception }
