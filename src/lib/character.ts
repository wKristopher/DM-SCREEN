/**
 * The DM's copy of a player character.
 *
 * Not a character sheet — the player has one of those. This is the half a DM
 * actually reaches for mid-session: what they can see, what they resist, what
 * they roll, and the numbers you set a DC against without asking.
 *
 * Everything that can be computed is computed. A roster where passive
 * Perception is typed by hand is a roster that is quietly wrong two levels
 * later, and the DM who trusted it never finds out. Type the ability scores and
 * tick the proficiencies once; the eighteen numbers that follow keep themselves
 * honest.
 */

import { abilityMod } from './dice'
import { SKILL_ABILITY } from './srd'

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export const ABILITIES: Array<{ key: AbilityKey; label: string; long: string }> = [
  { key: 'str', label: 'STR', long: 'Strength' },
  { key: 'dex', label: 'DEX', long: 'Dexterity' },
  { key: 'con', label: 'CON', long: 'Constitution' },
  { key: 'int', label: 'INT', long: 'Intelligence' },
  { key: 'wis', label: 'WIS', long: 'Wisdom' },
  { key: 'cha', label: 'CHA', long: 'Charisma' },
]

/** SKILL_ABILITY keys its abilities as 'DEX'; the sheet stores them as 'dex'. */
const ABILITY_OF_SKILL: Record<string, AbilityKey> = Object.fromEntries(
  Object.entries(SKILL_ABILITY).map(([skill, ab]) => [skill, ab.toLowerCase() as AbilityKey]),
)

export const SKILLS = Object.keys(SKILL_ABILITY).sort((a, b) => a.localeCompare(b, 'en'))

/** The three a DM reads off the roster without ever asking for a roll. */
export const PASSIVE_SKILLS = ['Perception', 'Investigation', 'Insight'] as const
export type PassiveSkill = (typeof PASSIVE_SKILLS)[number]

export interface Attack {
  id: string
  name: string
  /** To-hit bonus, as typed: the sheet does not know the character's build. */
  bonus: string
  damage: string
  notes: string
}

export interface CharacterSheet {
  race: string
  speed: number
  abilities: Record<AbilityKey, number>
  saveProfs: AbilityKey[]
  skillProfs: string[]
  /** Proficiency counted twice. */
  expertise: string[]
  senses: string
  languages: string
  defenses: string
  /** Which ability casts, or '' for a character who does not. */
  spellAbility: AbilityKey | ''
  attacks: Attack[]
  /**
   * Passives entered by hand.
   *
   * Only ever set by the migration from the old roster, which stored the three
   * numbers directly and had no ability scores to recompute them from. Throwing
   * them away would silently replace a real 15 with a derived 10.
   */
  passiveOverrides: Partial<Record<PassiveSkill, number>>
}

export function blankSheet(): CharacterSheet {
  return {
    race: '',
    speed: 30,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProfs: [],
    skillProfs: [],
    expertise: [],
    senses: '',
    languages: '',
    defenses: '',
    spellAbility: '',
    attacks: [],
    passiveOverrides: {},
  }
}

/* ------------------------------------------------------------------ derived */

/** 5e's table is a formula: +2 at 1st, one more every four levels. */
export function proficiencyBonus(level: number): number {
  const l = Math.min(20, Math.max(1, Math.floor(level) || 1))
  return 2 + Math.floor((l - 1) / 4)
}

export interface Derivable extends CharacterSheet {
  level: number
}

export function modOf(sheet: CharacterSheet, ability: AbilityKey): number {
  return abilityMod(sheet.abilities[ability] ?? 10)
}

export function saveMod(c: Derivable, ability: AbilityKey): number {
  return modOf(c, ability) + (c.saveProfs.includes(ability) ? proficiencyBonus(c.level) : 0)
}

export function skillMod(c: Derivable, skill: string): number {
  const ability = ABILITY_OF_SKILL[skill]
  if (!ability) return 0
  const prof = proficiencyBonus(c.level)
  const times = c.expertise.includes(skill) ? 2 : c.skillProfs.includes(skill) ? 1 : 0
  return modOf(c, ability) + prof * times
}

/**
 * Passive score: 10 + the skill's modifier.
 *
 * A hand-entered value wins, because the only ones that exist came from a
 * roster that predates ability scores and are the DM's own numbers.
 */
export function passiveOf(c: Derivable, skill: PassiveSkill): number {
  const manual = c.passiveOverrides?.[skill]
  return typeof manual === 'number' ? manual : 10 + skillMod(c, skill)
}

/** True when the number on screen was typed rather than worked out. */
export function isPassiveManual(c: Derivable, skill: PassiveSkill): boolean {
  return typeof c.passiveOverrides?.[skill] === 'number'
}

export function initiativeMod(c: Derivable): number {
  return modOf(c, 'dex')
}

export function spellSaveDc(c: Derivable): number | null {
  if (!c.spellAbility) return null
  return 8 + proficiencyBonus(c.level) + modOf(c, c.spellAbility)
}

export function spellAttackBonus(c: Derivable): number | null {
  if (!c.spellAbility) return null
  return proficiencyBonus(c.level) + modOf(c, c.spellAbility)
}

/** Skills worth showing: the ones the character is actually good at. */
export function trainedSkills(c: Derivable): Array<{ skill: string; mod: number; expert: boolean }> {
  return [...new Set([...c.skillProfs, ...c.expertise])]
    .filter((s) => ABILITY_OF_SKILL[s])
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((skill) => ({ skill, mod: skillMod(c, skill), expert: c.expertise.includes(skill) }))
}

export function blankAttack(): Attack {
  return { id: Math.random().toString(36).slice(2, 9), name: '', bonus: '', damage: '', notes: '' }
}

/**
 * Fill in a sheet that predates these fields, or arrived from a backup.
 *
 * Tolerant on purpose: a roster written by an older version of the app should
 * open, not error, and the fields it never had should default rather than
 * appear as undefined halfway through a render.
 */
export function normaliseSheet(raw: Partial<CharacterSheet> | undefined): CharacterSheet {
  const base = blankSheet()
  if (!raw) return base
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    ...base,
    ...raw,
    abilities: { ...base.abilities, ...(raw.abilities ?? {}) },
    saveProfs: list(raw.saveProfs).filter((k): k is AbilityKey => ABILITIES.some((a) => a.key === k)),
    skillProfs: list(raw.skillProfs),
    expertise: list(raw.expertise),
    attacks: Array.isArray(raw.attacks) ? raw.attacks.filter((a) => a && typeof a === 'object') : [],
    passiveOverrides: raw.passiveOverrides && typeof raw.passiveOverrides === 'object' ? raw.passiveOverrides : {},
  }
}
