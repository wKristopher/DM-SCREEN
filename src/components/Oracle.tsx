/**
 * The oracle: one command bar that routes to dice, generators, or lookups,
 * plus a panel of one-tap generators.
 *
 * The routing runs locally and synchronously — a DM typing "npc" mid-sentence
 * gets an answer before they finish the sentence.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseIntent, COMMAND_HINTS, type GeneratorKey } from '../lib/ai/oracle'
import * as G from '../lib/ai/generators'
import type { OracleResult, ExtraTables } from '../lib/ai/generators'
import { ENVIRONMENTS, type Environment } from '../lib/ai/tables'
import { runLlm, LLM_TASK_LABELS, LlmError, type LlmTask } from '../lib/ai/llm'
import { roll } from '../lib/dice'
import { useStore, useExtraTables, useStandaloneTables } from '../store/useStore'
import { useUi } from '../store/useUi'
import { Icons, Panel, Empty, RichText } from './ui'

/* ------------------------------------------------------------------ runner */

/** Execute a generator key against the merged built-in + homebrew tables. */
export function runGenerator(
  what: GeneratorKey,
  extra: ExtraTables,
  args: Record<string, string | number> = {},
): OracleResult {
  switch (what) {
    case 'npc':
      return G.generateNpc({ extra })
    case 'tavern':
      return G.generateTavern(extra)
    case 'hook':
      return G.generatePlotHook(extra)
    case 'rumor':
      return G.generateRumor(extra)
    case 'room':
      return G.generateRoom(extra)
    case 'settlement':
      return G.generateSettlement(extra)
    case 'dungeon':
      return G.generateDungeon(extra)
    case 'trap':
      return G.generateTrap(extra)
    case 'weather':
      return G.generateWeather()
    case 'treasure':
      return G.generateTreasure(typeof args.cr === 'number' ? args.cr : 5, extra)
    case 'shop':
      return G.generateShop(extra)
    case 'name':
      return {
        kind: 'name',
        accent: 'sage',
        title: G.generateName(),
        subtitle: 'İsim',
        fields: Array.from({ length: 5 }, () => ({ label: '·', value: G.generateName() })),
      }
    case 'encounter': {
      const seed = G.seedEncounter(
        (args.environment as Environment) ?? 'orman',
        typeof args.partyLevel === 'number' ? args.partyLevel : 3,
        typeof args.partySize === 'number' ? args.partySize : 4,
      )
      return G.encounterResult(seed)
    }
  }
}

/* ------------------------------------------------------------------ card */

const ACCENT_VAR: Record<string, string> = {
  accent: 'var(--accent)',
  sage: 'var(--sage)',
  rose: 'var(--rose)',
  violet: 'var(--violet)',
  azure: 'var(--azure)',
}

export function ResultCard({ r, onReroll }: { r: OracleResult; onReroll?: () => void }) {
  const color = ACCENT_VAR[r.accent ?? 'accent']
  const pushLog = useStore((s) => s.pushLog)

  const asText = [
    r.title,
    r.subtitle,
    ...r.fields.map((f) => `${f.label}: ${f.value}`),
    r.prose,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <article
      className="rounded-2xl p-3.5 animate-rise"
      style={{ background: 'var(--bg-deep)', borderLeft: `3px solid ${color}` }}
    >
      <header className="flex items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="panel-title font-semibold text-[0.95rem] leading-snug">{r.title}</h4>
          {r.subtitle && (
            <p className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
              {r.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onReroll && (
            <button className="btn btn-ghost btn-icon" onClick={onReroll} title="Yeniden at">
              <Icons.refresh className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            title="Seans günlüğüne kaydet"
            onClick={() => pushLog('oracle', r.title, asText)}
          >
            <Icons.pen className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {r.prose && (
        <p className="text-[0.82rem] leading-relaxed mb-2 italic" style={{ color: 'var(--ink-soft)' }}>
          {r.prose}
        </p>
      )}

      {r.fields.length > 0 && (
        <dl className="space-y-1">
          {r.fields.map((f, i) => (
            <div key={i} className="flex gap-2 text-[0.8rem] leading-snug">
              <dt className="shrink-0 w-24 font-medium" style={{ color: 'var(--ink-mute)' }}>
                {f.label}
              </dt>
              <dd style={{ color: f.emphasis ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: f.emphasis ? 550 : 400 }}>
                <RichText text={f.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ bar */

export function CommandBar() {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const extra = useExtraTables()
  const standalone = useStandaloneTables()
  const logRoll = useStore((s) => s.logRoll)
  const { pushResult, pushRoll, setLookup, setTab, setToast } = useUi()

  // "/" focuses the bar from anywhere, the way search boxes should.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      const intent = parseIntent(text, standalone.map((t) => t.name))

      switch (intent.type) {
        case 'dice': {
          const r = roll(intent.expression)
          if (r.error) {
            setToast(r.error)
          } else {
            pushRoll(r)
            logRoll(r)
            setToast(`${r.expression} → ${r.total}`)
          }
          break
        }
        case 'generate': {
          pushResult(runGenerator(intent.what, extra, intent.args))
          setTab('oracle')
          break
        }
        case 'custom-table': {
          const t = standalone.find((x) => x.name === intent.name)
          if (t) {
            pushResult(G.rollCustomTable(t.name, t.rows.filter((r) => r.trim())))
            setTab('oracle')
          }
          break
        }
        case 'oracle': {
          pushResult(G.askOracle(intent.question))
          setTab('oracle')
          break
        }
        case 'lookup': {
          if (intent.resource === 'monsters' || intent.resource === 'spells' || intent.resource === 'magicitems') {
            setLookup({ query: intent.query, resource: intent.resource })
            setTab('compendium')
          } else {
            setTab('screen')
          }
          break
        }
        default:
          setToast('Anlaşılmadı — bir zar ifadesi, yaratık adı veya "npc" gibi bir komut dene.')
      }
      setInput('')
    },
    [extra, standalone, pushResult, pushRoll, setLookup, setTab, setToast, logRoll],
  )

  return (
    <div className="relative">
      <div className="relative">
        <Icons.spark
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--accent)' }}
        />
        <input
          ref={inputRef}
          className="field pl-10 pr-14 py-2.5"
          placeholder="Kâhine sor:  4d6kh3  ·  npc  ·  goblin  ·  hazine cr 8  ·  Tuzak var mı?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 160)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(input)
            if (e.key === 'Escape') inputRef.current?.blur()
          }}
        />
        <kbd
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.62rem] px-1.5 py-0.5 rounded-md pointer-events-none"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-mute)', border: '1px solid var(--line)' }}
        >
          /
        </kbd>
      </div>

      {focused && !input && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 surface p-2 animate-rise"
          style={{ boxShadow: 'var(--shadow-lift)' }}
        >
          <div className="flex flex-wrap gap-1.5">
            {COMMAND_HINTS.map((h) => (
              <button
                key={h.label}
                className="btn btn-xs"
                onMouseDown={(e) => {
                  e.preventDefault()
                  submit(h.input)
                }}
                title={h.hint}
              >
                {h.label}
              </button>
            ))}
            {standalone.slice(0, 6).map((t) => (
              <button
                key={t.id}
                className="btn btn-xs"
                style={{ color: 'var(--violet)' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  submit(t.name)
                }}
                title="Kendi tablon"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ panel */

const GENERATORS: Array<{ key: GeneratorKey; label: string }> = [
  { key: 'npc', label: 'NPC' },
  { key: 'tavern', label: 'Meyhane' },
  { key: 'shop', label: 'Dükkân' },
  { key: 'settlement', label: 'Yerleşim' },
  { key: 'hook', label: 'Görev kancası' },
  { key: 'rumor', label: 'Dedikodu' },
  { key: 'room', label: 'Oda' },
  { key: 'dungeon', label: 'Zindan' },
  { key: 'trap', label: 'Tuzak' },
  { key: 'treasure', label: 'Hazine' },
  { key: 'weather', label: 'Hava' },
  { key: 'name', label: 'İsimler' },
]

function LlmBox() {
  const settings = useStore((s) => s.settings)
  const setTab = useUi((s) => s.setTab)
  const [task, setTask] = useState<LlmTask>('narrate')
  const [context, setContext] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!settings.llmEnabled || !settings.llmKey) {
    return (
      <div className="rounded-2xl p-3.5 text-[0.78rem]" style={{ background: 'var(--bg-deep)', color: 'var(--ink-mute)' }}>
        <p className="mb-2">
          Kâhin, yukarıdaki her şeyi <strong style={{ color: 'var(--ink-soft)' }}>internet olmadan</strong> üretir.
          İstersen bir Claude anahtarı ekleyip serbest metin (betimleme, NPC replikleri, seans özeti) de aldırabilirsin.
        </p>
        <button className="btn btn-xs" onClick={() => setTab('campaign')}>
          Ayarlara git
        </button>
      </div>
    )
  }

  const run = async () => {
    setBusy(true)
    setErr(null)
    setOut('')
    try {
      await runLlm({ apiKey: settings.llmKey, enabled: true }, task, context, (d) => setOut((p) => p + d))
    } catch (e) {
      setErr(e instanceof LlmError ? e.message : 'Beklenmeyen hata')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex gap-1.5">
        <select className="field field-sm flex-1" value={task} onChange={(e) => setTask(e.target.value as LlmTask)}>
          {(Object.keys(LLM_TASK_LABELS) as LlmTask[]).map((k) => (
            <option key={k} value={k}>
              {LLM_TASK_LABELS[k]}
            </option>
          ))}
        </select>
        <button className="btn btn-accent btn-xs" disabled={busy || !context.trim()} onClick={run}>
          {busy ? 'Yazıyor…' : 'Üret'}
        </button>
      </div>
      <textarea
        className="field text-[0.8rem] resize-y"
        rows={3}
        placeholder="Bağlam ver: 'Yosun kaplı bir mahzen, ortada kırık bir sunak' ya da bir NPC kartını yapıştır."
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
      {err && (
        <p className="text-[0.75rem] px-2 py-1 rounded-lg" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          {err}
        </p>
      )}
      {out && (
        <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>
          {out}
        </p>
      )}
    </div>
  )
}

export function OraclePanel() {
  const extra = useExtraTables()
  const standalone = useStandaloneTables()
  const { results, pushResult, clearResults } = useUi()

  const [env, setEnv] = useState<Environment>('orman')
  const [lvl, setLvl] = useState(3)
  const [size, setSize] = useState(4)
  const [cr, setCr] = useState(5)

  return (
    <Panel
      title="Kâhin"
      subtitle="Tarayıcıda çalışan üretici — anahtar gerektirmez"
      icon={<Icons.spark />}
      actions={
        results.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={clearResults}>
            Temizle
          </button>
        )
      }
      className="lg:h-full"
      bodyClass="p-3 space-y-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {GENERATORS.map((g) => (
          <button
            key={g.key}
            className="btn btn-xs"
            onClick={() => pushResult(runGenerator(g.key, extra, { cr }))}
          >
            {g.label}
          </button>
        ))}
      </div>

      {standalone.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {standalone.map((t) => (
            <button
              key={t.id}
              className="btn btn-xs"
              style={{ color: 'var(--violet)', borderColor: 'var(--violet)' }}
              onClick={() => pushResult(G.rollCustomTable(t.name, t.rows.filter((r) => r.trim())))}
            >
              {t.name} <span style={{ opacity: 0.6 }}>d{t.rows.filter((r) => r.trim()).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--bg-deep)' }}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-28">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Ortam
            </span>
            <select className="field field-sm" value={env} onChange={(e) => setEnv(e.target.value as Environment)}>
              {ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="w-16">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Seviye
            </span>
            <input
              className="field field-sm text-center"
              type="number"
              min={1}
              max={20}
              value={lvl}
              onChange={(e) => setLvl(Math.max(1, Math.min(20, +e.target.value || 1)))}
            />
          </label>
          <label className="w-16">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Kişi
            </span>
            <input
              className="field field-sm text-center"
              type="number"
              min={1}
              max={8}
              value={size}
              onChange={(e) => setSize(Math.max(1, Math.min(8, +e.target.value || 1)))}
            />
          </label>
          <button
            className="btn btn-accent btn-xs"
            onClick={() => pushResult(G.encounterResult(G.seedEncounter(env, lvl, size)))}
          >
            Karşılaşma
          </button>
        </div>
        <div className="flex items-end gap-2">
          <label className="w-20">
            <span className="block text-[0.68rem] mb-1" style={{ color: 'var(--ink-mute)' }}>
              Hazine CR
            </span>
            <input
              className="field field-sm text-center"
              type="number"
              min={0}
              max={30}
              value={cr}
              onChange={(e) => setCr(Math.max(0, Math.min(30, +e.target.value || 0)))}
            />
          </label>
          <button className="btn btn-xs" onClick={() => pushResult(G.generateTreasure(cr, extra))}>
            Hazine at
          </button>
        </div>
      </div>

      <LlmBox />

      {results.length === 0 ? (
        <Empty
          icon={<Icons.spark className="w-8 h-8" />}
          title="Kâhin sessiz"
          hint="Bir üretici seç, ya da komut çubuğuna yaz. Kendi tablolarını Ocak sekmesinden ekleyebilirsin."
        />
      ) : (
        <div className="space-y-2">
          {results.map((r, i) => (
            <ResultCard
              key={`${r.kind}-${i}-${r.title}`}
              r={r}
              onReroll={
                i === 0
                  ? () => {
                      const key = GENERATORS.find((g) => g.key === r.kind)?.key
                      if (key) pushResult(runGenerator(key, extra, { cr }))
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </Panel>
  )
}
