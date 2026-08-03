/**
 * Procedural generators — the substance of the local oracle.
 *
 * Every generator returns an `OracleResult` so the UI can render any of them
 * with one component. Custom (homebrew) tables are merged in by the caller,
 * which is why each generator takes an optional `extra` table map.
 */

import * as T from './tables'
import { roll } from '../dice'

export interface OracleField {
  label: string
  value: string
  emphasis?: boolean
}

export interface OracleResult {
  kind: string
  title: string
  subtitle?: string
  fields: OracleField[]
  /** Free text, rendered as a readable paragraph. */
  prose?: string
  accent?: 'accent' | 'sage' | 'rose' | 'violet' | 'azure'
}

/** Custom d-tables supplied by the user, keyed by table name. */
export type ExtraTables = Record<string, string[]>

export function pick<T2>(arr: readonly T2[]): T2 {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickMany<T2>(arr: readonly T2[], n: number): T2[] {
  const pool = [...arr]
  const out: T2[] = []
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out
}

/** Merge a built-in table with any user table registered under the same key. */
function table(builtin: readonly string[], extra: ExtraTables | undefined, key: string): readonly string[] {
  const custom = extra?.[key]
  return custom && custom.length ? [...builtin, ...custom] : builtin
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/* ------------------------------------------------------------------ names */

export function generateName(bank?: string, gender?: 'male' | 'female'): string {
  const bankKey = bank && T.NAME_BANKS[bank] ? bank : pick(Object.keys(T.NAME_BANKS))
  const b = T.NAME_BANKS[bankKey]
  const g = gender ?? (Math.random() < 0.5 ? 'male' : 'female')
  return `${pick(b[g])} ${pick(b.surname)}`
}

export const NAME_BANK_KEYS = Object.keys(T.NAME_BANKS)

/* ------------------------------------------------------------------ NPC */

export function generateNpc(opts: { bank?: string; role?: string; extra?: ExtraTables } = {}): OracleResult {
  const bank = opts.bank && T.NAME_BANKS[opts.bank] ? opts.bank : pick(NAME_BANK_KEYS)
  const gender = Math.random() < 0.5 ? 'male' : 'female'
  const name = generateName(bank, gender)
  const role = opts.role ?? pick(table(T.NPC_ROLE, opts.extra, 'npc-role'))

  return {
    kind: 'npc',
    accent: 'violet',
    title: name,
    subtitle: `${bank} · ${role}`,
    fields: [
      { label: 'Görünüş', value: pick(table(T.NPC_APPEARANCE, opts.extra, 'npc-appearance')), emphasis: true },
      { label: 'Tavır', value: pick(table(T.NPC_QUIRK, opts.extra, 'npc-quirk')), emphasis: true },
      { label: 'Ses', value: pick(table(T.NPC_VOICE, opts.extra, 'npc-voice')) },
      { label: 'İstediği', value: pick(table(T.NPC_MOTIVATION, opts.extra, 'npc-motivation')) },
      { label: 'Sırrı', value: pick(table(T.NPC_SECRET, opts.extra, 'npc-secret')) },
      { label: 'Tutum', value: pick(['Hostile (DC 20)', 'Indifferent (DC 15)', 'Friendly (DC 10)']) },
    ],
  }
}

/* ------------------------------------------------------------------ tavern */

export function generateTavern(extra?: ExtraTables): OracleResult {
  const name = `${pick(table(T.TAVERN_ADJ, extra, 'tavern-adj'))} ${pick(table(T.TAVERN_NOUN, extra, 'tavern-noun'))}`
  const keeper = generateNpc({ role: 'hancı', extra })

  return {
    kind: 'tavern',
    accent: 'accent',
    title: name,
    subtitle: 'Meyhane',
    fields: [
      { label: 'İşletmeci', value: `${keeper.title} — ${keeper.fields[1].value}`, emphasis: true },
      { label: 'Öne çıkan', value: pick(table(T.TAVERN_FEATURE, extra, 'tavern-feature')), emphasis: true },
      { label: 'İçki', value: pick(table(T.TAVERN_DRINK, extra, 'tavern-drink')) },
      { label: 'Koku', value: pick(table(T.SMELL, extra, 'smell')) },
      { label: 'Kalabalık', value: pick(['Tıklım tıklım', 'Yarı dolu, sakin', 'Neredeyse boş', 'Sadece müdavimler', 'Bir grup asker masaları doldurmuş']) },
      { label: 'Dedikodu', value: pick(table(T.RUMOR, extra, 'rumor')) },
      { label: 'Oda ücreti', value: pick(['3 sp (ucuz)', '5 sp (konforlu)', '8 sp', '2 gp (lüks)']) },
    ],
  }
}

/* ------------------------------------------------------------------ hooks */

export function generatePlotHook(extra?: ExtraTables): OracleResult {
  const who = pick(table(T.PLOT_HOOK_WHO, extra, 'hook-who'))
  const wants = pick(table(T.PLOT_HOOK_WANTS, extra, 'hook-wants'))
  const twist = pick(table(T.PLOT_HOOK_TWIST, extra, 'hook-twist'))

  return {
    kind: 'hook',
    accent: 'rose',
    title: 'Görev Kancası',
    fields: [
      { label: 'Kim', value: who },
      { label: 'Ne istiyor', value: wants },
      { label: 'Ama', value: twist, emphasis: true },
      { label: 'Ödül', value: pick(['50 gp ve bir iyilik', '200 gp', 'bir sihirli eşya (uncommon)', 'bir eve tapu', 'bilgi — ve sadece bilgi', 'lonca üyeliği', 'bir borcun silinmesi']) },
      { label: 'Süre', value: pick(['bu gece', '3 gün', 'bir hafta', 'sonraki dolunaya kadar', 'acil — şu an']) },
    ],
    prose: `${who.charAt(0).toLocaleUpperCase('tr')}${who.slice(1)} size yaklaşıp ${wants} istiyor — ${twist}.`,
  }
}

export function generateRumor(extra?: ExtraTables): OracleResult {
  const rumors = pickMany(table(T.RUMOR, extra, 'rumor'), 3)
  return {
    kind: 'rumor',
    accent: 'azure',
    title: 'Söylentiler',
    subtitle: 'Biri doğru, biri çarpıtılmış, biri tamamen yanlış',
    fields: [
      { label: 'Doğru', value: rumors[0], emphasis: true },
      { label: 'Çarpıtılmış', value: rumors[1] },
      { label: 'Yalan', value: rumors[2] },
    ],
  }
}

/* ------------------------------------------------------------------ places */

export function generateRoom(extra?: ExtraTables): OracleResult {
  return {
    kind: 'room',
    accent: 'sage',
    title: 'Oda Betimlemesi',
    fields: [
      { label: 'Göze çarpan', value: pick(table(T.ROOM_FEATURE, extra, 'room-feature')), emphasis: true },
      { label: 'Koku', value: pick(table(T.SMELL, extra, 'smell')) },
      { label: 'Ses', value: pick(table(T.SOUND, extra, 'sound')) },
      { label: 'Işık', value: pick(['Zifiri karanlık', 'Tek bir meşale, titrek', 'Duvarlarda soluk büyülü ışık', 'Tavandaki çatlaktan gün ışığı', 'Loş, kaynağı belirsiz']) },
      { label: 'Çıkışlar', value: pick(['Tek kapı, geldiğiniz yer', 'İki kapı — biri kilitli', 'Üç geçit, biri çökmüş', 'Bir kapı ve tavanda bir delik', 'Gizli bir geçit (DC 15 Investigation)']) },
    ],
  }
}

export function generateSettlement(extra?: ExtraTables): OracleResult {
  const size = pick([
    { n: 'Köy', pop: `${randInt(40, 300)} kişi`, guards: `${randInt(2, 6)} muhafız` },
    { n: 'Kasaba', pop: `${randInt(600, 4000)} kişi`, guards: `${randInt(10, 40)} muhafız` },
    { n: 'Şehir', pop: `${randInt(6000, 25000)} kişi`, guards: `${randInt(80, 300)} muhafız` },
  ])
  const leader = generateNpc({ role: 'yönetici', extra })

  return {
    kind: 'settlement',
    accent: 'azure',
    title: `${pick(table(T.TAVERN_ADJ, extra, 'tavern-adj'))}${pick(['dere', 'burç', 'geçit', 'köprü', 'liman', 'tepe', 'kuyu', 'han'])}`,
    subtitle: `${size.n} · ${size.pop}`,
    fields: [
      { label: 'Yöneten', value: `${leader.title} — ${leader.fields[3].value}`, emphasis: true },
      { label: 'Sorun', value: pick(table(T.SETTLEMENT_PROBLEM, extra, 'settlement-problem')), emphasis: true },
      { label: 'Tuhaflık', value: pick(table(T.SETTLEMENT_QUIRK, extra, 'settlement-quirk')) },
      { label: 'Savunma', value: size.guards },
      { label: 'Öne çıkan dükkân', value: pick(table(T.SHOP_TYPE, extra, 'shop-type')) },
      { label: 'Meyhane', value: `${pick(T.TAVERN_ADJ)} ${pick(T.TAVERN_NOUN)}` },
      { label: 'Dedikodu', value: pick(table(T.RUMOR, extra, 'rumor')) },
    ],
  }
}

export function generateDungeon(extra?: ExtraTables): OracleResult {
  return {
    kind: 'dungeon',
    accent: 'violet',
    title: 'Zindan Temeli',
    fields: [
      { label: 'Amacı', value: pick(table(T.DUNGEON_PURPOSE, extra, 'dungeon-purpose')), emphasis: true },
      { label: 'Kuran', value: pick(table(T.DUNGEON_BUILDER, extra, 'dungeon-builder')) },
      { label: 'Şimdiki hâli', value: pick(table(T.DUNGEON_STATE, extra, 'dungeon-state')), emphasis: true },
      { label: 'Oda sayısı', value: `${randInt(5, 18)}` },
      { label: 'Şu an burada', value: pick(['bir tarikat töreni hazırlıyor', 'goblinler kamp kurmuş', 'bir undead sürüsü dolanıyor', 'boş — ama taze ayak izleri var', 'bir yaratık yuva yapmış', 'rakip bir maceracı grubu var']) },
      { label: 'Ödül', value: pick(T.TREASURE_ART) },
    ],
  }
}

export function generateTrap(extra?: ExtraTables): OracleResult {
  return {
    kind: 'trap',
    accent: 'rose',
    title: 'Tuzak',
    fields: [
      { label: 'Tetikleyici', value: pick(table(T.TRAP_TRIGGER, extra, 'trap-trigger')), emphasis: true },
      { label: 'Etki', value: pick(table(T.TRAP_EFFECT, extra, 'trap-effect')), emphasis: true },
      { label: 'Fark etme', value: `DC ${randInt(11, 18)} Perception / Investigation` },
      { label: 'Etkisiz kılma', value: `DC ${randInt(12, 19)} Thieves' Tools` },
    ],
  }
}

/* ------------------------------------------------------------------ weather */

export function generateWeather(): OracleResult {
  const w = pick(T.WEATHER)
  return {
    kind: 'weather',
    accent: 'azure',
    title: w.name,
    subtitle: 'Hava Durumu',
    fields: [
      { label: 'Mekanik etki', value: w.effect, emphasis: true },
      { label: 'Rüzgâr', value: pick(['Yok', 'Hafif', 'Kuvvetli', 'Fırtına gücünde']) },
      { label: 'Sıcaklık', value: pick(['Dondurucu', 'Soğuk', 'Serin', 'Ilık', 'Sıcak', 'Kavurucu']) },
    ],
  }
}

/* ------------------------------------------------------------------ loot */

const HOARD_BY_TIER: Record<number, { coins: string; artChance: number; itemChance: number }> = {
  1: { coins: '6d6*100 cp + 3d6*100 sp + 2d6*10 gp', artChance: 0.35, itemChance: 0.3 },
  2: { coins: '2d6*100 gp + 2d6*10 pp', artChance: 0.55, itemChance: 0.5 },
  3: { coins: '4d6*1000 gp + 5d6*100 pp', artChance: 0.75, itemChance: 0.7 },
  4: { coins: '12d6*1000 gp + 8d6*1000 pp', artChance: 0.9, itemChance: 0.9 },
}

export function generateTreasure(cr: number, extra?: ExtraTables): OracleResult {
  const tier = cr <= 4 ? 1 : cr <= 10 ? 2 : cr <= 16 ? 3 : 4
  const spec = HOARD_BY_TIER[tier]
  const coinRoll = roll(spec.coins)

  const fields: OracleField[] = [
    { label: 'Sikke', value: `${coinRoll.total.toLocaleString('tr-TR')} değerinde karışık sikke`, emphasis: true },
  ]

  if (Math.random() < spec.artChance) {
    const items = pickMany(table(T.TREASURE_ART, extra, 'treasure-art'), tier >= 3 ? 3 : 1)
    fields.push({ label: 'Sanat eseri', value: items.join(' · ') })
  }
  if (Math.random() < spec.itemChance) {
    const rarity = tier === 1 ? 'common/uncommon' : tier === 2 ? 'uncommon/rare' : tier === 3 ? 'rare/very rare' : 'very rare/legendary'
    fields.push({ label: 'Sihirli eşya', value: `${randInt(1, tier)} adet — nadirlik: ${rarity}`, emphasis: true })
  }
  fields.push({ label: 'Tuhaf şey', value: pick(table(T.TREASURE_ODDITY, extra, 'treasure-oddity')) })

  return {
    kind: 'treasure',
    accent: 'accent',
    title: `Hazine — CR ${cr} (Tier ${tier})`,
    subtitle: spec.coins,
    fields,
  }
}

/* ------------------------------------------------------------------ encounter */

export interface EncounterSeed {
  environment: T.Environment
  partyLevel: number
  partySize: number
  /** Creature types to prefer when the caller queries the compendium. */
  preferredTypes: string[]
  crTarget: { min: number; max: number }
  complication: string
  distance: string
  disposition: string
}

/**
 * Produce the *shape* of an encounter. The actual monsters get pulled from the
 * compendium by the caller, because that needs the network/cache and this
 * module stays synchronous and pure.
 */
export function seedEncounter(environment: T.Environment, partyLevel: number, partySize: number): EncounterSeed {
  const preferred = T.ENV_MONSTER_TYPES[environment]
  // Rough guidance: a "fair" solo monster sits near the party level.
  const crMax = Math.max(1, Math.round(partyLevel * (partySize >= 5 ? 1.2 : 1)))
  return {
    environment,
    partyLevel,
    partySize,
    preferredTypes: pickMany(preferred, 2),
    crTarget: { min: Math.max(0, Math.floor(partyLevel / 4)), max: crMax },
    complication: pick(T.ENCOUNTER_COMPLICATION),
    distance: pick(['Sizi 60 ft öteden gördüler', 'Burun buruna geldiniz (10 ft)', 'Henüz fark etmediler — 120 ft', 'Pusu kurmuşlar', 'Onlar sizi görmeden siz gördünüz']),
    disposition: pick(['Saldırgan, hemen atılır', 'Temkinli, önce gözler', 'Aç ve çaresiz', 'Pazarlık etmeye açık', 'Korkmuş, kaçmak üzere', 'Bölgesini savunuyor']),
  }
}

export function encounterResult(seed: EncounterSeed): OracleResult {
  return {
    kind: 'encounter',
    accent: 'rose',
    title: `Karşılaşma — ${seed.environment}`,
    subtitle: `Seviye ${seed.partyLevel} · ${seed.partySize} kişilik grup`,
    fields: [
      { label: 'Yaratık türü', value: seed.preferredTypes.join(' veya '), emphasis: true },
      { label: 'Hedef CR', value: `${seed.crTarget.min} – ${seed.crTarget.max}` },
      { label: 'Mesafe', value: seed.distance },
      { label: 'Tavır', value: seed.disposition },
      { label: 'Komplikasyon', value: seed.complication, emphasis: true },
    ],
  }
}

/* ------------------------------------------------------------------ misc */

export function generateShop(extra?: ExtraTables): OracleResult {
  const type = pick(table(T.SHOP_TYPE, extra, 'shop-type'))
  const owner = generateNpc({ role: type, extra })
  return {
    kind: 'shop',
    accent: 'sage',
    title: `${pick(T.TAVERN_ADJ)} ${pick(T.TAVERN_NOUN)}`,
    subtitle: type,
    fields: [
      { label: 'Sahibi', value: `${owner.title} — ${owner.fields[1].value}`, emphasis: true },
      { label: 'Fiyatlar', value: pick(['%20 ucuz — mal şaibeli', 'Standart', '%50 pahalı — ama kalite gerçek', 'Pazarlığa açık', 'Sadece takas']) },
      { label: 'Stokta olmayan', value: pick(['ip', 'meşale', 'iyileştirme iksiri', 'demir', 'ok', 'kâğıt']) },
      { label: 'Sıra dışı bir mal', value: pick(table(T.TREASURE_ODDITY, extra, 'treasure-oddity')), emphasis: true },
      { label: 'Sahibinin derdi', value: pick(table(T.NPC_MOTIVATION, extra, 'npc-motivation')) },
    ],
  }
}

/** Yes/no oracle with a fate-chart style shading, for solo or improv play. */
export function askOracle(question: string): OracleResult {
  const r = roll('1d20')
  const v = r.total
  const answer =
    v === 20 ? 'Evet, ve dahası…' :
    v >= 15 ? 'Evet' :
    v >= 11 ? 'Evet, ama…' :
    v >= 7 ? 'Hayır, ama…' :
    v >= 2 ? 'Hayır' :
    'Hayır, ve daha kötüsü…'

  return {
    kind: 'oracle',
    accent: 'violet',
    title: answer,
    subtitle: question || 'Kâhine soruldu',
    fields: [
      { label: 'Zar', value: `d20 → ${v}` },
      ...(v === 20 || v === 1 ? [{ label: 'Kıvılcım', value: pick(T.ENCOUNTER_COMPLICATION), emphasis: true }] : []),
    ],
  }
}

/** Roll on an arbitrary user-defined table. */
export function rollCustomTable(name: string, rows: string[]): OracleResult {
  const idx = Math.floor(Math.random() * rows.length)
  return {
    kind: 'custom-table',
    accent: 'accent',
    title: rows[idx],
    subtitle: `${name} · d${rows.length} → ${idx + 1}`,
    fields: [],
  }
}
