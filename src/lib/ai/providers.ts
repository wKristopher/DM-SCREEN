/**
 * Multi-provider LLM bridge.
 *
 * Anthropic, OpenAI and Gemini all stream over SSE and all three send CORS
 * headers that permit a direct browser call (verified against each endpoint's
 * preflight), so one thin fetch layer serves all of them. That is why there is
 * no vendor SDK here: three SDKs would be three bundles and three shapes of
 * error, for what is ultimately one POST and one line-parser per provider.
 *
 * Keys live only in the user's browser and go straight to the vendor.
 */

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'compatible'

export interface ModelOption {
  id: string
  label: string
  note?: string
}

export interface ProviderDef {
  id: ProviderId
  label: string
  models: ModelOption[]
  defaultModel: string
  keyPlaceholder: string
  keyUrl: string
  /** Shown under the key field. */
  hint: string
  /** Custom base URL is meaningful for this provider. */
  configurableBaseUrl?: boolean
  defaultBaseUrl: string
  /** A local server needs no vendor key at all — Ollama, mainly. */
  noKeyRequired?: boolean
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5', note: 'en yetenekli' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'dengeli' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'en hızlı' },
    ],
    defaultModel: 'claude-opus-5',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    hint: 'console.anthropic.com → API Keys',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT',
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', note: 'amiral gemisi' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', note: 'dengeli' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', note: 'en ucuz' },
    ],
    defaultModel: 'gpt-5.6-terra',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    hint: 'platform.openai.com → API keys',
    defaultBaseUrl: 'https://api.openai.com',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    models: [
      // Flash-Lite leads because it is the better table default by a wide
      // margin: ~1s per generation against ~5-9s, and the free tier allows
      // only 20 requests a day on 3.6 Flash — a single session burns through
      // that. Measured, not assumed.
      { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', note: 'en hızlı · ücretsiz kotası geniş' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', note: 'daha iyi metin · ücretsizde 20 istek/gün' },
    ],
    defaultModel: 'gemini-3.5-flash-lite',
    // Google issues both AIza… and AQ.… keys; anchoring on one makes the other
    // look wrong to anyone pasting it in.
    keyPlaceholder: 'AIza… veya AQ.…',
    keyUrl: 'https://aistudio.google.com/apikey',
    hint: 'aistudio.google.com → Get API key',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    // No fixed list — whatever you've pulled locally is what shows up. The
    // settings panel fetches the real list from the server itself.
    models: [],
    defaultModel: '',
    keyPlaceholder: '',
    keyUrl: 'https://ollama.com/download',
    hint: 'Bilgisayarında çalışan Ollama sunucusu — anahtar gerekmez. Tarayıcıdan erişim engelleniyorsa Ollama’yı OLLAMA_ORIGINS=* ile başlat.',
    configurableBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    noKeyRequired: true,
  },
  compatible: {
    id: 'compatible',
    label: 'OpenAI uyumlu',
    models: [],
    defaultModel: '',
    keyPlaceholder: 'anahtar',
    keyUrl: 'https://openrouter.ai/keys',
    hint: 'OpenRouter, Groq, Together, LM Studio… /v1 ile biten adres',
    configurableBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api',
  },
}

export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama', 'compatible']

/* ------------------------------------------------------------------ request */

export interface LlmConfig {
  provider: ProviderId
  apiKey: string
  model: string
  baseUrl?: string
}

interface BuiltRequest {
  url: string
  headers: Record<string, string>
  body: unknown
  /** Pull the text delta out of one parsed SSE payload. */
  extract: (payload: Record<string, unknown>) => string
}

const MAX_OUTPUT_TOKENS = 4096

/**
 * How long to wait for the provider to start answering.
 *
 * Generous on purpose: a thinking model sends nothing at all while it reasons,
 * and measured runs put the slowest first byte well past twenty seconds. The
 * "Durdur" button is the user's escape hatch — this deadline only exists to
 * stop a dead connection from spinning forever.
 */
const CONNECT_TIMEOUT_MS = 60_000

/** How long a stream may go silent mid-answer before we call it dead. */
const STALL_TIMEOUT_MS = 30_000

function buildRequest(cfg: LlmConfig, system: string, user: string): BuiltRequest {
  const base = (cfg.baseUrl || PROVIDERS[cfg.provider].defaultBaseUrl).replace(/\/+$/, '')

  switch (cfg.provider) {
    case 'anthropic':
      return {
        url: `${base}/v1/messages`,
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          // Required for a browser-originated call; without it the API rejects
          // the request rather than the browser blocking it.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: {
          model: cfg.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          stream: true,
          // Flavour text does not need deep reasoning, and the table is waiting.
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: user }],
        },
        extract: (p) => {
          const delta = p.delta as { type?: string; text?: string } | undefined
          return p.type === 'content_block_delta' && delta?.type === 'text_delta' ? (delta.text ?? '') : ''
        },
      }

    case 'gemini':
      return {
        url: `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`,
        headers: {
          'content-type': 'application/json',
          // Header auth rather than ?key= so the secret stays out of URLs and logs.
          'x-goog-api-key': cfg.apiKey,
        },
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Same call as Anthropic's low effort: flavour text does not need
            // deep reasoning, and thinking is pure latency at the table —
            // it delayed the first byte past half a minute on some prompts.
            thinkingConfig: { thinkingLevel: 'low' },
          },
        },
        extract: (p) => {
          const candidates = p.candidates as
            | Array<{ content?: { parts?: Array<{ text?: string }> } }>
            | undefined
          return candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? ''
        },
      }

    // OpenAI and anything speaking its dialect (OpenRouter, Groq, Ollama's
    // own OpenAI-compatible endpoint…) all take the same request shape.
    case 'openai':
    case 'ollama':
    case 'compatible':
    default:
      return {
        url: `${base}/v1/chat/completions`,
        headers: {
          'content-type': 'application/json',
          // Ollama ignores this outright — it has no concept of a key — but
          // sending it costs nothing and keeps the code path shared.
          authorization: `Bearer ${cfg.apiKey}`,
        },
        body: {
          model: cfg.model,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        extract: (p) => {
          const choices = p.choices as Array<{ delta?: { content?: string } }> | undefined
          return choices?.[0]?.delta?.content ?? ''
        },
      }
  }
}

/* ------------------------------------------------------------------ streaming */

export class LlmError extends Error {}

/**
 * Read an SSE body, handing each text delta to `onDelta`.
 *
 * Written against the raw stream rather than a library because the three
 * providers differ only in which field holds the text — the framing is the same.
 */
async function readSse(
  res: Response,
  extract: BuiltRequest['extract'],
  onDelta: (text: string) => void,
): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) throw new LlmError('Yanıt akışı okunamadı.')

  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  const consume = (event: string) => {
    // Lines may carry a trailing \r; trim() below takes care of it.
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const text = extract(JSON.parse(data) as Record<string, unknown>)
        if (text) {
          full += text
          onDelta(text)
        }
      } catch {
        // A malformed frame is not worth aborting a whole generation over.
      }
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Events are separated by a blank line — but "blank" is CRLF CRLF as often
    // as LF LF. Gemini uses the CRLF form, and splitting on '\n\n' alone finds
    // no boundary in it at all: every event stays stuck in the buffer and the
    // stream ends having yielded nothing, with no error to explain why.
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''
    for (const event of events) consume(event)
  }

  // Flush whatever multi-byte character was mid-decode, then the tail. A
  // provider that ends its last event without a trailing blank line would
  // otherwise lose it — silently, which is the worst way to lose it.
  buffer += decoder.decode()
  if (buffer.trim()) consume(buffer)

  return full
}

/** Pull a human-usable message out of whatever error shape the provider sent. */
function describeError(status: number, raw: string, provider: ProviderId): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; type?: string }
      message?: string
    }
    const msg = parsed.error?.message ?? parsed.message
    if (msg) return msg
  } catch {
    /* not JSON — fall through */
  }
  if (status === 401 || status === 403) return 'API anahtarı geçersiz veya yetkisiz.'
  if (status === 404) return `Model bulunamadı — ${PROVIDERS[provider].label} için model adını kontrol et.`
  if (status === 429) return 'Hız sınırına takıldın. Biraz bekleyip tekrar dene.'
  if (status >= 500) return 'Sağlayıcı tarafında geçici bir hata.'
  return `Beklenmeyen yanıt (${status}).`
}

export interface RunOptions {
  signal?: AbortSignal
  onDelta?: (text: string) => void
  /** Wait for the first byte. Defaults to CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number
  /** Longest silence tolerated mid-stream. Defaults to STALL_TIMEOUT_MS. */
  stallTimeoutMs?: number
}

export async function runCompletion(
  cfg: LlmConfig,
  system: string,
  user: string,
  opts: RunOptions = {},
): Promise<string> {
  if (!cfg.apiKey.trim() && !PROVIDERS[cfg.provider].noKeyRequired) throw new LlmError('API anahtarı girilmemiş.')
  if (!cfg.model.trim()) throw new LlmError('Model seçilmemiş.')

  const req = buildRequest(cfg, system, user)

  // Two separate deadlines, because generations are legitimately slow but
  // silence is not. A single overall cap would cut off a long answer that is
  // arriving fine; a stall timer only fires when nothing has moved at all.
  const ctl = new AbortController()
  const relay = () => ctl.abort()
  opts.signal?.addEventListener('abort', relay, { once: true })
  if (opts.signal?.aborted) ctl.abort()

  let timer: ReturnType<typeof setTimeout> | undefined
  let expired = false
  const arm = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      expired = true
      ctl.abort()
    }, ms)
  }
  const disarm = () => {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', relay)
  }

  /** Turn an abort into the reason it actually happened for. */
  const abortReason = (): LlmError =>
    expired
      ? new LlmError('Sağlayıcı yanıt vermedi. Ağını, anahtarını ve adresi kontrol et.')
      : new LlmError('İptal edildi.')

  const connectMs = opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS
  const stallMs = opts.stallTimeoutMs ?? STALL_TIMEOUT_MS

  let res: Response
  arm(connectMs)
  try {
    res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: ctl.signal,
    })
  } catch (err) {
    disarm()
    if (err instanceof DOMException && err.name === 'AbortError') throw abortReason()
    // A local server that isn't running fails the same way a typo'd address
    // does — no CORS header, no status code, just a dead fetch — so name the
    // likely causes instead of a bare "bağlantı kurulamadı".
    if (cfg.provider === 'ollama') {
      throw new LlmError(
        'Ollama’ya ulaşılamadı. Sunucu çalışıyor mu, adres doğru mu, ve tarayıcıdan erişime izin veriyor mu ' +
          '(OLLAMA_ORIGINS=* ile başlatmayı dene)?',
      )
    }
    // OpenAI omits CORS headers on its error responses, so an invalid key
    // surfaces here as an opaque network failure rather than a readable 401.
    if (cfg.provider === 'openai' || cfg.provider === 'compatible') {
      throw new LlmError(
        'Bağlantı kurulamadı. En olası sebep geçersiz API anahtarı — ' +
          'OpenAI hata yanıtlarında CORS başlığı göndermediği için tarayıcı ayrıntıyı gizliyor.',
      )
    }
    throw new LlmError('Bağlantı kurulamadı. İnternetini ve adresi kontrol et.')
  }

  if (!res.ok) {
    disarm()
    const raw = await res.text().catch(() => '')
    throw new LlmError(describeError(res.status, raw, cfg.provider))
  }

  const onDelta = opts.onDelta ?? (() => {})
  try {
    // Every delta pushes the deadline out, so a stream that is still talking
    // is never interrupted and one that went quiet does not hang the button.
    arm(stallMs)
    const out = await readSse(res, req.extract, (text) => {
      arm(stallMs)
      onDelta(text)
    })
    return out.trim()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw abortReason()
    throw err instanceof LlmError ? err : new LlmError('Yanıt akışı yarıda kesildi.')
  } finally {
    disarm()
  }
}

/** Cheap round trip used by the "test connection" button. */
export async function testConnection(cfg: LlmConfig): Promise<string> {
  const started = performance.now()
  const out = await runCompletion(cfg, 'Kısa cevap ver.', 'Sadece "bağlandı" yaz.')
  const ms = Math.round(performance.now() - started)

  // An empty stream used to be reported as "yanıt alındı", which read as
  // success — and that is exactly how a CRLF parsing bug hid here for a while.
  // No text means something is wrong, so say so.
  if (!out.trim()) {
    throw new LlmError(`Sunucuya ulaşıldı (${ms}ms) ama yanıt boş döndü — model adını kontrol et.`)
  }

  return `${out.slice(0, 40)} · ${ms}ms`
}

/* ------------------------------------------------------------------ ollama */

export interface OllamaModel {
  name: string
  sizeBytes?: number
}

/**
 * Ask a local Ollama server which models it actually has pulled.
 *
 * There is no fixed model list for Ollama in `PROVIDERS` because there
 * shouldn't be one — whatever the person has run `ollama pull` on is the
 * whole list, and it changes as they pull or remove things. `/api/tags` is
 * Ollama's own endpoint (not the OpenAI-compatible one) and answers with
 * exactly that, instantly and without a completion.
 */
export async function listOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  const base = (baseUrl || PROVIDERS.ollama.defaultBaseUrl).replace(/\/+$/, '')

  let res: Response
  try {
    res = await fetch(`${base}/api/tags`)
  } catch {
    throw new LlmError(
      'Ollama’ya ulaşılamadı. Sunucu çalışıyor mu, adres doğru mu, ve tarayıcıdan erişime izin veriyor mu ' +
        '(OLLAMA_ORIGINS=* ile başlatmayı dene)?',
    )
  }
  if (!res.ok) throw new LlmError(`Ollama yanıt vermedi (${res.status}).`)

  const data = (await res.json()) as { models?: Array<{ name?: unknown; size?: unknown }> }
  const models = (data.models ?? [])
    .map((m) => ({
      name: typeof m.name === 'string' ? m.name : '',
      sizeBytes: typeof m.size === 'number' ? m.size : undefined,
    }))
    .filter((m) => m.name)

  models.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  return models
}
