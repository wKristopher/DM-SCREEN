// Bundle the .ts test entries with rolldown, then run them in Node.
import { rolldown } from 'rolldown'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'kahin-test-'))

for (const entry of process.argv.slice(2)) {
  const bundle = await rolldown({ input: entry, platform: 'node' })
  const { output } = await bundle.generate({ format: 'esm' })
  const file = join(dir, entry.replace(/[^\w]/g, '_') + '.mjs')
  writeFileSync(file, output[0].code)
  console.log(`\n=== ${entry} ===`)
  await import(pathToFileURL(file).href)
}

const failures = globalThis.__failures ?? 0
console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)'}`)
process.exit(failures ? 1 : 0)
