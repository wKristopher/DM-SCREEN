/**
 * Optional Claude bridge.
 *
 * The local oracle handles everything the table needs at speed. This adds the
 * one thing tables can't do: freeform prose in your campaign's own voice.
 *
 * It is strictly opt-in — the app is fully functional with no key. The SDK is
 * dynamically imported so it never lands in the main bundle for the (majority
 * of) users who never turn this on.
 */

const MODEL = 'claude-opus-5'

export interface LlmSettings {
  apiKey: string
  enabled: boolean
}

export type LlmTask =
  | 'narrate'
  | 'npc-voice'
  | 'expand'
  | 'improvise'
  | 'recap'

const SYSTEM_PROMPT = `Sen bir Dungeons & Dragons 5e oyununda Dungeon Master'a yardım eden bir yardımcısın.

Kurallar:
- Türkçe yaz. Oyun terimlerini (Perception, advantage, saving throw, AC, HP) İngilizce bırak — masada böyle konuşuluyor.
- Kısa ve masada yüksek sesle okunabilir yaz. Uzun paragraflar değil, 2-4 cümle.
- Klişeden kaç. "Kaderin çağrısı", "gölgeler fısıldıyor" gibi kalıplar kullanma.
- Somut duyusal detay ver: koku, ses, doku, sıcaklık.
- Oyuncuların ne yapacağını söyleme, ne gördüklerini söyle.
- Kural uydurma. Emin değilsen mekanik verme, sadece kurgu ver.
- Sana verilen bağlamı kullan; verilmeyeni uydurmakta özgürsün ama tutarlı kal.`

const TASK_PROMPTS: Record<LlmTask, string> = {
  narrate: 'Aşağıdakini masada yüksek sesle okunacak bir betimlemeye çevir.',
  'npc-voice': 'Bu NPC için, DM’in doğrudan kullanabileceği 3 replik yaz. Her replik karakterin sesini ve derdini yansıtsın.',
  expand: 'Aşağıdaki taslağı bir sahneye dönüştür: ne görülüyor, ne duyuluyor, ilk izlenim ne.',
  improvise: 'Oyuncular beklenmedik bir şey yaptı. DM’e üç farklı devam yolu öner — her biri tek cümle, mekanik değil kurgu.',
  recap: 'Aşağıdaki seans notlarından, bir sonraki oturumun başında okunacak kısa bir "önceki bölümde" özeti yaz.',
}

export class LlmError extends Error {}

/**
 * Stream a completion. Calls `onDelta` with incremental text.
 * Resolves with the full text.
 */
export async function runLlm(
  settings: LlmSettings,
  task: LlmTask,
  context: string,
  onDelta?: (chunk: string) => void,
): Promise<string> {
  if (!settings.enabled || !settings.apiKey) {
    throw new LlmError('Claude bağlantısı kapalı. Ayarlardan API anahtarı ekle.')
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')

  const client = new Anthropic({
    apiKey: settings.apiKey,
    // The key lives only in this browser, entered by the user who owns it.
    dangerouslyAllowBrowser: true,
  })

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Flavour text does not need deep reasoning; low effort keeps the table waiting less.
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `${TASK_PROMPTS[task]}\n\n---\n${context}` }],
    })

    let full = ''
    stream.on('text', (delta) => {
      full += delta
      onDelta?.(delta)
    })

    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') {
      throw new LlmError('Model bu isteği yanıtlamadı. İstemi değiştirip tekrar dene.')
    }

    return full.trim()
  } catch (err) {
    if (err instanceof LlmError) throw err

    // Typed SDK errors, most specific first.
    const anthropic = await import('@anthropic-ai/sdk')
    if (err instanceof anthropic.default.AuthenticationError) {
      throw new LlmError('API anahtarı geçersiz.')
    }
    if (err instanceof anthropic.default.RateLimitError) {
      throw new LlmError('Hız sınırına takıldın. Biraz bekleyip tekrar dene.')
    }
    if (err instanceof anthropic.default.APIConnectionError) {
      throw new LlmError('Bağlantı kurulamadı. İnternetini kontrol et.')
    }
    if (err instanceof anthropic.default.APIError) {
      throw new LlmError(`Claude hatası (${err.status}): ${err.message}`)
    }
    throw new LlmError(err instanceof Error ? err.message : 'Bilinmeyen hata')
  }
}

export const LLM_TASK_LABELS: Record<LlmTask, string> = {
  narrate: 'Betimle',
  'npc-voice': 'NPC replikleri',
  expand: 'Sahneye çevir',
  improvise: 'Doğaçla',
  recap: 'Seans özeti',
}
