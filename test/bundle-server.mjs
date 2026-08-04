/**
 * Bundles test/serve-local.mjs (which imports the .ts middleware and API
 * handlers) into a runnable server for the gate test.
 *
 *   node test/bundle-server.mjs && node server.built.mjs
 */
import { rolldown } from 'rolldown'
import { writeFileSync } from 'node:fs'
const bundle = await rolldown({
  input: 'test/serve-local.mjs',
  platform: 'node',
  external: ['node:http', 'node:fs/promises', 'node:path', 'node:url', 'node:crypto'],
})
const { output } = await bundle.generate({ format: 'esm' })
writeFileSync('server.built.mjs', output[0].code)
console.log('bundled ->', (output[0].code.length / 1024).toFixed(0) + 'KB')
