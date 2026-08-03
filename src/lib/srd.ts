/**
 * Bundled quick-reference tables — the classic "behind the screen" content.
 *
 * These ship with the app rather than coming from the API, because these are
 * exactly the things you need in the half-second before the table gets bored,
 * and they must work with no network at all.
 *
 * Rules text is summarised from the 5e SRD 5.1 (CC-BY-4.0). Game terms are kept
 * in English because that is what is printed on everyone's character sheet.
 */

export interface RefEntry {
  name: string
  desc: string
  tag?: string
}

export interface RefTable {
  id: string
  title: string
  subtitle?: string
  accent: 'accent' | 'sage' | 'rose' | 'violet' | 'azure'
  kind: 'entries' | 'grid'
  entries?: RefEntry[]
  columns?: string[]
  rows?: string[][]
}

export const CONDITIONS: RefEntry[] = [
  {
    name: 'Blinded',
    desc: 'Göremez, gerektiren her kontrolde otomatik başarısız. Ona yapılan saldırılar **advantage**, onun saldırıları **disadvantage**.',
  },
  {
    name: 'Charmed',
    desc: 'Büyüleyene saldıramaz, onu hedef alamaz. Büyüleyen, sosyal etkileşim kontrollerinde **advantage** alır.',
  },
  {
    name: 'Deafened',
    desc: 'Duyamaz, duymayı gerektiren kontrollerde otomatik başarısız.',
  },
  {
    name: 'Exhaustion',
    desc: '**1** ability check disadvantage · **2** hız yarı · **3** saldırı ve save disadvantage · **4** max HP yarı · **5** hız 0 · **6** ölüm. Uzun dinlenme 1 seviye azaltır.',
    tag: '6 seviye',
  },
  {
    name: 'Frightened',
    desc: 'Korku kaynağı görüş alanındayken ability check ve saldırılarda **disadvantage**. Kaynağa doğru isteyerek yaklaşamaz.',
  },
  {
    name: 'Grappled',
    desc: 'Hızı 0, bonus hız alamaz. Yakalayan incapacitated olursa veya araya mesafe girerse biter.',
  },
  {
    name: 'Incapacitated',
    desc: 'Action veya reaction kullanamaz.',
  },
  {
    name: 'Invisible',
    desc: 'Görülemez (özel duyu/büyü hariç). Saklanmak için "heavily obscured" sayılır. Ona saldırılar **disadvantage**, onun saldırıları **advantage**.',
  },
  {
    name: 'Paralyzed',
    desc: 'Incapacitated + hareket edemez, konuşamaz. STR/DEX save otomatik başarısız. Ona saldırılar **advantage**; 5 ft. içinden gelen her isabet **kritik**.',
  },
  {
    name: 'Petrified',
    desc: 'Taşa döner, ağırlık ×10. Incapacitated, zamanı durur. Tüm hasara **resistance**, zehir ve hastalığa bağışık.',
  },
  {
    name: 'Poisoned',
    desc: 'Saldırı ve ability check kontrollerinde **disadvantage**.',
  },
  {
    name: 'Prone',
    desc: 'Sadece sürünebilir (2× hareket). Saldırılarında **disadvantage**. 5 ft. içinden gelen saldırılar **advantage**, uzaktan gelenler **disadvantage**.',
  },
  {
    name: 'Restrained',
    desc: 'Hız 0. Ona saldırılar **advantage**, onun saldırıları **disadvantage**. DEX save **disadvantage**.',
  },
  {
    name: 'Stunned',
    desc: 'Incapacitated + hareket edemez, kekeleyerek konuşur. STR/DEX save otomatik başarısız. Ona saldırılar **advantage**.',
  },
  {
    name: 'Unconscious',
    desc: 'Incapacitated + hareket/konuşma yok, çevreden habersiz, elindekini düşürür, prone olur. STR/DEX save otomatik başarısız. Ona saldırılar **advantage**; 5 ft. içinden her isabet **kritik**.',
  },
]

export const ACTIONS_IN_COMBAT: RefEntry[] = [
  { name: 'Attack', desc: 'Bir silahlı veya silahsız saldırı yap. Extra Attack varsa birden fazla.' },
  { name: 'Cast a Spell', desc: 'Casting time’ı 1 action olan bir büyü yap.' },
  { name: 'Dash', desc: 'Bu tur için ek hareket hızı kadar mesafe kazan.' },
  { name: 'Disengage', desc: 'Hareketin bu tur **opportunity attack** tetiklemez.' },
  { name: 'Dodge', desc: 'Sana yapılan saldırılar **disadvantage**, DEX save’lerin **advantage**. Hızın 0 olursa veya incapacitated olursan biter.' },
  { name: 'Help', desc: 'Bir müttefike bir kontrolde veya 5 ft. içindeki bir hedefe saldırıda **advantage** ver.' },
  { name: 'Hide', desc: 'Dexterity (Stealth) kontrolü yap.' },
  { name: 'Ready', desc: 'Bir tetikleyici ve ona bağlı bir action belirle; reaction ile tetiklendiğinde uygula.' },
  { name: 'Search', desc: 'Bir şey aramaya odaklan: WIS (Perception) veya INT (Investigation).' },
  { name: 'Use an Object', desc: 'Bir nesneyle etkileşim (ikinci etkileşim veya özel kullanım gerektiren).' },
  { name: 'Improvise', desc: 'Listede olmayan bir şey dene — DM karar verir, genelde bir kontrol gerekir.' },
  { name: 'Grapple / Shove', desc: 'Attack action yerine: STR (Athletics) vs. hedefin STR (Athletics) veya DEX (Acrobatics).' },
]

export const REF_TABLES: RefTable[] = [
  {
    id: 'dc',
    title: 'Zorluk Dereceleri',
    subtitle: 'Difficulty Class',
    accent: 'accent',
    kind: 'grid',
    columns: ['Görev', 'DC'],
    rows: [
      ['Çok kolay', '5'],
      ['Kolay', '10'],
      ['Orta', '15'],
      ['Zor', '20'],
      ['Çok zor', '25'],
      ['Neredeyse imkânsız', '30'],
    ],
  },
  {
    id: 'cover',
    title: 'Siper',
    subtitle: 'Cover',
    accent: 'sage',
    kind: 'grid',
    columns: ['Derece', 'Etki'],
    rows: [
      ['Yarım (Half)', '+2 AC, +2 DEX save'],
      ['Dörtte üç (Three-quarters)', '+5 AC, +5 DEX save'],
      ['Tam (Total)', 'Doğrudan hedeflenemez'],
    ],
  },
  {
    id: 'light',
    title: 'Işık & Görüş',
    subtitle: 'Vision',
    accent: 'violet',
    kind: 'grid',
    columns: ['Durum', 'Etki'],
    rows: [
      ['Lightly obscured', 'Perception kontrolleri **disadvantage**'],
      ['Heavily obscured', 'Etkin biçimde **blinded**'],
      ['Bright light', 'Normal görüş'],
      ['Dim light', 'Lightly obscured sayılır'],
      ['Darkness', 'Heavily obscured sayılır'],
      ['Darkvision', 'Karanlığı dim light gibi görür (renksiz)'],
      ['Blindsight', 'Görmeden algılar'],
      ['Truesight', 'Yanılsamaları, görünmezleri, gerçek biçimleri görür'],
    ],
  },
  {
    id: 'travel',
    title: 'Yolculuk Hızı',
    subtitle: 'Travel Pace',
    accent: 'azure',
    kind: 'grid',
    columns: ['Tempo', 'Dakika', 'Saat', 'Gün', 'Etki'],
    rows: [
      ['Yavaş', '200 ft', '2 mil', '18 mil', 'Stealth mümkün'],
      ['Normal', '300 ft', '3 mil', '24 mil', '—'],
      ['Hızlı', '400 ft', '4 mil', '30 mil', '−5 passive Perception'],
    ],
  },
  {
    id: 'improvised',
    title: 'Doğaçlama Hasar',
    subtitle: 'Improvised Damage',
    accent: 'rose',
    kind: 'grid',
    columns: ['Örnek', 'Hasar'],
    rows: [
      ['Kapıya sıkışmak, kaynar su', '1d10'],
      ['Kılıç tuzağı, yıldırım çarpması', '2d10'],
      ['Lav sıçraması, kaya düşmesi', '4d10'],
      ['Lav havuzu, kasırga çarpması', '10d10'],
      ['Erimiş kaya çukuru, uçak enkazı', '18d10'],
      ['Yıldız çekirdeği, tanrısal gazap', '24d10'],
    ],
  },
  {
    id: 'objects',
    title: 'Nesne AC & HP',
    subtitle: 'Objects',
    accent: 'accent',
    kind: 'grid',
    columns: ['Malzeme / Boyut', 'AC / HP'],
    rows: [
      ['Kumaş, kâğıt, ip', 'AC 11'],
      ['Kristal, cam, buz', 'AC 13'],
      ['Ahşap, kemik', 'AC 15'],
      ['Taş', 'AC 17'],
      ['Demir, çelik', 'AC 19'],
      ['Mithral', 'AC 21'],
      ['Adamantine', 'AC 23'],
      ['Küçük (sandık, lir)', 'HP 3 (1d6) kırılgan / 5 (2d4) dayanıklı'],
      ['Orta (varil, avize)', 'HP 4 (1d8) / 18 (4d8)'],
      ['Büyük (araba, 10 ft pencere)', 'HP 13 (3d8) / 27 (5d10)'],
    ],
  },
  {
    id: 'death',
    title: 'Ölüm & Düşme',
    subtitle: 'Death Saves & Falling',
    accent: 'rose',
    kind: 'grid',
    columns: ['Kural', 'Detay'],
    rows: [
      ['Death save', 'DC 10 · 3 başarı = stable · 3 başarısızlık = ölüm'],
      ['Nat 20', '1 HP ile ayılır'],
      ['Nat 1', 'İki başarısızlık sayılır'],
      ['0 HP’de hasar', 'Bir başarısızlık; kritik ise iki'],
      ['Massive damage', 'Kalan HP’yi aşan fazlalık ≥ max HP ise anında ölüm'],
      ['Düşme', 'Her 10 ft için 1d6, en fazla 20d6; prone olur'],
      ['Nefessiz kalma', 'CON mod kadar tur (min 1), sonra 0 HP’ye düşer'],
    ],
  },
  {
    id: 'rest',
    title: 'Dinlenme',
    subtitle: 'Resting',
    accent: 'sage',
    kind: 'grid',
    columns: ['Tür', 'Süre', 'Kazanım'],
    rows: [
      ['Short rest', '≥ 1 saat', 'Hit Dice harcayarak iyileş (+CON mod)'],
      ['Long rest', '≥ 8 saat', 'Tüm HP, yarı Hit Dice, spell slotlar, 1 exhaustion'],
      ['Sınır', 'Günde 1 long rest', '≥ 1 saat aktivite dinlenmeyi bozar'],
    ],
  },
  {
    id: 'senses',
    title: 'Sosyal Etkileşim',
    subtitle: 'Social Interaction',
    accent: 'violet',
    kind: 'grid',
    columns: ['Tutum', 'Davranış'],
    rows: [
      ['Hostile', 'DC 20 · İstemez, aktif engel olur'],
      ['Indifferent', 'DC 15 · Risk almaz, ikna edilebilir'],
      ['Friendly', 'DC 10 · Küçük riskler alır, yardım eder'],
    ],
  },
  {
    id: 'encumbrance',
    title: 'Taşıma & Yük',
    subtitle: 'Carrying Capacity',
    accent: 'azure',
    kind: 'grid',
    columns: ['Eşik', 'Formül / Etki'],
    rows: [
      ['Taşıma kapasitesi', 'STR × 15 lb'],
      ['Encumbered (opsiyonel)', 'STR × 5 → hız −10 ft'],
      ['Heavily encumbered', 'STR × 10 → hız −20 ft, saldırı/check/save disadvantage'],
      ['İtme / çekme / kaldırma', 'STR × 30 lb'],
    ],
  },
  {
    id: 'skills',
    title: 'Yetenek ↔ Beceri',
    subtitle: 'Skills by Ability',
    accent: 'accent',
    kind: 'grid',
    columns: ['Ability', 'Skills'],
    rows: [
      ['STR', 'Athletics'],
      ['DEX', 'Acrobatics · Sleight of Hand · Stealth'],
      ['INT', 'Arcana · History · Investigation · Nature · Religion'],
      ['WIS', 'Animal Handling · Insight · Medicine · Perception · Survival'],
      ['CHA', 'Deception · Intimidation · Performance · Persuasion'],
      ['CON', '— (save only)'],
    ],
  },
  {
    id: 'services',
    title: 'Fiyatlar & Hizmetler',
    subtitle: 'Common Costs',
    accent: 'sage',
    kind: 'grid',
    columns: ['Kalem', 'Fiyat'],
    rows: [
      ['Ucuz yemek / gece', '3 sp / 5 sp'],
      ['Konforlu han (gece)', '5 sp'],
      ['Lüks han (gece)', '2 gp'],
      ['Bira (sürahi)', '2 sp'],
      ['Ata binme (gün)', '3 sp'],
      ['Ulak (mil başına)', '2 cp'],
      ['Yol geçiş ücreti', '1 cp'],
      ['Gemi yolculuğu (mil)', '1 sp'],
      ['Healer’s kit (10 kullanım)', '5 gp'],
      ['Paralı asker (gün)', '2 gp'],
    ],
  },
  {
    id: 'spellrules',
    title: 'Büyü Kuralları',
    subtitle: 'Spellcasting',
    accent: 'violet',
    kind: 'grid',
    columns: ['Konu', 'Kural'],
    rows: [
      ['Concentration', 'Hasar alınca DC 10 veya hasarın yarısı (hangisi yüksekse) CON save'],
      ['Aynı anda', 'Tek seferde yalnızca bir concentration büyüsü'],
      ['Bonus action büyü', 'Aynı turda sadece bir cantrip (action) daha atılabilir'],
      ['Spell save DC', '8 + prof. bonus + casting ability mod'],
      ['Spell attack', 'prof. bonus + casting ability mod'],
      ['Ritual', 'Slot harcamadan, +10 dakika sürede'],
      ['Counterspell', 'Seviye ≤ slot ise otomatik; değilse DC 10 + büyü seviyesi'],
    ],
  },
]

/** Encounter XP thresholds per character level (SRD). */
export const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
}

/** Encounter multipliers by monster count (SRD). */
export function encounterMultiplier(monsterCount: number, partySize: number): number {
  const table: Array<[number, number]> = [
    [1, 1],
    [2, 1.5],
    [6, 2],
    [10, 2.5],
    [14, 3],
    [Infinity, 4],
  ]
  let idx = table.findIndex(([max]) => monsterCount <= max)
  if (idx === -1) idx = table.length - 1

  // Small parties feel more pressure, large parties less — shift one step.
  if (partySize < 3) idx = Math.min(idx + 1, table.length - 1)
  if (partySize > 5) idx = Math.max(idx - 1, 0)

  return table[idx][1]
}

export const SKILL_ABILITY: Record<string, string> = {
  Acrobatics: 'DEX', 'Animal Handling': 'WIS', Arcana: 'INT', Athletics: 'STR',
  Deception: 'CHA', History: 'INT', Insight: 'WIS', Intimidation: 'CHA',
  Investigation: 'INT', Medicine: 'WIS', Nature: 'INT', Perception: 'WIS',
  Performance: 'CHA', Persuasion: 'CHA', Religion: 'INT', 'Sleight of Hand': 'DEX',
  Stealth: 'DEX', Survival: 'WIS',
}

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
] as const

export const CREATURE_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey',
  'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
] as const

export const CONDITION_NAMES = CONDITIONS.map((c) => c.name)
