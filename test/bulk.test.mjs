/**
 * Folder import: what each file is taken to be, and which pack it lands in.
 *
 * `File` is a web type Node has had since 20, and `importFiles` only ever calls
 * `.text()` and reads `webkitRelativePath`, so the real function runs here
 * against real File objects rather than a stand-in.
 */
import { importFiles, sniffKind, folderOf, packNameFor, MAX_FILES } from '../src/lib/bulk.ts'
import { BREW_FORMAT, countEntries } from '../src/lib/homebrew.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

/** A File that reports a folder path, the way a directory picker produces one. */
function file(path, content) {
  const name = path.split('/').pop()
  const body = typeof content === 'string' ? content : JSON.stringify(content)
  // Type follows the extension, as a real picker reports it — a helper that
  // labelled everything application/json would hide the non-JSON path.
  const type = /\.json$/i.test(name) ? 'application/json' : 'text/plain'
  const f = new File([body], name, { type })
  Object.defineProperty(f, 'webkitRelativePath', { value: path })
  return f
}

const goblin = { name: 'Goblin Şef', armor_class: 15, hit_points: 21, challenge_rating: '1' }
const fireball = { name: 'Alev Topu', level: 3, school: 'evocation', casting_time: '1 action', components: 'V, S, M' }
const sword = { name: 'Yakan Kılıç', rarity: 'rare', requires_attunement: 'yes' }
const table = { name: 'Meyhane adları', rows: ['Kırık Fıçı', 'Sarhoş Ejderha'] }
const npc = { name: 'Rahip Doran', motivation: 'Borcunu ödemek', quirk: 'Sürekli öksürür' }

/* ------------------------------------------------------------------ sniffing */

check('a monster is recognised', sniffKind(goblin) === 'monster')
check('a spell is recognised', sniffKind(fireball) === 'spell')
check('an item is recognised', sniffKind(sword) === 'item')
check('a table is recognised', sniffKind(table) === 'table')
check('an npc is recognised', sniffKind(npc) === 'npc')

// A monster also has a `type` and often a `level`-adjacent field; the vote has
// to go to the field only monsters carry.
check('challenge_rating outweighs anything a spell shares', sniffKind({ name: 'x', challenge_rating: '2', level: 5 }) === 'monster')
check('an unnamed object is nothing', sniffKind({ armor_class: 12 }) === null)
check('a blank name is nothing', sniffKind({ name: '   ', armor_class: 12 }) === null)
check('a bare string is nothing', sniffKind('goblin') === null)
check('an array is nothing', sniffKind([goblin]) === null)
check('null is nothing', sniffKind(null) === null)
check('an unrecognisable object is nothing', sniffKind({ name: 'x', colour: 'blue' }) === null)

/* ------------------------------------------------------------------ paths */

check('folderOf finds the directory', folderOf('Kampanya/Yaratıklar/goblin.json') === 'Kampanya/Yaratıklar')
check('folderOf on a loose file is empty', folderOf('goblin.json') === '')
check('packNameFor uses the leaf folder', packNameFor('Kampanya/Yaratıklar', 'x') === 'Yaratıklar')
check('packNameFor falls back when there is no folder', packNameFor('', 'Yedek ad') === 'Yedek ad')

/* ------------------------------------------------------------------ grouping */

{
  const r = await importFiles([
    file('Kampanya/Yaratıklar/goblin.json', goblin),
    file('Kampanya/Yaratıklar/troll.json', { name: 'Troll', hit_points: 84, challenge_rating: '5' }),
    file('Kampanya/Büyüler/alev.json', fireball),
  ])
  check('one pack per folder', r.packs.length === 2, `got ${r.packs.length}`)
  const yaratik = r.packs.find((p) => p.name === 'Yaratıklar')
  const buyu = r.packs.find((p) => p.name === 'Büyüler')
  check('the pack is named after its folder', !!yaratik && !!buyu)
  check('both monsters land together', yaratik?.monsters.length === 2)
  check('the spell lands in its own folder', buyu?.spells.length === 1)
  check('entries keep their names', yaratik?.monsters[0].name === 'Goblin Şef')
  check('nothing was skipped', r.skipped.length === 0, JSON.stringify(r.skipped))
  check('every file was counted', r.scanned === 3)
}

/* ------------------------------------------------------------------ packs */

{
  // A file that is already a pack keeps its own name rather than being folded
  // into a pack named after the folder it happened to be sitting in.
  const r = await importFiles([
    file('Karışık/benim-derlemem.json', {
      format: BREW_FORMAT,
      name: 'Ejderha Kitabı',
      monsters: [{ name: 'Genç Kızıl Ejderha', challenge_rating: '10' }],
    }),
    file('Karışık/kilic.json', sword),
  ])
  check('a real pack keeps its own name', r.packs.some((p) => p.name === 'Ejderha Kitabı'))
  check('loose files still gather under the folder', r.packs.some((p) => p.name === 'Karışık'))
  check('both arrive', r.packs.length === 2, `got ${r.packs.length}`)
}

/* ------------------------------------------------------------------ arrays */

{
  const r = await importFiles([file('Toplu/hepsi.json', [goblin, { name: 'İblis', challenge_rating: '3' }])])
  check('an array of entries is unpacked', r.packs[0]?.monsters.length === 2)
}

{
  const r = await importFiles([file('Toplu/karisik.json', [goblin, 'çöp', 42])])
  check('unreadable array members are skipped, not fatal', r.packs[0]?.monsters.length === 1)
  check('and they are reported', r.warnings.length === 1, JSON.stringify(r.warnings))
}

/* ------------------------------------------------------------------ skipping */

{
  const r = await importFiles([
    file('x/okunur.json', goblin),
    file('x/bozuk.json', '{ this is not json'),
    file('x/notlar.txt', 'düz metin'),
    file('x/bos.json', { name: 'x', colour: 'blue' }),
    file('x/yedek.json', { format: 'kahin-backup/1', data: {} }),
  ])
  check('the good file still imports', r.packs.length === 1 && countEntries(r.packs[0]) === 1)
  check('four files are skipped', r.skipped.length === 4, JSON.stringify(r.skipped.map((s) => s.path)))

  const reason = (p) => r.skipped.find((s) => s.path.endsWith(p))?.reason ?? ''
  check('broken JSON says so', /Bozuk/.test(reason('bozuk.json')), reason('bozuk.json'))
  check('a non-JSON file says so', /JSON değil/.test(reason('notlar.txt')), reason('notlar.txt'))
  check('an unrecognised file says so', /Tanınmayan/.test(reason('bos.json')), reason('bos.json'))
  // The most useful skip message in the set: a backup dropped in a homebrew
  // folder is a plausible mistake, so it points at the tab that handles it.
  check('a backup file is named and redirected', /Kampanya/.test(reason('yedek.json')), reason('yedek.json'))
}

/* ------------------------------------------------------------------ limits */

{
  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => file(`big/m${i}.json`, goblin))
  let threw = null
  try {
    await importFiles(many)
  } catch (e) {
    threw = e
  }
  check('an implausibly large folder is refused', !!threw)
  check('and the refusal says the limit', threw && String(threw.message).includes(String(MAX_FILES)), threw?.message)
}

{
  const r = await importFiles([])
  check('an empty selection is not an error', r.packs.length === 0 && r.scanned === 0)
}

/* ------------------------------------------------------------------ shape */

{
  // A pack-shaped file without our format stamp should still be salvaged —
  // that is the whole point of the tolerant parser.
  const r = await importFiles([file('y/foreign.json', { name: 'Başka Araç', monsters: [goblin] })])
  check('a foreign pack shape is salvaged', r.packs.length === 1 && r.packs[0].monsters.length === 1)
}

{
  const r = await importFiles([file('goblin.json', goblin)])
  check('a file with no folder still imports', r.packs.length === 1)
  check('and gets the fallback name', r.packs[0].name === 'İçe aktarılan', r.packs[0].name)
}

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
