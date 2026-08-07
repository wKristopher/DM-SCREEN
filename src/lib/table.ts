/**
 * What the table is allowed to see.
 *
 * The player screen is a second window showing the same combat, so this decides
 * what crosses over. It is deliberately a pure function of the tracker's state
 * rather than a set of checks scattered through the view: a number that leaks
 * onto a screen the players are looking at cannot be un-seen, so the rule wants
 * to live in one place that can be tested.
 *
 * Two things are withheld. Anything the DM marked secret does not appear at
 * all — not greyed out, not as a blank row, not as a gap in the order, since a
 * gap is itself information. And monsters' hit points become a word rather than
 * a number: the table should feel the ogre weakening without doing arithmetic
 * on it.
 */

export interface TableCombatant {
  id: string
  name: string
  initiative: number
  hp: number
  maxHp: number
  tempHp: number
  isPc: boolean
  secret: boolean
  conditions: Array<{ name: string; rounds: number | null }>
  concentration: string | null
}

export type Wound = 'healthy' | 'grazed' | 'bloodied' | 'battered' | 'down'

export const WOUND_LABELS: Record<Wound, string> = {
  healthy: 'sağlam',
  grazed: 'sıyrık almış',
  bloodied: 'kanıyor',
  battered: 'ayakta zor duruyor',
  down: 'düştü',
}

/**
 * Describe a monster's health without giving away the number.
 *
 * "Bloodied" is the one term every 5e table already knows, and it means at or
 * below half — so the boundary is `<= 0.5`, not `< 0.5`. The others sit either
 * side of it so the description keeps moving through a long fight instead of
 * resting on one word for six rounds.
 *
 * "Healthy" means untouched. A creature at nine tenths has visibly taken a hit,
 * and calling that unharmed tells the table something that is not true.
 */
export function woundOf(hp: number, maxHp: number): Wound {
  if (hp <= 0) return 'down'
  if (maxHp <= 0) return 'healthy'
  const frac = hp / maxHp
  if (frac >= 1) return 'healthy'
  if (frac > 0.5) return 'grazed'
  if (frac > 0.25) return 'bloodied'
  return 'battered'
}

export interface TableRow {
  id: string
  name: string
  initiative: number
  isPc: boolean
  /** PCs only — players track their own numbers anyway. */
  hp: number | null
  maxHp: number | null
  tempHp: number
  /** Monsters only. */
  wound: Wound | null
  woundLabel: string
  conditions: string[]
  concentrating: boolean
  down: boolean
}

/** The order as the table sees it, secrets removed. */
export function tableRows(combatants: TableCombatant[]): TableRow[] {
  return combatants
    .filter((c) => !c.secret)
    .map((c) => {
      const wound = c.isPc ? null : woundOf(c.hp, c.maxHp)
      return {
        id: c.id,
        name: c.name,
        initiative: c.initiative,
        isPc: c.isPc,
        hp: c.isPc ? c.hp : null,
        maxHp: c.isPc ? c.maxHp : null,
        tempHp: c.isPc ? c.tempHp : 0,
        wound,
        woundLabel: wound ? WOUND_LABELS[wound] : '',
        conditions: c.conditions.map((x) => x.name),
        concentrating: Boolean(c.concentration),
        down: c.hp <= 0,
      }
    })
}

/**
 * Which visible row is taking its turn.
 *
 * The tracker's turn index counts secret combatants; the table's list does not.
 * Translating between the two is the whole reason this returns an id rather
 * than a number — and when it is a secret creature's turn the answer is
 * nobody, which is correct: the table should not learn that something it
 * cannot see just acted.
 */
export function activeRowId(combatants: TableCombatant[], turn: number): string | null {
  const active = combatants[turn]
  if (!active || active.secret) return null
  return active.id
}
