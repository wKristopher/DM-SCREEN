/**
 * 5etools JSON → internal (Open5e-shaped) records.
 *
 * Written as plain ESM rather than TypeScript because it runs in two places
 * that must agree exactly: the Node export script that bakes the official
 * catalogue into `public/5etools/`, and the browser when a DM drops a 5etools
 * homebrew file onto the Forge. One implementation means an imported brew
 * renders identically to an exported book.
 *
 * The hard part is not the field mapping, it is 5etools' inline tag language
 * (`{@damage 8d6}`, `{@atk mw}`, `{@spell fireball|phb|fire ball}`). Those tags
 * nest, carry pipe-separated display overrides, and appear in every free-text
 * field, so they get a real tokeniser rather than a pile of regexes.
 *
 * Output text uses the same lightweight markup `RichText` already renders:
 * `**bold**`, `_italic_`, `~~strike~~` and newlines.
 *
 * @see src/lib/fivetools-convert.d.ts for the typed surface.
 */

/* ------------------------------------------------------------------ tags */

/**
 * Split on `|` at brace depth zero, so `{@i a|b}` inside a tag body does not
 * chop the outer tag's argument list in the wrong place.
 */
function splitPipes (str) {
	const out = []
	let depth = 0
	let cur = ''
	for (let i = 0; i < str.length; i++) {
		const c = str[i]
		if (c === '{') depth++
		else if (c === '}') depth--
		if (c === '|' && depth === 0) {
			out.push(cur)
			cur = ''
		} else cur += c
	}
	out.push(cur)
	return out
}

/**
 * Reference-style tags all share the shape `name|source|displayText`; the only
 * thing that differs is which slot the display text lives in.
 */
const DISPLAY_AT = {
	// name|source|display
	spell: 2, item: 2, creature: 2, condition: 2, disease: 2, status: 2,
	skill: 2, sense: 2, action: 2, feat: 2, background: 2, race: 2, class: 2,
	subclass: 2, optfeature: 2, reward: 2, table: 2, variantrule: 2,
	vehicle: 2, vehupgrade: 2, object: 2, trap: 2, hazard: 2, cult: 2,
	boon: 2, psionic: 2, language: 2, charoption: 2, recipe: 2, legroup: 2,
	card: 2, itemMastery: 2, facility: 2, deck: 2, bastion: 2, itemProperty: 2,
	itemType: 2, classFeature: 5, subclassFeature: 7,
	// name|pantheon|source|display
	deity: 3,
	// text|book|chapter|section|display
	book: 4, adventure: 4, quickref: 4,
	// text is already first
	filter: 0, link: 0, '5etools': 0, '5etoolsImg': 0, footnote: 0,
	homebrew: 0, color: 0, highlight: 0, help: 0, area: 0, style: 0,
	tip: 0, comic: 0, comicH1: 0, comicH2: 0, comicH3: 0, comicH4: 0,
	comicNote: 0, unit: 0,
}

const ATTACK_TYPE = {
	m: 'Melee Attack:', r: 'Ranged Attack:',
	mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:',
	ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:',
	mp: 'Melee Power Attack:', rp: 'Ranged Power Attack:',
}

/** 2024-style `{@atkr}` names the delivery only; the save/hit line follows it. */
const ATTACK_RANGE = {
	m: 'Melee', r: 'Ranged', mw: 'Melee Weapon', rw: 'Ranged Weapon',
	ms: 'Melee Spell', rs: 'Ranged Spell',
}

const ABILITY_FULL = {
	str: 'Strength', dex: 'Dexterity', con: 'Constitution',
	int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

function signedNum (raw) {
	const n = Number(String(raw).trim())
	if (!Number.isFinite(n)) return String(raw).trim()
	return n < 0 ? String(n) : `+${n}`
}

/**
 * Render one `{@tag ...}` body (the text between `{@` and its matching `}`).
 * Arguments are themselves stripped, because tags nest.
 */
function renderTag (body) {
	const spaceAt = body.search(/\s/)
	const tag = spaceAt === -1 ? body : body.slice(0, spaceAt)
	const rest = spaceAt === -1 ? '' : body.slice(spaceAt + 1)
	const parts = splitPipes(rest)
	const first = () => stripTags(parts[0] ?? '')

	switch (tag) {
		case 'b': case 'bold': return `**${first()}**`
		case 'i': case 'italic': return `_${first()}_`
		case 's': case 'strike': case 'strikeDouble': return `~~${first()}~~`
		case 'u': case 'underline': case 'underlineDouble': case 'note':
		case 'kbd': case 'code': case 'sup': case 'sub':
			return first()

		case 'atk': {
			// Multiple types are alternatives ("mw,rw" → melee or ranged).
			const kinds = (parts[0] ?? '').split(',').map((k) => k.trim())
			const named = kinds.map((k) => ATTACK_TYPE[k]).filter(Boolean)
			if (!named.length) return first()
			return `_${named.join(' or ')}_`
		}
		case 'atkr': {
			const kinds = (parts[0] ?? '').split(',').map((k) => k.trim())
			const named = kinds.map((k) => ATTACK_RANGE[k]).filter(Boolean)
			return named.length ? `_${named.join(' or ')}:_` : first()
		}
		case 'h': return '**Hit:** '
		case 'm': return '**Miss:** '
		case 'hom': return '**Hit or Miss:** '
		case 'actSave': {
			const ab = ABILITY_FULL[(parts[0] ?? '').trim().toLowerCase()] ?? first()
			return `_${ab} Saving Throw:_`
		}
		case 'actSaveSuccess': return '_Success:_'
		case 'actSaveFail':
			return parts[0] ? `_Failure by ${first()}:_` : '_Failure:_'
		case 'actSaveSuccessOrFail': return '_Success or Failure:_'
		case 'actTrigger': return '_Trigger:_'
		case 'actResponse': return parts[0] ? `_Response—${first()}:_` : '_Response:_'

		case 'hit': case 'd20': return signedNum(parts[0] ?? '0')
		case 'dc': case 'actSaveDc': return `DC ${first()}`
		case 'damage': case 'dice': case 'autodice': case 'hitYourSpellAttackDamage':
			// `{@dice 1d6|d6}` — the second slot is a display override.
			return stripTags(parts[1] || parts[0] || '')
		case 'scaledice': case 'scaledamage':
			return stripTags(parts[3] || parts[2] || parts[0] || '')
		case 'chance': {
			const label = parts[3] || parts[2]
			return label ? stripTags(label) : `${first()} percent`
		}
		case 'coinflip': return 'flip a coin'
		case 'recharge':
			return parts[0] ? `(Recharge ${first()}–6)` : '(Recharge 6)'
		case 'hitYourSpellAttack': return 'your spell attack modifier'
		case 'dcYourSpellSave': return 'your spell save DC'

		default: {
			const idx = DISPLAY_AT[tag]
			if (idx === undefined) return first()
			return stripTags(parts[idx] || parts[0] || '')
		}
	}
}

/**
 * Replace every `{@tag ...}` in a string with its plain-text rendering.
 *
 * Braces are matched by depth rather than by regex so that nested tags — very
 * common in 2024 statblocks — collapse from the inside out.
 */
export function stripTags (str) {
	if (typeof str !== 'string') return ''
	if (!str.includes('{@')) return str

	let out = ''
	let i = 0
	while (i < str.length) {
		const start = str.indexOf('{@', i)
		if (start === -1) {
			out += str.slice(i)
			break
		}
		out += str.slice(i, start)

		let depth = 1
		let j = start + 2
		for (; j < str.length; j++) {
			if (str[j] === '{') depth++
			else if (str[j] === '}' && --depth === 0) break
		}
		if (depth !== 0) {
			// Unbalanced input — emit the remainder verbatim rather than lose it.
			out += str.slice(start)
			break
		}
		out += renderTag(str.slice(start + 2, j))
		i = j + 1
	}
	return out
}

/* --------------------------------------------------------------- entries */

function tableToText (entry) {
	const lines = []
	if (entry.caption) lines.push(`**${stripTags(entry.caption)}**`)
	const head = (entry.colLabels ?? []).map((c) => stripTags(c))
	if (head.length) lines.push(head.join(' · '))
	for (const row of entry.rows ?? []) {
		const cells = Array.isArray(row) ? row : (row.row ?? [])
		lines.push(cells.map((c) => entryToText(c)).join(' · '))
	}
	return lines.join('\n')
}

/**
 * Flatten one 5etools entry node to text.
 *
 * 5etools models rules text as a tree of ~40 node types. The ones that carry
 * meaning at the table are handled explicitly; anything unknown falls through
 * to its `entries`/`entry` children so a new node type degrades to its content
 * instead of vanishing.
 */
export function entryToText (entry) {
	if (entry == null) return ''
	if (typeof entry === 'string') return stripTags(entry)
	if (typeof entry === 'number' || typeof entry === 'boolean') return String(entry)
	if (Array.isArray(entry)) return entriesToText(entry)

	switch (entry.type) {
		case 'list': {
			const items = (entry.items ?? []).map((it) => {
				const text = entryToText(it)
				return text ? `• ${text.replace(/\n/g, '\n  ')}` : ''
			})
			return items.filter(Boolean).join('\n')
		}
		case 'table': case 'tableGroup':
			return entry.type === 'table' ? tableToText(entry) : entriesToText(entry.tables ?? [])
		case 'item': case 'itemSub': case 'itemSpell': case 'itemTitleSubEntry': {
			const name = entry.name ? `**${stripTags(entry.name)}** ` : ''
			return name + entriesToText(entry.entries ?? [entry.entry]).trim()
		}
		case 'quote': {
			const body = entriesToText(entry.entries ?? [])
			return entry.by ? `_${body}_\n— ${stripTags(entry.by)}` : `_${body}_`
		}
		case 'abilityDc':
			return `**${stripTags(entry.name ?? '')} save DC** = 8 + proficiency bonus + ${(entry.attributes ?? []).map((a) => ABILITY_FULL[a] ?? a).join(' or ')} modifier`
		case 'abilityAttackMod':
			return `**${stripTags(entry.name ?? '')} attack modifier** = proficiency bonus + ${(entry.attributes ?? []).map((a) => ABILITY_FULL[a] ?? a).join(' or ')} modifier`
		case 'abilityGeneric':
			return [stripTags(entry.name ?? ''), stripTags(entry.text ?? '')].filter(Boolean).join(' = ')
		case 'link':
			return stripTags(entry.text ?? '')
		case 'wrapper':
			// Generated item variants wrap inherited text with renderer metadata.
			return entryToText(entry.wrapped)
		case 'image': case 'gallery': case 'flowchart': case 'homebrew':
			return ''
		case 'refClassFeature': case 'refSubclassFeature': case 'refOptionalfeature':
			// Cross-file pointers; the target lives in a file we do not export.
			return ''
		default: {
			const head = entry.name ? `**${stripTags(entry.name)}.** ` : ''
			const body = entry.entries
				? entriesToText(entry.entries)
				: entry.entry !== undefined
					? entryToText(entry.entry)
					: typeof entry.text === 'string'
						? stripTags(entry.text)
						: ''
			return (head + body).trim()
		}
	}
}

/** Flatten a list of entries, one blank-line-free paragraph per node. */
export function entriesToText (entries) {
	if (!Array.isArray(entries)) return entryToText(entries)
	return entries.map((e) => entryToText(e)).filter((s) => s !== '').join('\n')
}

/* ---------------------------------------------------------------- naming */

/**
 * Letters that survive NFKD intact because they are their own base character
 * rather than a decomposable accent. Turkish dotless "ı" is the one that
 * matters here: a DM writing brew in Turkish would otherwise get slugs like
 * `s-r-k` for both "Sırık" and "Sarık".
 */
const TRANSLITERATE = {
	ı: 'i', ş: 's', ğ: 'g', ø: 'o', å: 'a', æ: 'ae', œ: 'oe',
	ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ħ: 'h', ŋ: 'n',
}

/** URL-safe id. 5etools keys entities by `name|source`, we need one token. */
export function slugify (name, source) {
	const base = String(name ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\x00-\x7f]/g, (c) => TRANSLITERATE[c] ?? c)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return source ? `${base}_${String(source).toLowerCase()}` : base
}

/** Namespaced so a 5etools book can never collide with an Open5e document. */
export function docSlug (source) {
	return `5et-${String(source ?? 'unknown').toLowerCase()}`
}

/**
 * Make slugs unique in place.
 *
 * Punctuation that distinguishes two names can vanish in slugification —
 * 5etools ships both "Arrow of Slaying" and its generic-variant template
 * "Arrow of Slaying (*)", which reduce to the same token. Slugs address
 * records for hydration and act as React keys, so a collision would show the
 * wrong item. Callers pass an already-sorted list so the numbering is stable
 * between exports.
 *
 * @param {Array<{ slug: string }>} records
 */
export function dedupeSlugs (records) {
	const taken = new Set()
	for (const rec of records) {
		if (!taken.has(rec.slug)) {
			taken.add(rec.slug)
			continue
		}
		let n = 2
		while (taken.has(`${rec.slug}-${n}`)) n++
		rec.slug = `${rec.slug}-${n}`
		taken.add(rec.slug)
	}
	return records
}

/* ------------------------------------------------------------ statblocks */

const SIZE_FULL = {
	F: 'Fine', D: 'Diminutive', T: 'Tiny', S: 'Small', M: 'Medium',
	L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal', V: 'Varies',
}

const ALIGNMENT_FULL = {
	L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
	U: 'unaligned', A: 'any alignment', NX: 'neutral', NY: 'neutral',
}

const SCHOOL_FULL = {
	A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
	V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
	P: 'Psionic',
}

function sizeToFull (size) {
	const arr = Array.isArray(size) ? size : [size]
	const named = arr.map((s) => SIZE_FULL[s] ?? s).filter(Boolean)
	return named.join(' or ') || 'Medium'
}

function typeToParts (type) {
	if (!type) return { type: 'unknown', subtype: '' }
	if (typeof type === 'string') return { type, subtype: '' }
	if (type.choose) return { type: type.choose.join(' or '), subtype: '' }
	const tags = (type.tags ?? []).map((t) => (typeof t === 'string' ? t : t.tag ?? '')).filter(Boolean)
	return { type: type.type ?? 'unknown', subtype: tags.join(', ') }
}

function alignmentToText (align) {
	if (!align) return 'unaligned'
	if (typeof align === 'string') return ALIGNMENT_FULL[align] ?? align
	if (Array.isArray(align)) {
		// A weighted list ("chaotic evil 50%, neutral evil 50%") arrives as
		// objects; a plain axis pair arrives as bare letters.
		if (align.some((a) => typeof a === 'object' && a !== null)) {
			return align
				.map((a) => {
					if (typeof a === 'string') return ALIGNMENT_FULL[a] ?? a
					if (a.special) return stripTags(a.special)
					const inner = alignmentToText(a.alignment)
					return a.chance ? `${inner} (${a.chance}%)` : inner
				})
				.filter(Boolean)
				.join(', ')
		}
		return align.map((a) => ALIGNMENT_FULL[a] ?? a).join(' ')
	}
	if (align.special) return stripTags(align.special)
	if (align.alignment) return alignmentToText(align.alignment)
	return 'unaligned'
}

function acToParts (ac) {
	if (!Array.isArray(ac) || !ac.length) return { value: 10, desc: '' }
	const first = ac[0]
	if (typeof first === 'number') return { value: first, desc: '' }

	const notes = []
	if (first.from?.length) notes.push(first.from.map((f) => stripTags(f)).join(', '))
	if (first.condition) notes.push(stripTags(first.condition))
	// Alternate ACs ("13 in beast form") are worth keeping as a note.
	for (const alt of ac.slice(1)) {
		if (typeof alt === 'number') notes.push(String(alt))
		else if (alt?.ac) notes.push(`${alt.ac}${alt.condition ? ` ${stripTags(alt.condition)}` : ''}`)
	}
	return { value: first.ac ?? first.special ?? 10, desc: notes.join('; ') }
}

function speedToRecord (speed) {
	if (!speed) return { walk: 0 }
	if (typeof speed === 'number') return { walk: speed }
	const out = {}
	for (const [k, v] of Object.entries(speed)) {
		if (k === 'canHover') {
			if (v) out.hover = true
			continue
		}
		if (typeof v === 'number') out[k] = v
		else if (typeof v === 'boolean') out[k] = v
		else if (v && typeof v === 'object' && typeof v.number === 'number') out[k] = v.number
	}
	return out
}

/** `"+6"` / `6` / `"—"` → 6, or null when the creature has no such bonus. */
function toBonus (raw) {
	if (raw == null) return null
	const n = parseInt(String(raw).replace(/[^\d+-]/g, ''), 10)
	return Number.isFinite(n) ? n : null
}

function skillsToRecord (skill) {
	if (!skill || typeof skill !== 'object') return {}
	const out = {}
	for (const [k, v] of Object.entries(skill)) {
		if (k === 'other') {
			// `other` holds conditional bonuses keyed by an inner object.
			for (const extra of Array.isArray(v) ? v : []) {
				for (const [ik, iv] of Object.entries(extra?.oneOf ?? {})) {
					const n = toBonus(iv)
					if (n !== null) out[ik] = n
				}
			}
			continue
		}
		const n = toBonus(v)
		if (n !== null) out[k] = n
	}
	return out
}

/**
 * Damage/condition immunity lists mix bare strings with conditional groups
 * (`{"immune": ["fire"], "note": "from nonmagical attacks"}`).
 */
function affinityToText (list) {
	if (!Array.isArray(list)) return ''
	const parts = []
	for (const it of list) {
		if (typeof it === 'string') {
			parts.push(it)
			continue
		}
		if (!it || typeof it !== 'object') continue
		const inner = it.immune ?? it.resist ?? it.vulnerable ?? it.special
		const text = typeof inner === 'string' ? stripTags(inner) : affinityToText(inner)
		const note = it.note ? ` ${stripTags(it.note)}` : ''
		if (text) parts.push(`${text}${note}`.trim())
		else if (note.trim()) parts.push(note.trim())
	}
	return parts.join(', ')
}

function sensesToText (mon) {
	const parts = (mon.senses ?? []).map((s) => stripTags(typeof s === 'string' ? s : String(s)))
	if (mon.passive != null) parts.push(`passive Perception ${mon.passive}`)
	return parts.join(', ')
}

function languagesToText (langs) {
	if (!Array.isArray(langs)) return typeof langs === 'string' ? stripTags(langs) : ''
	return langs.map((l) => stripTags(l)).join(', ')
}

/** CR may be a bare string, or an object carrying lair/coven variants. */
function crToParts (cr) {
	const raw = cr && typeof cr === 'object' ? (cr.cr ?? cr.special ?? '0') : (cr ?? '0')
	const text = String(raw)
	const num = text.includes('/')
		? (() => {
			const [a, b] = text.split('/').map(Number)
			return b ? a / b : 0
		})()
		: Number(text)
	return { cr: Number.isFinite(num) ? num : 0, challenge_rating: text }
}

/** Pull the roll button's dice and attack bonus out of the raw tagged text. */
function extractDice (raw) {
	const out = {}
	const hit = /\{@hit ([+-]?\d+)\}/.exec(raw)
	if (hit) out.attack_bonus = parseInt(hit[1], 10)
	const dmg = /\{@(?:damage|dice) ([^}|]+)/.exec(raw)
	if (dmg) out.damage_dice = dmg[1].replace(/\s+/g, '')
	return out
}

function toNamedEntries (list) {
	if (!Array.isArray(list) || !list.length) return null
	return list.map((e) => {
		const rawBody = JSON.stringify(e.entries ?? e.entry ?? '')
		return {
			name: stripTags(e.name ?? ''),
			desc: entriesToText(e.entries ?? [e.entry]).trim(),
			...extractDice(rawBody),
		}
	})
}

/**
 * Render a `spellcasting` block into a single trait.
 *
 * Monsters keep spells in a shape built for the 5etools renderer (per-level
 * slot objects, at-will lists, per-day counters). Collapsing it into one
 * paragraph keeps it readable inside a statblock that has no nested layout.
 */
function spellcastingToEntry (sc) {
	const lines = []
	if (sc.headerEntries) lines.push(entriesToText(sc.headerEntries))

	const spellList = (arr) => (arr ?? []).map((s) => stripTags(typeof s === 'string' ? s : s.entry ?? '')).join(', ')

	if (sc.constant) lines.push(`**Constant:** ${spellList(sc.constant)}`)
	if (sc.will) lines.push(`**At will:** ${spellList(sc.will)}`)

	for (const [key, val] of Object.entries(sc.rest ?? {})) {
		const per = key.endsWith('e') ? `${key.slice(0, -1)}/rest each` : `${key}/rest`
		lines.push(`**${per}:** ${spellList(val)}`)
	}
	for (const [key, val] of Object.entries(sc.daily ?? {})) {
		const per = key.endsWith('e') ? `${key.slice(0, -1)}/day each` : `${key}/day`
		lines.push(`**${per}:** ${spellList(val)}`)
	}
	for (const [key, val] of Object.entries(sc.weekly ?? {})) {
		lines.push(`**${key}/week:** ${spellList(val)}`)
	}

	for (const [lvl, val] of Object.entries(sc.spells ?? {})) {
		const label = lvl === '0'
			? 'Cantrips (at will)'
			: `Level ${lvl}${val.slots ? ` (${val.slots} slot${val.slots === 1 ? '' : 's'})` : ''}`
		lines.push(`**${label}:** ${spellList(val.spells)}`)
	}

	if (sc.footerEntries) lines.push(entriesToText(sc.footerEntries))

	return { name: stripTags(sc.name ?? 'Spellcasting'), desc: lines.filter(Boolean).join('\n') }
}

/**
 * Convert one resolved 5etools monster.
 *
 * `mon` must already have `_copy` applied — the export script leans on
 * 5etools' own loader for that, and brew import resolves it via `applyCopy`.
 *
 * @param {object} mon
 * @param {{ sourceTitle?: string, homebrew?: boolean, docSlug?: string }} [opts]
 */
export function convertMonster (mon, opts = {}) {
	const { type, subtype } = typeToParts(mon.type)
	const ac = acToParts(mon.ac)
	const { cr, challenge_rating } = crToParts(mon.cr)

	const traits = [...(mon.trait ?? [])]
	const specials = toNamedEntries(traits) ?? []
	for (const sc of mon.spellcasting ?? []) specials.push(spellcastingToEntry(sc))

	// Mythic actions have no slot of their own, so they ride along with the
	// legendary block where a DM already looks for "extra" actions.
	const legendary = [...(mon.legendary ?? [])]
	const mythic = toNamedEntries(mon.mythic ?? []) ?? []
	// 5etools omits the boilerplate intro when it is the standard one and lets
	// its renderer fill it in; without it the block reads as if the count and
	// timing rules were never printed.
	const legendaryIntro = legendary.length && !mon.legendaryHeader
		? (() => {
			const n = mon.legendaryActions ?? 3
			const who = mon.isNamedCreature ? mon.name : `The ${String(mon.name ?? '').toLowerCase()}`
			return `${who} can take ${n} legendary action${n === 1 ? '' : 's'}, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. ${who} regains spent legendary actions at the start of its turn.`
		})()
		: ''

	const legendaryDesc = [
		mon.legendaryHeader ? entriesToText(mon.legendaryHeader) : legendaryIntro,
		mon.mythicHeader ? entriesToText(mon.mythicHeader) : '',
	].filter(Boolean).join('\n')

	const hp = mon.hp ?? {}

	return {
		slug: slugify(mon.name, mon.source),
		name: stripTags(mon.name ?? ''),
		size: sizeToFull(mon.size),
		type,
		subtype,
		alignment: alignmentToText(mon.alignment),
		armor_class: typeof ac.value === 'number' ? ac.value : 10,
		armor_desc: typeof ac.value === 'number' ? ac.desc : stripTags(String(ac.value)),
		hit_points: hp.average ?? 1,
		hit_dice: hp.formula ?? (hp.special ? stripTags(hp.special) : ''),
		speed: speedToRecord(mon.speed),
		strength: mon.str ?? 10,
		dexterity: mon.dex ?? 10,
		constitution: mon.con ?? 10,
		intelligence: mon.int ?? 10,
		wisdom: mon.wis ?? 10,
		charisma: mon.cha ?? 10,
		strength_save: toBonus(mon.save?.str),
		dexterity_save: toBonus(mon.save?.dex),
		constitution_save: toBonus(mon.save?.con),
		intelligence_save: toBonus(mon.save?.int),
		wisdom_save: toBonus(mon.save?.wis),
		charisma_save: toBonus(mon.save?.cha),
		perception: toBonus(mon.skill?.perception),
		skills: skillsToRecord(mon.skill),
		damage_vulnerabilities: affinityToText(mon.vulnerable),
		damage_resistances: affinityToText(mon.resist),
		damage_immunities: affinityToText(mon.immune),
		condition_immunities: affinityToText(mon.conditionImmune),
		senses: sensesToText(mon),
		languages: languagesToText(mon.languages),
		challenge_rating,
		cr,
		actions: toNamedEntries(mon.action),
		bonus_actions: toNamedEntries(mon.bonus),
		reactions: toNamedEntries(mon.reaction),
		legendary_desc: legendaryDesc,
		legendary_actions: [...(toNamedEntries(legendary) ?? []), ...mythic.map((e) => ({ ...e, name: `Mythic: ${e.name}` }))],
		special_abilities: specials,
		desc: mon.entries ? entriesToText(mon.entries) : '',
		environments: mon.environment ?? [],
		document__slug: opts.docSlug ?? docSlug(mon.source),
		document__title: opts.sourceTitle ?? String(mon.source ?? '5etools'),
		homebrew: opts.homebrew ?? false,
		source: '5etools',
	}
}

/* -------------------------------------------------------------- spells */

const TIME_UNIT = {
	action: 'action', bonus: 'bonus action', reaction: 'reaction',
	round: 'round', minute: 'minute', hour: 'hour', day: 'day',
	week: 'week', month: 'month', year: 'year', special: 'special',
}

function castingTimeToText (time) {
	if (!Array.isArray(time) || !time.length) return '1 action'
	return time
		.map((t) => {
			if (typeof t === 'string') return t
			const unit = TIME_UNIT[t.unit] ?? t.unit
			const n = t.number ?? 1
			const base = `${n} ${unit}${n === 1 ? '' : 's'}`
			return t.condition ? `${base}, ${stripTags(t.condition)}` : base
		})
		.join(' or ')
}

function distanceToText (dist) {
	if (!dist) return ''
	switch (dist.type) {
		case 'self': return 'Self'
		case 'touch': return 'Touch'
		case 'sight': return 'Sight'
		case 'unlimited': return 'Unlimited'
		case 'unlimitedSame': return 'Unlimited (same plane)'
		case 'plane': return 'Same plane'
		default: return `${dist.amount ?? ''} ${dist.type ?? ''}`.trim()
	}
}

function rangeToText (range) {
	if (!range) return ''
	if (typeof range === 'string') return range
	const dist = distanceToText(range.distance)
	switch (range.type) {
		case 'point': return dist
		case 'special': return 'Special'
		case 'radius': case 'sphere': case 'cone': case 'line':
		case 'cube': case 'cylinder': case 'hemisphere':
			return `Self (${dist} ${range.type})`
		default: return dist || String(range.type ?? '')
	}
}

function durationToText (duration) {
	if (!Array.isArray(duration) || !duration.length) return 'Instantaneous'
	return duration
		.map((d) => {
			if (typeof d === 'string') return d
			switch (d.type) {
				case 'instant': return 'Instantaneous'
				case 'permanent':
					return `Until ${(d.ends ?? []).map((e) => (e === 'dispel' ? 'dispelled' : e === 'trigger' ? 'triggered' : e)).join(' or ') || 'dispelled'}`
				case 'special': return 'Special'
				default: {
					const n = d.duration?.amount ?? 1
					const unit = d.duration?.upTo ? `up to ${n} ${d.duration.type}` : `${n} ${d.duration?.type ?? ''}`
					return `${unit}${n === 1 ? '' : 's'}`.trim()
				}
			}
		})
		.join(' or ')
}

function componentsToText (comp) {
	if (!comp) return ''
	const out = []
	if (comp.v) out.push('V')
	if (comp.s) out.push('S')
	if (comp.m) out.push('M')
	if (comp.r) out.push('R')
	return out.join(', ')
}

function materialToText (m) {
	if (!m) return ''
	if (typeof m === 'string') return stripTags(m)
	return stripTags(m.text ?? '')
}

const ORDINAL = ['cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level']

/**
 * @param {object} sp
 * @param {{ sourceTitle?: string, homebrew?: boolean, docSlug?: string, classes?: string[] }} [opts]
 */
export function convertSpell (sp, opts = {}) {
	const level = sp.level ?? 0
	const higher = sp.entriesHigherLevel ? entriesToText(sp.entriesHigherLevel) : ''

	return {
		slug: slugify(sp.name, sp.source),
		name: stripTags(sp.name ?? ''),
		desc: entriesToText(sp.entries ?? []),
		// The heading is already spelled out in the card's own label.
		higher_level: higher.replace(/^\*\*At Higher Levels\.\*\*\s*/, ''),
		range: rangeToText(sp.range),
		components: componentsToText(sp.components),
		material: materialToText(sp.components?.m),
		ritual: sp.meta?.ritual ? 'yes' : 'no',
		duration: durationToText(sp.duration),
		concentration: (sp.duration ?? []).some((d) => d?.concentration) ? 'yes' : 'no',
		casting_time: castingTimeToText(sp.time),
		level: ORDINAL[level] ?? `${level}th-level`,
		level_int: level,
		school: SCHOOL_FULL[sp.school] ?? String(sp.school ?? ''),
		dnd_class: (opts.classes ?? []).join(', '),
		document__slug: opts.docSlug ?? docSlug(sp.source),
		document__title: opts.sourceTitle ?? String(sp.source ?? '5etools'),
		homebrew: opts.homebrew ?? false,
		source: '5etools',
	}
}

/* ---------------------------------------------------------------- items */

const ITEM_TYPE_FULL = {
	A: 'Ammunition', AF: 'Ammunition (futuristic)', AIR: 'Vehicle (air)',
	AT: "Artisan's tools", EM: 'Eldritch machine', EXP: 'Explosive',
	FD: 'Food and drink', G: 'Adventuring gear', GS: 'Gaming set',
	GV: 'Generic variant', HA: 'Heavy armor', IDG: 'Illegal drug',
	INS: 'Instrument', LA: 'Light armor', M: 'Melee weapon',
	MA: 'Medium armor', MNT: 'Mount', MR: 'Master rune', OTH: 'Other',
	P: 'Potion', R: 'Ranged weapon', RD: 'Rod', RG: 'Ring', S: 'Shield',
	SC: 'Scroll', SCF: 'Spellcasting focus', SHP: 'Vehicle (water)',
	SPC: 'Vehicle (space)', T: 'Tools', TAH: 'Tack and harness',
	TB: 'Trade bar', TG: 'Trade good', VEH: 'Vehicle (land)', WD: 'Wand',
	$: 'Treasure',
}

/** Type codes carry a source suffix (`"M|phb"`); only the code matters here. */
function itemTypeToText (item) {
	const code = String(item.type ?? '').split('|')[0]
	const named = ITEM_TYPE_FULL[code]
	if (named) return named
	if (item.wondrous) return 'Wondrous item'
	if (item.staff) return 'Staff'
	if (item.poison) return 'Poison'
	if (item.weapon) return 'Weapon'
	if (item.armor) return 'Armor'
	return item.rarity && item.rarity !== 'none' ? 'Wondrous item' : 'Item'
}

function attunementToText (item) {
	if (item.reqAttune === true) return 'yes'
	if (typeof item.reqAttune === 'string') return stripTags(item.reqAttune)
	if (item.reqAttuneAlt) return typeof item.reqAttuneAlt === 'string' ? stripTags(item.reqAttuneAlt) : 'yes'
	return ''
}

const DAMAGE_TYPE_FULL = {
	A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force',
	L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic',
	R: 'radiant', S: 'slashing', T: 'thunder',
}

/**
 * The line of hard numbers a DM actually reads off an item: what it hits for,
 * what it protects, what bonus it grants. 5etools keeps these as separate
 * fields rather than prose, so they would otherwise be lost.
 */
function itemStats (item) {
	const bits = []

	if (item.dmg1) {
		const type = DAMAGE_TYPE_FULL[item.dmgType] ?? item.dmgType ?? ''
		const versatile = item.dmg2 ? ` (${item.dmg2})` : ''
		bits.push(`**Damage:** ${item.dmg1}${versatile} ${type}`.trim())
	}
	if (typeof item.ac === 'number') bits.push(`**AC:** ${item.ac}`)

	const bonus = item.bonusWeapon ?? item.bonusWeaponAttack ?? item.bonusAc ?? item.bonusSpellAttack ?? item.bonusSavingThrow
	if (bonus) bits.push(`**Bonus:** ${stripTags(String(bonus))}`)

	if (item.range) bits.push(`**Range:** ${stripTags(String(item.range))} ft.`)
	// Values are stored in copper.
	if (item.value) bits.push(`**Value:** ${typeof item.value === 'number' ? `${item.value / 100} gp` : stripTags(String(item.value))}`)
	if (item.weight) bits.push(`**Weight:** ${item.weight} lb.`)

	return bits
}

/**
 * @param {object} item
 * @param {{ sourceTitle?: string, homebrew?: boolean, docSlug?: string }} [opts]
 */
export function convertItem (item, opts = {}) {
	// Generated variants ("+2 Longsword") leave `entries` empty and carry the
	// text inherited from their base item in `_fullEntries` instead.
	const source = item._fullEntries?.length ? item._fullEntries : (item.entries ?? [])
	const body = entriesToText(source)
	const bits = itemStats(item)
	const extra = bits.length ? `\n${bits.join(' · ')}` : ''

	return {
		slug: slugify(item.name, item.source),
		name: stripTags(item.name ?? ''),
		type: itemTypeToText(item),
		desc: (body + extra).trim(),
		rarity: item.rarity && item.rarity !== 'none' ? item.rarity : item.tier ? item.tier : 'mundane',
		requires_attunement: attunementToText(item),
		document__slug: opts.docSlug ?? docSlug(item.source),
		document__title: opts.sourceTitle ?? String(item.source ?? '5etools'),
		homebrew: opts.homebrew ?? false,
		source: '5etools',
	}
}

/* ---------------------------------------------------------------- rules */

/**
 * Conditions, diseases, actions and variant rules all reduce to
 * "name + prose", which is exactly the shape the reference panel wants.
 *
 * @param {object} rule
 * @param {{ kind?: string, sourceTitle?: string, homebrew?: boolean, docSlug?: string }} [opts]
 */
export function convertRule (rule, opts = {}) {
	return {
		slug: slugify(rule.name, rule.source),
		name: stripTags(rule.name ?? ''),
		kind: opts.kind ?? 'rule',
		desc: entriesToText(rule.entries ?? []),
		document__slug: opts.docSlug ?? docSlug(rule.source),
		document__title: opts.sourceTitle ?? String(rule.source ?? '5etools'),
		homebrew: opts.homebrew ?? false,
		source: '5etools',
	}
}

/* ----------------------------------------------------------------- _copy */

function getPath (obj, path) {
	return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

function setPath (obj, path, value) {
	const keys = path.split('.')
	const last = keys.pop()
	let cur = obj
	for (const k of keys) {
		if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
		cur = cur[k]
	}
	if (value === undefined) delete cur[last]
	else cur[last] = value
}

function applyMod (target, prop, mod) {
	const list = () => (Array.isArray(getPath(target, prop)) ? getPath(target, prop) : [])
	const items = mod.items === undefined ? [] : Array.isArray(mod.items) ? mod.items : [mod.items]

	switch (mod.mode) {
		case 'prependArr': setPath(target, prop, [...items, ...list()]); break
		case 'appendArr': setPath(target, prop, [...list(), ...items]); break
		case 'appendIfNotExistsArr': {
			const have = new Set(list().map((x) => x?.name))
			setPath(target, prop, [...list(), ...items.filter((x) => !have.has(x?.name))])
			break
		}
		case 'insertArr': {
			const arr = [...list()]
			arr.splice(mod.index ?? arr.length, 0, ...items)
			setPath(target, prop, arr)
			break
		}
		case 'removeArr': {
			const names = new Set((Array.isArray(mod.names) ? mod.names : [mod.names]).filter(Boolean))
			setPath(target, prop, list().filter((x) => !names.has(x?.name)))
			break
		}
		case 'replaceArr': case 'replaceOrAppendArr': {
			const arr = [...list()]
			const target_ = typeof mod.replace === 'string' ? mod.replace : mod.replace?.name
			const at = arr.findIndex((x) => x?.name === target_)
			if (at === -1) {
				if (mod.mode === 'replaceOrAppendArr') arr.push(...items)
			} else arr.splice(at, 1, ...items)
			setPath(target, prop, arr)
			break
		}
		case 'setProp': setPath(target, prop, mod.value); break
		case 'replaceTxt': {
			const find = new RegExp(mod.replace, mod.flags ?? 'g')
			const walk = (node) => {
				if (typeof node === 'string') return node.replace(find, mod.with)
				if (Array.isArray(node)) return node.map(walk)
				if (node && typeof node === 'object') {
					const out = {}
					for (const [k, v] of Object.entries(node)) out[k] = walk(v)
					return out
				}
				return node
			}
			setPath(target, prop, walk(getPath(target, prop)))
			break
		}
		case 'remove': setPath(target, prop, undefined); break
		default: break
	}
}

/**
 * Resolve a `_copy` reference against a pool of candidates.
 *
 * Homebrew leans on `_copy` heavily (a brew dragon that is "the MM dragon but
 * bigger"), so an unresolved copy means a half-empty statblock at the table.
 * This covers the operations brew files actually use; anything exotic falls
 * back to plain inheritance rather than failing the import.
 *
 * @param {object} entity
 * @param {object[]} pool candidates the copy may reference
 */
export function applyCopy (entity, pool) {
	if (!entity?._copy) return entity
	const ref = entity._copy
	const parent = pool.find(
		(p) => p !== entity && p.name === ref.name && (!ref.source || String(p.source).toLowerCase() === String(ref.source).toLowerCase()),
	)
	if (!parent) {
		const { _copy, ...rest } = entity
		return rest
	}

	// The parent may itself be a copy; resolve depth-first.
	const base = parent._copy ? applyCopy(parent, pool) : parent
	const out = JSON.parse(JSON.stringify(base))

	for (const [k, v] of Object.entries(entity)) {
		if (k === '_copy') continue
		out[k] = v
	}
	out.name = entity.name
	out.source = entity.source

	const mods = ref._mod ?? {}
	for (const [prop, raw] of Object.entries(mods)) {
		const list = Array.isArray(raw) ? raw : [raw]
		for (const mod of list) {
			if (prop === '*') {
				// Wildcard applies to every entry-bearing array on the statblock.
				for (const p of ['trait', 'action', 'bonus', 'reaction', 'legendary', 'mythic']) {
					if (out[p]) applyMod(out, p, mod)
				}
			} else applyMod(out, prop, mod)
		}
	}

	delete out._copy
	return out
}

/* ------------------------------------------------------------ brew files */

/** 5etools brew files carry their book list under `_meta.sources`. */
function brewSourceTitles (json) {
	const out = {}
	for (const s of json?._meta?.sources ?? []) {
		if (s?.json) out[s.json] = s.full ?? s.abbreviation ?? s.json
	}
	return out
}

/**
 * Convert a 5etools homebrew document into the app's record shapes.
 *
 * Deliberately tolerant: a brew file that only defines spells, or that mixes
 * in entity kinds we do not model, still yields everything we do understand.
 *
 * @param {unknown} json parsed 5etools brew JSON
 * @returns {{ name: string, author: string, monsters: object[], spells: object[], items: object[], rules: object[], warnings: string[] }}
 */
export function convertBrew (json) {
	const warnings = []
	if (typeof json !== 'object' || json === null) throw new Error('5etools brew dosyası bir JSON nesnesi değil.')

	const doc = /** @type {Record<string, any>} */ (json)
	const titles = brewSourceTitles(doc)
	const meta = doc._meta ?? {}
	const firstSource = (meta.sources ?? [])[0] ?? {}
	const packName = firstSource.full ?? firstSource.abbreviation ?? firstSource.json ?? 'Adsız 5etools derlemesi'
	const author = Array.isArray(meta.dateAdded) ? '' : (firstSource.authors ?? []).join(', ')

	const titleFor = (src) => titles[src] ?? String(src ?? packName)
	const common = (src) => ({ sourceTitle: titleFor(src), homebrew: true, docSlug: docSlug(src ?? packName) })

	const resolve = (list) => {
		const arr = Array.isArray(list) ? list : []
		return arr.map((e) => (e?._copy ? applyCopy(e, arr) : e))
	}

	const monsters = []
	for (const m of resolve(doc.monster)) {
		if (!m?.name) { warnings.push('İsimsiz bir yaratık atlandı.'); continue }
		try {
			monsters.push(convertMonster(m, common(m.source)))
		} catch (err) {
			warnings.push(`"${m.name}" dönüştürülemedi: ${err instanceof Error ? err.message : 'hata'}`)
		}
	}

	const spells = []
	for (const s of resolve(doc.spell)) {
		if (!s?.name) { warnings.push('İsimsiz bir büyü atlandı.'); continue }
		try {
			spells.push(convertSpell(s, common(s.source)))
		} catch (err) {
			warnings.push(`"${s.name}" dönüştürülemedi: ${err instanceof Error ? err.message : 'hata'}`)
		}
	}

	const items = []
	for (const it of resolve([...(doc.item ?? []), ...(doc.baseitem ?? [])])) {
		if (!it?.name) continue
		try {
			items.push(convertItem(it, common(it.source)))
		} catch (err) {
			warnings.push(`"${it.name}" dönüştürülemedi: ${err instanceof Error ? err.message : 'hata'}`)
		}
	}

	const rules = []
	for (const [key, kind] of [['condition', 'condition'], ['disease', 'disease'], ['action', 'action'], ['variantrule', 'variantrule']]) {
		for (const r of doc[key] ?? []) {
			if (!r?.name) continue
			rules.push(convertRule(r, { ...common(r.source), kind }))
		}
	}

	for (const list of [monsters, spells, items, rules]) dedupeSlugs(list)

	return { name: packName, author, monsters, spells, items, rules, warnings }
}
