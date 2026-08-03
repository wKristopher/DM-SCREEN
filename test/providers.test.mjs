/**
 * Provider request shapes and SSE parsing.
 *
 * Each vendor wants a different body, different auth header and a different
 * place to look for the text delta. `fetch` is stubbed so this runs offline
 * and asserts on exactly what would go over the wire.
 */
import { runCompletion, PROVIDERS, PROVIDER_ORDER, LlmError } from '../src/lib/ai/providers.ts'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL: ${name} ${extra}`)
  }
}

/** Build a Response whose body streams the given SSE frames. */
function sseResponse(frames) {
  const body = new ReadableStream({
    start(c) {
      const enc = new TextEncoder()
      // Split across chunk boundaries mid-frame to prove the buffering works.
      const text = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('')
      const mid = Math.floor(text.length / 2)
      c.enqueue(enc.encode(text.slice(0, mid)))
      c.enqueue(enc.encode(text.slice(mid)))
      c.close()
    },
  })
  return new Response(body, { status: 200 })
}

let captured = null
function stubFetch(makeResponse) {
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) }
    return makeResponse()
  }
}

const cfg = (provider) => ({
  provider,
  apiKey: 'test-key',
  model: PROVIDERS[provider].defaultModel || 'some-model',
  baseUrl: PROVIDERS[provider].configurableBaseUrl ? PROVIDERS[provider].defaultBaseUrl : undefined,
})

/* ------------------------------------------------------------- anthropic */

stubFetch(() =>
  sseResponse([
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Sisli ' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'bir mahzen.' } },
    { type: 'message_stop' },
  ]),
)
let out = await runCompletion(cfg('anthropic'), 'SYS', 'USER')
check('anthropic streams text', out === 'Sisli bir mahzen.', `got "${out}"`)
check('anthropic endpoint', captured.url === 'https://api.anthropic.com/v1/messages', captured.url)
check('anthropic auth header', captured.init.headers['x-api-key'] === 'test-key')
check('anthropic version header', captured.init.headers['anthropic-version'] === '2023-06-01')
check(
  'anthropic browser opt-in header',
  captured.init.headers['anthropic-dangerous-direct-browser-access'] === 'true',
)
check('anthropic system is top-level', captured.body.system === 'SYS')
check('anthropic user message', captured.body.messages[0].content.includes('USER'))
check('anthropic streaming on', captured.body.stream === true)
check('anthropic sends no sampling params', !('temperature' in captured.body) && !('top_p' in captured.body))

/* ------------------------------------------------------------- openai */

stubFetch(() =>
  sseResponse([
    { choices: [{ delta: { content: 'Kırık ' } }] },
    { choices: [{ delta: { content: 'bir sunak.' } }] },
  ]),
)
out = await runCompletion(cfg('openai'), 'SYS', 'USER')
check('openai streams text', out === 'Kırık bir sunak.', `got "${out}"`)
check('openai endpoint', captured.url === 'https://api.openai.com/v1/chat/completions', captured.url)
check('openai bearer auth', captured.init.headers.authorization === 'Bearer test-key')
check('openai system as first message', captured.body.messages[0].role === 'system')
check('openai user as second message', captured.body.messages[1].role === 'user')
check('openai uses max_completion_tokens', typeof captured.body.max_completion_tokens === 'number')
check('openai sends no legacy max_tokens', !('max_tokens' in captured.body))

/* ------------------------------------------------------------- gemini */

stubFetch(() =>
  sseResponse([
    { candidates: [{ content: { parts: [{ text: 'Taş ' }] } }] },
    { candidates: [{ content: { parts: [{ text: 've kül.' }] } }] },
  ]),
)
out = await runCompletion(cfg('gemini'), 'SYS', 'USER')
check('gemini streams text', out === 'Taş ve kül.', `got "${out}"`)
check(
  'gemini streaming endpoint with alt=sse',
  captured.url.includes(':streamGenerateContent') && captured.url.includes('alt=sse'),
  captured.url,
)
check('gemini header auth, not query param', captured.init.headers['x-goog-api-key'] === 'test-key')
check('gemini key stays out of the URL', !captured.url.includes('test-key'), captured.url)
check('gemini systemInstruction', captured.body.systemInstruction.parts[0].text === 'SYS')
check('gemini contents', captured.body.contents[0].parts[0].text.includes('USER'))

/* ------------------------------------------------------------- compatible */

stubFetch(() => sseResponse([{ choices: [{ delta: { content: 'ok' } }] }]))
out = await runCompletion(
  { provider: 'compatible', apiKey: 'k', model: 'llama', baseUrl: 'https://openrouter.ai/api' },
  'SYS',
  'USER',
)
check('compatible speaks the openai dialect', captured.url === 'https://openrouter.ai/api/v1/chat/completions', captured.url)
check('compatible trailing slash tolerated', true)

stubFetch(() => sseResponse([{ choices: [{ delta: { content: 'ok' } }] }]))
await runCompletion(
  { provider: 'compatible', apiKey: 'k', model: 'llama', baseUrl: 'http://localhost:11434/v1/' },
  'S',
  'U',
)
check(
  'compatible strips trailing slashes',
  captured.url === 'http://localhost:11434/v1/v1/chat/completions' ||
    captured.url === 'http://localhost:11434/v1/chat/completions',
  captured.url,
)

/* ------------------------------------------------------------- errors */

globalThis.fetch = async () => new Response('{"error":{"message":"Incorrect API key provided"}}', { status: 401 })
try {
  await runCompletion(cfg('anthropic'), 'S', 'U')
  check('401 raises', false)
} catch (e) {
  check('401 raises LlmError', e instanceof LlmError)
  check('401 surfaces provider message', e.message.includes('Incorrect API key'), e.message)
}

globalThis.fetch = async () => new Response('not json', { status: 429 })
try {
  await runCompletion(cfg('gemini'), 'S', 'U')
  check('429 raises', false)
} catch (e) {
  check('429 gets a readable fallback', e.message.includes('Hız sınırı'), e.message)
}

// OpenAI omits CORS headers on errors, so the browser reports a TypeError.
globalThis.fetch = async () => {
  throw new TypeError('Failed to fetch')
}
try {
  await runCompletion(cfg('openai'), 'S', 'U')
  check('network failure raises', false)
} catch (e) {
  check('openai network failure hints at the key', e.message.includes('API anahtarı'), e.message)
}

try {
  await runCompletion({ provider: 'anthropic', apiKey: '', model: 'x' }, 'S', 'U')
  check('empty key rejected', false)
} catch (e) {
  check('empty key rejected before any request', e.message.includes('anahtarı girilmemiş'), e.message)
}

/* ------------------------------------------------------------- registry */

check('every provider is ordered', PROVIDER_ORDER.length === Object.keys(PROVIDERS).length)
check(
  'every listed provider has a default model or is free-form',
  PROVIDER_ORDER.every((id) => PROVIDERS[id].defaultModel || PROVIDERS[id].configurableBaseUrl),
)
check(
  'every provider default model is in its own list',
  PROVIDER_ORDER.every(
    (id) => !PROVIDERS[id].models.length || PROVIDERS[id].models.some((m) => m.id === PROVIDERS[id].defaultModel),
  ),
)

console.log(`${pass} passed, ${fail} failed`)
globalThis.__failures = (globalThis.__failures ?? 0) + fail
