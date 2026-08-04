/**
 * Types for the shared 5etools converter.
 *
 * The implementation lives in `fivetools-convert.mjs` so the Node export
 * script and the browser can run the exact same code; this file is the typed
 * face TypeScript sees.
 */

import type { Monster, Spell, MagicItem, Provenanced } from './open5e'

/** A rules blurb — conditions, diseases, actions, variant rules, senses. */
export interface RuleEntry extends Provenanced {
  slug: string
  name: string
  kind: string
  desc: string
}

export interface ConvertOptions {
  sourceTitle?: string
  homebrew?: boolean
  docSlug?: string
}

export interface BrewConversion {
  name: string
  author: string
  monsters: Monster[]
  spells: Spell[]
  items: MagicItem[]
  rules: RuleEntry[]
  warnings: string[]
}

/** Collapse 5etools' `{@tag ...}` markup to `RichText`-flavoured plain text. */
export function stripTags(str: string): string

export function entryToText(entry: unknown): string
export function entriesToText(entries: unknown): string

export function slugify(name: string, source?: string): string
export function docSlug(source: string): string

export function convertMonster(mon: Record<string, unknown>, opts?: ConvertOptions): Monster
export function convertSpell(
  sp: Record<string, unknown>,
  opts?: ConvertOptions & { classes?: string[] },
): Spell
export function convertItem(item: Record<string, unknown>, opts?: ConvertOptions): MagicItem
export function convertRule(
  rule: Record<string, unknown>,
  opts?: ConvertOptions & { kind?: string },
): RuleEntry

/** Resolve a `_copy` reference against a pool of sibling entities. */
export function applyCopy<T extends Record<string, unknown>>(entity: T, pool: T[]): T

/** Convert a whole 5etools homebrew document. Throws on non-object input. */
export function convertBrew(json: unknown): BrewConversion
