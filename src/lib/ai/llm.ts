/**
 * Prompt layer for the optional LLM assistant.
 *
 * The local oracle handles everything the table needs at speed. This adds the
 * one thing tables can't do: freeform prose in your campaign's own voice —
 * through whichever provider the DM has a key for.
 */

import { runCompletion, LlmError, type LlmConfig, type RunOptions } from './providers'

export type LlmTask = 'narrate' | 'npc-voice' | 'expand' | 'improvise' | 'recap' | 'ask'

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
  ask: 'DM sana doğrudan bir soru soruyor — komut çubuğuna yazdı. Kısa, net ve masada hemen kullanılabilir bir cevap ver. Kural sorusuysa ve emin değilsen, uydurmak yerine emin olmadığını söyle.',
}

export const LLM_TASK_LABELS: Record<LlmTask, string> = {
  narrate: 'Betimle',
  'npc-voice': 'NPC replikleri',
  expand: 'Sahneye çevir',
  improvise: 'Doğaçla',
  recap: 'Seans özeti',
  ask: 'Kâhine sor',
}

export async function runLlm(
  cfg: LlmConfig,
  task: LlmTask,
  context: string,
  opts: RunOptions = {},
): Promise<string> {
  return runCompletion(cfg, SYSTEM_PROMPT, `${TASK_PROMPTS[task]}\n\n---\n${context}`, opts)
}

export { LlmError }
export type { LlmConfig }
