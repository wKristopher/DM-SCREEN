/** Transient UI state — deliberately not persisted. */

import { create } from 'zustand'
import type { OracleResult } from '../lib/ai/generators'
import type { RollResult } from '../lib/dice'

export type TabKey = 'screen' | 'combat' | 'compendium' | 'oracle' | 'forge' | 'campaign'

interface UiState {
  tab: TabKey
  setTab: (t: TabKey) => void

  /** Latest oracle output, newest first. */
  results: OracleResult[]
  pushResult: (r: OracleResult) => void
  clearResults: () => void

  /** Latest dice rolls, newest first. */
  rolls: RollResult[]
  pushRoll: (r: RollResult) => void
  clearRolls: () => void

  /** Compendium deep-link, set by the command bar. */
  lookup: { query: string; resource: 'monsters' | 'spells' | 'magicitems' } | null
  setLookup: (l: UiState['lookup']) => void

  toast: string | null
  setToast: (t: string | null) => void
}

export const useUi = create<UiState>((set) => ({
  tab: 'screen',
  setTab: (tab) => set({ tab }),

  results: [],
  pushResult: (r) => set((s) => ({ results: [r, ...s.results].slice(0, 40) })),
  clearResults: () => set({ results: [] }),

  rolls: [],
  pushRoll: (r) => set((s) => ({ rolls: [r, ...s.rolls].slice(0, 60) })),
  clearRolls: () => set({ rolls: [] }),

  lookup: null,
  setLookup: (lookup) => set({ lookup }),

  toast: null,
  setToast: (toast) => set({ toast }),
}))
