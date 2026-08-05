/**
 * Dice expression engine.
 *
 * Supports the notation DMs actually type at the table:
 *   4d6kh3        keep highest 3
 *   2d20kl1       keep lowest 1 (disadvantage)
 *   8d6!          exploding dice
 *   4d6r1         reroll 1s once
 *   4d6ro1        reroll 1s until they are not 1s
 *   2d8+1d6+3     mixed terms
 *   (1d8+3)*2     grouping and multipliers, for crits
 *   d%            percentile
 *
 * Returns both a total and the individual faces, so the UI can show its work.
 */

export interface DieRoll {
  /** Number of faces on the die. */
  faces: number
  /** Every value produced, including ones later discarded. */
  values: number[]
  /** Indices into `values` that were dropped by a keep/drop modifier. */
  dropped: number[]
  /** Indices into `values` that came from a reroll or an explosion. */
  rerolled: number[]
  notation: string
}

export interface RollResult {
  expression: string
  total: number
  dice: DieRoll[]
  /** Human-readable working, e.g. "4d6kh3 [5, 4, 3, ~2~] + 2". */
  breakdown: string
  /** True when a lone d20 came up 20, false when it came up 1, otherwise null. */
  crit: boolean | null
  /** The roll leaned high. Recorded so the DM can always tell which ones did. */
  favoured?: boolean
  error?: string
}

const MAX_DICE = 500
const MAX_FACES = 1000
const MAX_EXPLOSIONS = 100

function drawDie(faces: number): number {
  // crypto for dice feels right, and avoids Math.random's clumping on long sessions
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    // Rejection sampling keeps the distribution flat.
    const limit = Math.floor(0xffffffff / faces) * faces
    let x = 0
    do {
      crypto.getRandomValues(buf)
      x = buf[0]
    } while (x >= limit)
    return (x % faces) + 1
  }
  return Math.floor(Math.random() * faces) + 1
}

/** A uniform [0, 1) from the same source as the dice. */
function drawFloat(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] / 0x100000000
  }
  return Math.random()
}

/**
 * How hard the roller leans high. 0 is an honest die.
 *
 * Above 0 it is the probability that a die is drawn twice and the better draw
 * kept — so 1 is permanent advantage on every single die, and the values in
 * between shade smoothly toward it. Expressing it as a probability rather than
 * "roll N take highest" is what makes it tunable: whole-number best-of-N jumps
 * from +0 to +3.3 on a d20 with nothing usable in between.
 */
export type Favour = number

/**
 * Set once from settings and read by every roll that does not override it.
 *
 * Ambient rather than threaded through every call site because the setting is
 * global by nature — a DM who turns fudging on means it for the attack they
 * click in a stat block as much as for the dice tray. The engine is fully
 * synchronous, so there is no window in which one roll can see another's value.
 */
let ambientFavour: Favour = 0

export function setAmbientFavour(f: Favour): void {
  ambientFavour = clampFavour(f)
}

function clampFavour(f: number): Favour {
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0
}

/** Favour in force for the roll currently being evaluated. */
let activeFavour: Favour = 0

function rollDie(faces: number): number {
  const first = drawDie(faces)
  if (activeFavour <= 0) return first
  // A d1 has nothing better to offer; skip the second draw rather than
  // burning entropy on a foregone conclusion.
  if (faces < 2) return first
  if (activeFavour >= 1 || drawFloat() < activeFavour) return Math.max(first, drawDie(faces))
  return first
}

export interface FavourLevel {
  id: 'light' | 'medium' | 'strong'
  label: string
  favour: Favour
  hint: string
}

/**
 * The presets offered in the UI.
 *
 * "Güçlü" is exactly advantage on every die — past that the numbers stop
 * looking like dice, and a table notices a DM who never rolls badly.
 */
export const FAVOUR_LEVELS: FavourLevel[] = [
  { id: 'light', label: 'Hafif', favour: 0.35, hint: 'zar zor fark edilir' },
  { id: 'medium', label: 'Orta', favour: 0.7, hint: 'gözle görülür ama inandırıcı' },
  { id: 'strong', label: 'Güçlü', favour: 1, hint: 'her zarda avantaj' },
]

/** Mean of a d20 at a given favour — 10.5 fair, 13.825 at full advantage. */
export function expectedD20(favour: Favour): number {
  return Math.round((10.5 + clampFavour(favour) * 3.325) * 100) / 100
}

interface Token {
  type: 'num' | 'dice' | 'op' | 'lparen' | 'rparen'
  value: string
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const src = input.toLowerCase().replace(/\s+/g, '')
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch })
      i++
      continue
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    // A dice term or a bare number. Both may start with digits, so look ahead
    // for the 'd' that marks a dice term.
    const diceMatch = /^(\d*)d(\d+|%)((?:(?:kh|kl|dh|dl|ro|r|min|max)\d+|!)*)/.exec(src.slice(i))
    if (diceMatch) {
      tokens.push({ type: 'dice', value: diceMatch[0] })
      i += diceMatch[0].length
      continue
    }

    const numMatch = /^\d+(\.\d+)?/.exec(src.slice(i))
    if (numMatch) {
      tokens.push({ type: 'num', value: numMatch[0] })
      i += numMatch[0].length
      continue
    }

    throw new Error(`Anlaşılmayan karakter: "${ch}"`)
  }

  return tokens
}

function evaluateDiceTerm(notation: string, collected: DieRoll[]): number {
  const m = /^(\d*)d(\d+|%)((?:(?:kh|kl|dh|dl|ro|r|min|max)\d+|!)*)$/.exec(notation)
  if (!m) throw new Error(`Geçersiz zar: ${notation}`)

  const count = m[1] === '' ? 1 : parseInt(m[1], 10)
  const faces = m[2] === '%' ? 100 : parseInt(m[2], 10)
  const modSrc = m[3] ?? ''

  if (count < 1) throw new Error('Zar sayısı en az 1 olmalı')
  if (count > MAX_DICE) throw new Error(`En fazla ${MAX_DICE} zar atılabilir`)
  // d1 is silly but harmless, and rejecting it only surprises people.
  if (faces < 1 || faces > MAX_FACES) throw new Error(`Zar yüzü 1–${MAX_FACES} arasında olmalı`)

  const mods = [...modSrc.matchAll(/(kh|kl|dh|dl|ro|r|min|max)(\d+)|(!)/g)].map((x) =>
    x[3] ? { kind: '!', n: 0 } : { kind: x[1], n: parseInt(x[2], 10) },
  )

  const values: number[] = []
  const rerolled: number[] = []
  const dropped: number[] = []

  for (let k = 0; k < count; k++) values.push(rollDie(faces))

  for (const mod of mods) {
    switch (mod.kind) {
      case 'r': {
        // Reroll once, keeping the new value even if it is also low.
        for (let k = 0; k < values.length; k++) {
          if (values[k] <= mod.n) {
            values[k] = rollDie(faces)
            rerolled.push(k)
          }
        }
        break
      }
      case 'ro': {
        // Reroll until above the threshold.
        for (let k = 0; k < values.length; k++) {
          let guard = 0
          while (values[k] <= mod.n && guard++ < MAX_EXPLOSIONS) {
            values[k] = rollDie(faces)
            if (!rerolled.includes(k)) rerolled.push(k)
          }
        }
        break
      }
      case '!': {
        // Each max-value die adds another die.
        let guard = 0
        for (let k = 0; k < values.length && guard < MAX_EXPLOSIONS; k++) {
          if (values[k] === faces) {
            values.push(rollDie(faces))
            rerolled.push(values.length - 1)
            guard++
          }
        }
        break
      }
      case 'min': {
        for (let k = 0; k < values.length; k++) values[k] = Math.max(values[k], mod.n)
        break
      }
      case 'max': {
        for (let k = 0; k < values.length; k++) values[k] = Math.min(values[k], mod.n)
        break
      }
      case 'kh':
      case 'kl':
      case 'dh':
      case 'dl': {
        const order = values
          .map((v, idx) => ({ v, idx }))
          .filter((x) => !dropped.includes(x.idx))
          .sort((a, b) => a.v - b.v)

        let toDrop: number[] = []
        if (mod.kind === 'kh') toDrop = order.slice(0, Math.max(0, order.length - mod.n)).map((x) => x.idx)
        if (mod.kind === 'kl') toDrop = order.slice(mod.n).map((x) => x.idx)
        if (mod.kind === 'dh') toDrop = order.slice(Math.max(0, order.length - mod.n)).map((x) => x.idx)
        if (mod.kind === 'dl') toDrop = order.slice(0, mod.n).map((x) => x.idx)
        dropped.push(...toDrop)
        break
      }
    }
  }

  collected.push({ faces, values, dropped, rerolled, notation })
  return values.reduce((sum, v, idx) => (dropped.includes(idx) ? sum : sum + v), 0)
}

/** Recursive-descent evaluator over the token stream. */
function parse(tokens: Token[], collected: DieRoll[]): number {
  let pos = 0

  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]

  function expr(): number {
    let left = term()
    while (peek()?.type === 'op' && '+-'.includes(peek().value)) {
      const op = consume().value
      const right = term()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function term(): number {
    let left = factor()
    while (peek()?.type === 'op' && '*/'.includes(peek().value)) {
      const op = consume().value
      const right = factor()
      if (op === '/' && right === 0) throw new Error('Sıfıra bölme')
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function factor(): number {
    const tok = peek()
    if (!tok) throw new Error('İfade beklenmedik şekilde bitti')

    if (tok.type === 'op' && tok.value === '-') {
      consume()
      return -factor()
    }
    if (tok.type === 'op' && tok.value === '+') {
      consume()
      return factor()
    }
    if (tok.type === 'lparen') {
      consume()
      const val = expr()
      if (peek()?.type !== 'rparen') throw new Error('Kapanmayan parantez')
      consume()
      return val
    }
    if (tok.type === 'num') {
      consume()
      return parseFloat(tok.value)
    }
    if (tok.type === 'dice') {
      consume()
      return evaluateDiceTerm(tok.value, collected)
    }
    throw new Error(`Beklenmeyen simge: ${tok.value}`)
  }

  const result = expr()
  if (pos < tokens.length) throw new Error(`Fazladan girdi: ${tokens[pos].value}`)
  return result
}

function describe(dice: DieRoll[], expression: string): string {
  if (dice.length === 0) return expression
  const parts = dice.map((d) => {
    const faces = d.values.map((v, i) => {
      if (d.dropped.includes(i)) return `~~${v}~~`
      if (d.rerolled.includes(i)) return `${v}↻`
      if (v === d.faces) return `**${v}**`
      if (v === 1) return `_${v}_`
      return `${v}`
    })
    return `${d.notation} [${faces.join(', ')}]`
  })
  return parts.join('  ·  ')
}

export interface RollOptions {
  /** Overrides the ambient setting. 0 forces an honest roll. */
  favour?: Favour
}

/** Evaluate a dice expression. Never throws — errors land in `result.error`. */
export function roll(expression: string, opts: RollOptions = {}): RollResult {
  const trimmed = expression.trim()
  if (!trimmed) {
    return { expression, total: 0, dice: [], breakdown: '', crit: null, error: 'Boş ifade' }
  }

  const favour = clampFavour(opts.favour ?? ambientFavour)
  activeFavour = favour

  const collected: DieRoll[] = []
  try {
    const total = parse(tokenize(trimmed), collected)

    // Crit detection only makes sense for a single, undropped d20.
    let crit: boolean | null = null
    const d20s = collected.filter((d) => d.faces === 20)
    if (d20s.length === 1) {
      const kept = d20s[0].values.filter((_, i) => !d20s[0].dropped.includes(i))
      if (kept.length === 1) {
        if (kept[0] === 20) crit = true
        else if (kept[0] === 1) crit = false
      }
    }

    return {
      expression: trimmed,
      total: Math.round(total * 100) / 100,
      dice: collected,
      breakdown: describe(collected, trimmed),
      crit,
      favoured: favour > 0,
    }
  } catch (err) {
    return {
      expression: trimmed,
      total: 0,
      dice: [],
      breakdown: '',
      crit: null,
      error: err instanceof Error ? err.message : 'Zar ifadesi çözümlenemedi',
    }
  } finally {
    // Leaving it set would silently taint the next caller that passes nothing.
    activeFavour = 0
  }
}

/** Roll a d20 with advantage / disadvantage / straight, plus a modifier. */
export function rollD20(
  modifier = 0,
  mode: 'normal' | 'adv' | 'dis' = 'normal',
  opts: RollOptions = {},
): RollResult {
  const base = mode === 'adv' ? '2d20kh1' : mode === 'dis' ? '2d20kl1' : '1d20'
  const mod = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`
  return roll(`${base}${mod}`, opts)
}

/** Average result of an expression, used for "take the average" damage. */
export function averageOf(expression: string): number {
  const m = [...expression.toLowerCase().matchAll(/(\d*)d(\d+)/g)]
  let avg = 0
  for (const match of m) {
    const count = match[1] === '' ? 1 : parseInt(match[1], 10)
    const faces = parseInt(match[2], 10)
    avg += (count * (faces + 1)) / 2
  }
  const flat = [...expression.matchAll(/(?:^|[+\-])\s*(\d+)(?!\s*d)/g)]
  for (const f of flat) {
    const raw = f[0].replace(/\s/g, '')
    avg += raw.startsWith('-') ? -parseInt(f[1], 10) : parseInt(f[1], 10)
  }
  return Math.floor(avg)
}

/** Format a modifier the way stat blocks do: +3 / -1 / +0. */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** Ability score to modifier. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}
