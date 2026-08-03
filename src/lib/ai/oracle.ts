/**
 * Intent router for the command bar.
 *
 * A DM types one thing during play — whatever is fastest. This maps that to an
 * action: roll it, generate it, or look it up. The matching is intentionally
 * keyword+regex based rather than a model: it must be instant and predictable,
 * and a wrong guess mid-combat is worse than no guess.
 *
 * Turkish and English keywords are both accepted, since tables mix them.
 */

import type { Environment } from './tables'
import { ENVIRONMENTS } from './tables'

export type Intent =
  | { type: 'dice'; expression: string }
  | { type: 'generate'; what: GeneratorKey; args?: Record<string, string | number> }
  | { type: 'lookup'; resource: 'monsters' | 'spells' | 'magicitems' | 'conditions' | 'rules'; query: string }
  | { type: 'oracle'; question: string }
  | { type: 'custom-table'; name: string }
  | { type: 'unknown'; query: string }

export type GeneratorKey =
  | 'npc' | 'tavern' | 'hook' | 'rumor' | 'room' | 'settlement'
  | 'dungeon' | 'trap' | 'weather' | 'treasure' | 'encounter' | 'shop' | 'name'

interface Rule {
  key: GeneratorKey
  words: string[]
}

const GENERATOR_RULES: Rule[] = [
  { key: 'npc', words: ['npc', 'karakter', 'kişi', 'adam', 'kimse', 'biri'] },
  { key: 'tavern', words: ['tavern', 'meyhane', 'han', 'inn', 'bar'] },
  { key: 'hook', words: ['hook', 'kanca', 'görev', 'quest', 'macera'] },
  { key: 'rumor', words: ['rumor', 'dedikodu', 'söylenti', 'söylentiler'] },
  { key: 'room', words: ['room', 'oda', 'mekan', 'mekân', 'betim', 'describe'] },
  { key: 'settlement', words: ['settlement', 'kasaba', 'köy', 'şehir', 'town', 'village', 'city'] },
  { key: 'dungeon', words: ['dungeon', 'zindan', 'mağara'] },
  { key: 'trap', words: ['trap', 'tuzak'] },
  { key: 'weather', words: ['weather', 'hava'] },
  { key: 'treasure', words: ['treasure', 'hazine', 'loot', 'ganimet', 'ödül'] },
  { key: 'encounter', words: ['encounter', 'karşılaşma', 'çarpışma', 'savaş'] },
  { key: 'shop', words: ['shop', 'dükkan', 'dükkân', 'satıcı', 'store'] },
  { key: 'name', words: ['name', 'isim', 'ad'] },
]

const LOOKUP_RULES: Array<{ resource: 'monsters' | 'spells' | 'magicitems' | 'conditions' | 'rules'; words: string[] }> = [
  { resource: 'monsters', words: ['monster', 'yaratık', 'canavar', 'statblock', 'stat'] },
  { resource: 'spells', words: ['spell', 'büyü', 'sihir'] },
  { resource: 'magicitems', words: ['item', 'eşya', 'magic item', 'sihirli eşya'] },
  { resource: 'conditions', words: ['condition', 'durum', 'etki'] },
  { resource: 'rules', words: ['rule', 'kural', 'nasıl'] },
]

const DICE_RE = /^\s*(?:\/?r(?:oll)?\s+)?((?:\d*d\d+|\d+)(?:\s*[+\-*/]\s*(?:\d*d\d+|\d+|\((?:[^()]*)\)))*(?:kh\d+|kl\d+|dh\d+|dl\d+|ro\d+|r\d+|!|min\d+|max\d+)*.*)$/i

/** Anything that is unambiguously a dice expression. */
function looksLikeDice(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/^\/?r(?:oll)?\s+/, '')
  if (!/\d*d\d+/.test(t)) return false
  // Reject prose that merely contains "d20" inside a longer sentence.
  return /^[\d\s+\-*/()dkhlro!minax%]+$/i.test(t)
}

const YESNO_PREFIXES = ['mi ', 'mı ', 'mu ', 'mü ', 'acaba', 'olur mu', 'var mı', 'is ', 'does ', 'will ', 'should ', 'can ']

export function parseIntent(input: string, customTableNames: string[] = []): Intent {
  const raw = input.trim()
  if (!raw) return { type: 'unknown', query: '' }
  const lower = raw.toLocaleLowerCase('tr')

  // 1. Dice — highest priority, it's the most common thing typed.
  if (looksLikeDice(raw)) {
    const m = DICE_RE.exec(raw)
    return { type: 'dice', expression: (m?.[1] ?? raw).replace(/^\/?r(?:oll)?\s+/i, '').trim() }
  }
  if (/^(adv|advantage|avantaj)\b/i.test(lower)) {
    const mod = /([+-]\s*\d+)/.exec(raw)
    return { type: 'dice', expression: `2d20kh1${mod ? mod[1].replace(/\s/g, '') : ''}` }
  }
  if (/^(dis|disadvantage|dezavantaj)\b/i.test(lower)) {
    const mod = /([+-]\s*\d+)/.exec(raw)
    return { type: 'dice', expression: `2d20kl1${mod ? mod[1].replace(/\s/g, '') : ''}` }
  }

  // 2. A user's own table, matched by name.
  const tableHit = customTableNames.find((n) => lower.includes(n.toLocaleLowerCase('tr')))
  if (tableHit) return { type: 'custom-table', name: tableHit }

  // 3. A question is a question, whatever nouns it happens to contain.
  //    "Tuzak var mı?" wants a yes/no, not a freshly generated trap — so this
  //    has to beat the keyword rules below, which would match on "tuzak".
  if (raw.endsWith('?') || YESNO_PREFIXES.some((p) => lower.startsWith(p) || lower.includes(` ${p}`))) {
    return { type: 'oracle', question: raw }
  }

  // 4. Explicit lookup verbs: "goblin statblock", "büyü fireball"
  for (const rule of LOOKUP_RULES) {
    for (const word of rule.words) {
      if (lower.includes(word)) {
        const query = lower.replace(word, '').replace(/\b(ara|bul|göster|search|find|show|ver|at)\b/g, '').trim()
        // "npc" collides with nothing here, but "durum"/"kural" alone means the panel.
        if (query) return { type: 'lookup', resource: rule.resource, query }
        return { type: 'lookup', resource: rule.resource, query: '' }
      }
    }
  }

  // 5. Generators.
  for (const rule of GENERATOR_RULES) {
    if (rule.words.some((w) => new RegExp(`(^|\\s)${w}`, 'i').test(lower))) {
      const args: Record<string, string | number> = {}

      const env = ENVIRONMENTS.find((e) => lower.includes(e))
      if (env) args.environment = env as Environment

      const lvl = /(?:seviye|level|lvl)\s*(\d+)/i.exec(lower)
      if (lvl) args.partyLevel = parseInt(lvl[1], 10)

      const cr = /cr\s*(\d+)/i.exec(lower)
      if (cr) args.cr = parseInt(cr[1], 10)

      const size = /(\d+)\s*(?:kişi|kisi|character|pc)/i.exec(lower)
      if (size) args.partySize = parseInt(size[1], 10)

      return { type: 'generate', what: rule.key, args }
    }
  }

  // 6. Fall back to a monster search — by far the most likely bare noun.
  return { type: 'lookup', resource: 'monsters', query: raw }
}

/** Suggestions shown under the command bar before the DM types anything. */
export const COMMAND_HINTS: Array<{ label: string; input: string; hint: string }> = [
  { label: 'Zar', input: '4d6kh3', hint: 'ifade yaz, atsın' },
  { label: 'Avantaj', input: 'adv +5', hint: '2d20kh1+5' },
  { label: 'NPC', input: 'npc', hint: 'anında karakter' },
  { label: 'Meyhane', input: 'meyhane', hint: 'isim, sahip, dedikodu' },
  { label: 'Kanca', input: 'görev kancası', hint: 'kim, ne, ama…' },
  { label: 'Karşılaşma', input: 'karşılaşma orman seviye 5', hint: 'ortam + seviye' },
  { label: 'Hazine', input: 'hazine cr 8', hint: 'CR’a göre ganimet' },
  { label: 'Oda', input: 'oda betimle', hint: 'koku, ses, ışık' },
  { label: 'Yaratık', input: 'goblin', hint: 'derlemede ara' },
  { label: 'Kâhin', input: 'Tuzak var mı?', hint: 'evet/hayır sorusu' },
]
