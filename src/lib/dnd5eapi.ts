/**
 * dnd5eapi.co adapter.
 *
 * Measured at ~270ms against Open5e's ~680ms, so this is the source that makes
 * search feel instant. It only carries SRD 5.1 (~330 monsters, ~320 spells),
 * which is why it races alongside Open5e rather than replacing it.
 *
 * Its schema differs from Open5e's in almost every nested field, so everything
 * here is normalisation into the shapes the rest of the app already speaks.
 */

import type { Monster, Spell, NamedEntry } from './open5e'

export const DND5EAPI_ROOT = 'https://www.dnd5eapi.co/api/2014'

/* ------------------------------------------------------------------ raw shapes */

interface RawRef {
  index: string
  name: string
  url: string
}

interface RawProficiency {
  value: number
  proficiency: RawRef
}

interface RawEntry {
  name: string
  desc: string
  attack_bonus?: number
  damage?: Array<{ damage_dice?: string; damage_type?: RawRef }>
}

interface RawMonster {
  index: string
  name: string
  size: string
  type: string
  subtype?: string | null
  alignment: string
  armor_class: Array<{ type: string; value: number; desc?: string; armor?: RawRef[] }>
  hit_points: number
  hit_dice: string
  hit_points_roll?: string
  speed: Record<string, string | boolean>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  proficiencies: RawProficiency[]
  damage_vulnerabilities: string[]
  damage_resistances: string[]
  damage_immunities: string[]
  condition_immunities: RawRef[]
  senses: Record<string, string | number>
  languages: string
  challenge_rating: number
  proficiency_bonus?: number
  xp?: number
  special_abilities?: RawEntry[]
  actions?: RawEntry[]
  reactions?: RawEntry[]
  legendary_actions?: RawEntry[]
  desc?: string
}

interface RawSpell {
  index: string
  name: string
  desc: string[]
  higher_level?: string[]
  range: string
  components: string[]
  material?: string
  ritual: boolean
  duration: string
  concentration: boolean
  casting_time: string
  level: number
  school: RawRef
  classes?: RawRef[]
}

interface RawList {
  count: number
  results: RawRef[]
}

/* ------------------------------------------------------------------ helpers */

/** "30 ft." → 30 */
function feet(v: string | boolean | undefined): number | boolean {
  if (typeof v !== 'string') return v ?? 0
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

const ABILITY_SAVE: Record<string, keyof Monster> = {
  'saving-throw-str': 'strength_save',
  'saving-throw-dex': 'dexterity_save',
  'saving-throw-con': 'constitution_save',
  'saving-throw-int': 'intelligence_save',
  'saving-throw-wis': 'wisdom_save',
  'saving-throw-cha': 'charisma_save',
}

function entries(raw: RawEntry[] | undefined): NamedEntry[] | null {
  if (!raw?.length) return null
  return raw.map((e) => ({
    name: e.name,
    desc: e.desc,
    attack_bonus: e.attack_bonus,
    damage_dice: e.damage?.[0]?.damage_dice,
  }))
}

/** "darkvision 60 ft., passive Perception 9" from the senses object. */
function sensesToString(senses: Record<string, string | number> | undefined): string {
  if (!senses) return ''
  return Object.entries(senses)
    .map(([k, v]) => (k === 'passive_perception' ? `passive Perception ${v}` : `${k.replace(/_/g, ' ')} ${v}`))
    .join(', ')
}

export function normalizeMonster(raw: RawMonster): Monster {
  const skills: Record<string, number> = {}
  const saves: Partial<Monster> = {}

  for (const p of raw.proficiencies ?? []) {
    const idx = p.proficiency.index
    if (idx.startsWith('skill-')) {
      skills[idx.replace('skill-', '').replace(/-/g, ' ')] = p.value
    } else if (ABILITY_SAVE[idx]) {
      ;(saves as Record<string, number>)[ABILITY_SAVE[idx] as string] = p.value
    }
  }

  const speed: Record<string, number | boolean> = {}
  for (const [k, v] of Object.entries(raw.speed ?? {})) speed[k] = feet(v)

  const ac = raw.armor_class?.[0]

  // The AC note has to be assembled per type: `type: "armor"` means the value
  // comes from worn gear, so the useful text is the gear list, not the word
  // "armor" twice.
  let armorDesc = ac?.desc ?? ''
  if (!armorDesc && ac) {
    if (ac.type === 'armor') armorDesc = (ac.armor ?? []).map((a) => a.name.toLocaleLowerCase('en')).join(', ')
    else if (ac.type === 'dex') armorDesc = ''
    else armorDesc = `${ac.type} armor`
  }

  return {
    slug: raw.index,
    name: raw.name,
    size: raw.size,
    type: raw.type,
    subtype: raw.subtype ?? '',
    alignment: raw.alignment,
    armor_class: ac?.value ?? 10,
    armor_desc: armorDesc,
    hit_points: raw.hit_points,
    hit_dice: raw.hit_points_roll || raw.hit_dice,
    speed,
    strength: raw.strength,
    dexterity: raw.dexterity,
    constitution: raw.constitution,
    intelligence: raw.intelligence,
    wisdom: raw.wisdom,
    charisma: raw.charisma,
    ...saves,
    skills,
    damage_vulnerabilities: (raw.damage_vulnerabilities ?? []).join(', '),
    damage_resistances: (raw.damage_resistances ?? []).join(', '),
    damage_immunities: (raw.damage_immunities ?? []).join(', '),
    condition_immunities: (raw.condition_immunities ?? []).map((c) => c.name).join(', '),
    senses: sensesToString(raw.senses),
    languages: raw.languages,
    challenge_rating: String(raw.challenge_rating),
    cr: raw.challenge_rating,
    special_abilities: entries(raw.special_abilities),
    actions: entries(raw.actions),
    reactions: entries(raw.reactions),
    legendary_actions: entries(raw.legendary_actions),
    desc: raw.desc ?? '',
    // Tagged as the same SRD document Open5e uses, so the merge step can
    // recognise the two as duplicates rather than showing both.
    document__slug: 'wotc-srd',
    document__title: '5e Core Rules',
    source: 'dnd5eapi',
  }
}

const ORDINAL = ['cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level']

export function normalizeSpell(raw: RawSpell): Spell {
  return {
    slug: raw.index,
    name: raw.name,
    desc: (raw.desc ?? []).join('\n\n'),
    higher_level: (raw.higher_level ?? []).join('\n\n'),
    range: raw.range,
    components: (raw.components ?? []).join(', '),
    material: raw.material ?? '',
    ritual: raw.ritual ? 'yes' : 'no',
    duration: raw.duration,
    concentration: raw.concentration ? 'yes' : 'no',
    casting_time: raw.casting_time,
    level: ORDINAL[raw.level] ?? `${raw.level}th-level`,
    level_int: raw.level,
    school: raw.school?.name ?? '',
    dnd_class: (raw.classes ?? []).map((c) => c.name).join(', '),
    document__slug: 'wotc-srd',
    document__title: '5e Core Rules',
    source: 'dnd5eapi',
  }
}

/* ------------------------------------------------------------------ queries */

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Only CORS-safelisted headers, so the browser skips the OPTIONS preflight
  // and this stays a single round trip.
  const res = await fetch(`${DND5EAPI_ROOT}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`dnd5eapi ${res.status}`)
  return (await res.json()) as T
}

/**
 * Name search. The list endpoint returns only name + index, so callers get
 * matches fast and fetch full statblocks lazily.
 */
export async function searchMonsterNames(query: string, signal?: AbortSignal): Promise<RawRef[]> {
  const q = query.trim()
  const data = await get<RawList>(`/monsters${q ? `?name=${encodeURIComponent(q)}` : ''}`, signal)
  return data.results ?? []
}

export async function getMonster(index: string, signal?: AbortSignal): Promise<Monster> {
  return normalizeMonster(await get<RawMonster>(`/monsters/${index}`, signal))
}

export async function searchSpellNames(query: string, signal?: AbortSignal): Promise<RawRef[]> {
  const q = query.trim()
  const data = await get<RawList>(`/spells${q ? `?name=${encodeURIComponent(q)}` : ''}`, signal)
  return data.results ?? []
}

export async function getSpell(index: string, signal?: AbortSignal): Promise<Spell> {
  return normalizeSpell(await get<RawSpell>(`/spells/${index}`, signal))
}

/** Fetch several statblocks at once — used to fill in a page of search hits. */
export async function getMonsters(indexes: string[], signal?: AbortSignal): Promise<Monster[]> {
  const settled = await Promise.allSettled(indexes.map((i) => getMonster(i, signal)))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

export async function getSpells(indexes: string[], signal?: AbortSignal): Promise<Spell[]> {
  const settled = await Promise.allSettled(indexes.map((i) => getSpell(i, signal)))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}
