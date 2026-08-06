/** Party roster, session notes, the log, and settings. */

import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { clearCache, cacheStats } from '../lib/open5e'
import { passiveOf } from '../lib/character'
import { CharacterSheetView } from './CharacterSheet'
import {
  buildBackup, downloadBackup, parseBackup, summarise, formatSavedAt,
  type Backup, type BackupSummary,
} from '../lib/backup'
import { PROVIDERS, PROVIDER_ORDER, testConnection, LlmError } from '../lib/ai/providers'
import { Icons, Panel, Empty, Field, Modal } from './ui'

/* ------------------------------------------------------------------ party */

function Party() {
  const party = useStore((s) => s.party)
  const addPartyMember = useStore((s) => s.addPartyMember)
  const [openId, setOpenId] = useState<string | null>(null)

  // The number a DM checks before describing a room, so it goes in the header.
  const highest = party.length ? Math.max(...party.map((p) => passiveOf(p, 'Perception'))) : 0

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="panel-title font-semibold text-[0.9rem]">Grup</h3>
          {party.length > 0 && (
            <p className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
              En yüksek passive Perception: <strong style={{ color: 'var(--accent)' }}>{highest}</strong>
            </p>
          )}
        </div>
        <button className="btn btn-xs" onClick={addPartyMember}>
          <Icons.plus className="w-3 h-3" /> Karakter
        </button>
      </header>

      {party.length === 0 ? (
        <Empty icon={<Icons.users className="w-7 h-7" />} title="Grup boş" hint="Karakterleri bir kez gir; savaşa tek tuşla eklenirler." />
      ) : (
        <div className="space-y-1">
          {party.map((p) => (
            <button
              key={p.id}
              className="w-full rounded-xl flex items-center gap-2 px-3 py-2 text-left"
              style={{ background: 'var(--bg-deep)' }}
              onClick={() => setOpenId(p.id)}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-[0.85rem] truncate block">{p.name}</span>
                <span className="text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                  {[p.race, p.cls, p.level && `Sv. ${p.level}`, p.player && `(${p.player})`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[0.72rem]" style={{ color: 'var(--ink-mute)' }}>
                <span title="AC">
                  <Icons.shield className="w-3 h-3 inline" /> {p.ac}
                </span>
                <span title="Max HP">
                  <Icons.heart className="w-3 h-3 inline" /> {p.maxHp}
                </span>
                <span title="Passive Perception" className="chip chip-azure">
                  PP {passiveOf(p, 'Perception')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* A full sheet needs the room a sidebar column does not have. */}
      <Modal open={!!openId} onClose={() => setOpenId(null)} title="Karakter kağıdı">
        {openId && <CharacterSheetView id={openId} onClose={() => setOpenId(null)} />}
      </Modal>
    </section>
  )
}

/* ------------------------------------------------------------------ notes */

function Notes() {
  const notes = useStore((s) => s.notes)
  const setNotes = useStore((s) => s.setNotes)

  return (
    <section className="space-y-2">
      <h3 className="panel-title font-semibold text-[0.9rem]">Seans Notları</h3>
      <textarea
        className="field resize-y leading-relaxed"
        rows={10}
        placeholder="Otomatik kaydedilir. Kim ne dedi, hangi kapıyı açmadılar, sonraki sefere ne olacak…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ log */

const LOG_CHIP: Record<string, string> = {
  roll: 'chip-accent',
  combat: 'chip-rose',
  oracle: 'chip-violet',
  note: 'chip-sage',
}

function Log() {
  const log = useStore((s) => s.log)
  const clearLog = useStore((s) => s.clearLog)

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="panel-title font-semibold text-[0.9rem]">Günlük</h3>
        {log.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={clearLog}>
            Temizle
          </button>
        )}
      </header>
      {log.length === 0 ? (
        <p className="text-[0.75rem] py-4 text-center" style={{ color: 'var(--ink-mute)' }}>
          Zarlar, savaş olayları ve kaydettiğin kâhin sonuçları burada birikir.
        </p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-auto">
          {log.map((e) => (
            <div key={e.id} className="px-2.5 py-1.5 rounded-xl text-[0.75rem]" style={{ background: 'var(--bg-deep)' }}>
              <div className="flex items-baseline gap-2">
                <span className={`chip ${LOG_CHIP[e.kind] ?? 'chip-mute'}`}>{e.kind}</span>
                <span className="flex-1 min-w-0">{e.text}</span>
                <span className="shrink-0 text-[0.65rem]" style={{ color: 'var(--ink-mute)' }}>
                  {new Date(e.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {e.detail && (
                <p className="mt-0.5 whitespace-pre-wrap text-[0.7rem]" style={{ color: 'var(--ink-mute)' }}>
                  {e.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ llm */

function LlmSettingsBlock() {
  const llm = useStore((s) => s.settings.llm)
  const setSettings = useStore((s) => s.setSettings)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const def = PROVIDERS[llm.provider]
  const key = llm.keys[llm.provider] ?? ''
  const model = llm.models[llm.provider] ?? def.defaultModel

  const patch = (p: Partial<typeof llm>) => setSettings({ llm: { ...llm, ...p } })

  const runTest = async () => {
    setTesting(true)
    setResult(null)
    try {
      const text = await testConnection({
        provider: llm.provider,
        apiKey: key,
        model,
        baseUrl: def.configurableBaseUrl ? llm.baseUrl : undefined,
      })
      setResult({ ok: true, text })
    } catch (e) {
      setResult({ ok: false, text: e instanceof LlmError ? e.message : 'Beklenmeyen hata' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.82rem] font-medium">Yapay zekâ bağlantısı</p>
          <p className="text-[0.68rem]" style={{ color: 'var(--ink-mute)' }}>
            İsteğe bağlı. Kapalıyken Kâhin yine de tam çalışır.
          </p>
        </div>
        <input
          type="checkbox"
          className="w-4 h-4"
          style={{ accentColor: 'var(--accent)' }}
          checked={llm.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
      </div>

      {llm.enabled && (
        <>
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--surface-2)' }}>
            {PROVIDER_ORDER.map((id) => (
              <button
                key={id}
                className="flex-1 py-1 rounded-full text-[0.72rem] font-medium transition-all whitespace-nowrap"
                style={
                  llm.provider === id
                    ? { background: 'var(--raised)', color: 'var(--accent)', boxShadow: 'var(--shadow-soft)' }
                    : { color: 'var(--ink-mute)' }
                }
                onClick={() => {
                  patch({ provider: id })
                  setResult(null)
                }}
              >
                {PROVIDERS[id].label}
                {llm.keys[id] ? ' ✓' : ''}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              className="field field-sm font-mono"
              type={showKey ? 'text' : 'password'}
              placeholder={def.keyPlaceholder}
              value={key}
              onChange={(e) => patch({ keys: { ...llm.keys, [llm.provider]: e.target.value } })}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn-icon" onClick={() => setShowKey((v) => !v)} aria-label="Anahtarı göster">
              {showKey ? <Icons.eyeOff /> : <Icons.eye />}
            </button>
          </div>

          {def.models.length > 0 ? (
            <Field label="Model">
              <select
                className="field field-sm"
                value={model}
                onChange={(e) => patch({ models: { ...llm.models, [llm.provider]: e.target.value } })}
              >
                {def.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.note ? ` — ${m.note}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Model">
              <input
                className="field field-sm font-mono"
                placeholder="ör. meta-llama/llama-4-70b"
                value={model}
                onChange={(e) => patch({ models: { ...llm.models, [llm.provider]: e.target.value } })}
              />
            </Field>
          )}

          {def.configurableBaseUrl && (
            <Field label="Adres" hint="/v1/chat/completions bu adrese eklenir">
              <input
                className="field field-sm font-mono"
                placeholder={def.defaultBaseUrl}
                value={llm.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
              />
            </Field>
          )}

          <div className="flex items-center gap-2">
            <button className="btn btn-xs" disabled={testing || !key.trim()} onClick={runTest}>
              {testing ? 'Deneniyor…' : 'Bağlantıyı dene'}
            </button>
            {result && (
              <span
                className={`chip ${result.ok ? 'chip-sage' : 'chip-rose'} max-w-52 truncate`}
                title={result.text}
              >
                {result.text}
              </span>
            )}
          </div>

          <p className="text-[0.66rem] leading-snug" style={{ color: 'var(--ink-mute)' }}>
            Anahtar yalnızca bu tarayıcıda saklanır ve doğrudan sağlayıcıya gider — arada sunucumuz yok. Paylaşılan bir
            bilgisayardaysan işin bitince temizle.
            <br />
            {def.hint} —{' '}
            <a href={def.keyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              anahtar al ↗
            </a>
          </p>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ settings */

function SettingsBlock() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [stats, setStats] = useState(() => cacheStats())

  return (
    <section className="space-y-2.5">
      <h3 className="panel-title font-semibold text-[0.9rem]">Ayarlar</h3>

      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-deep)' }}>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-[0.82rem]">Otomatik inisiyatif</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-current"
            style={{ accentColor: 'var(--accent)' }}
            checked={settings.autoRollInitiative}
            onChange={(e) => setSettings({ autoRollInitiative: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-[0.82rem]">HP çubukları</span>
          <input
            type="checkbox"
            className="w-4 h-4"
            style={{ accentColor: 'var(--accent)' }}
            checked={settings.showHpBars}
            onChange={(e) => setSettings({ showHpBars: e.target.checked })}
          />
        </label>
      </div>

      <LlmSettingsBlock />

      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-deep)' }}>
        <p className="text-[0.82rem] font-medium">Veri kaynakları</p>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-[0.8rem]">
            Hızlı SRD aynası
            <span className="block text-[0.66rem]" style={{ color: 'var(--ink-mute)' }}>
              dnd5eapi.co ile yarıştır — sıcak bağlantıda ~65ms
            </span>
          </span>
          <input
            type="checkbox"
            className="w-4 h-4"
            style={{ accentColor: 'var(--accent)' }}
            checked={settings.fastSource}
            onChange={(e) => setSettings({ fastSource: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-[0.8rem]">
            Yanıt sürelerini göster
            <span className="block text-[0.66rem]" style={{ color: 'var(--ink-mute)' }}>
              Derleme başlığında her kaynağın ms değeri
            </span>
          </span>
          <input
            type="checkbox"
            className="w-4 h-4"
            style={{ accentColor: 'var(--accent)' }}
            checked={settings.showTimings}
            onChange={(e) => setSettings({ showTimings: e.target.checked })}
          />
        </label>
      </div>

      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-deep)' }}>
        <p className="text-[0.82rem] font-medium">Çevrimdışı yedek</p>
        <p className="text-[0.68rem]" style={{ color: 'var(--ink-mute)' }}>
          {stats.entries} sorgu · {(stats.bytes / 1024).toFixed(0)} KB. Arama her zaman canlı yapılır; bu kayıt
          yalnızca internet gittiğinde devreye girer.
        </p>
        <button
          className="btn btn-xs"
          onClick={() => {
            clearCache()
            setStats(cacheStats())
          }}
        >
          <Icons.trash className="w-3 h-3" /> Önbelleği temizle
        </button>
      </div>

      <BackupBlock />

      <p className="text-[0.66rem] leading-relaxed" style={{ color: 'var(--ink-mute)' }}>
        İçerik <strong>Open5e</strong> üzerinden gelir: SRD 5.1 ve Kobold Press gibi açık lisanslı (OGL 1.0a / CC-BY-4.0 /
        ORC) kaynaklar. Tüm veriler yalnızca bu tarayıcıda tutulur.
      </p>
    </section>
  )
}

/**
 * Backup and restore.
 *
 * Restoring overwrites a campaign, so it is deliberately a two-step: pick the
 * file, read what is actually in it, then confirm. A one-click restore that
 * silently replaces months of notes is a worse feature than none.
 */
function BackupBlock() {
  const snapshot = useStore((s) => s.snapshot)
  const restore = useStore((s) => s.restore)
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const read = async (file: File) => {
    setErr(null)
    setDone(false)
    try {
      const backup = parseBackup(await file.text())
      setPending({ backup, summary: summarise(backup) })
    } catch (e) {
      setPending(null)
      setErr(e instanceof Error ? e.message : 'Dosya okunamadı.')
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-deep)' }}>
      <p className="text-[0.82rem] font-medium">Yedekle ve geri yükle</p>
      <p className="text-[0.68rem] leading-relaxed" style={{ color: 'var(--ink-mute)' }}>
        Grup, notlar, günlük, derlemeler ve ayarlar tek dosyada. Tarayıcını temizlersen ya da başka bir
        cihazdan devam etmek istersen bu dosya her şeyi geri getirir. <strong>API anahtarların dosyaya
        yazılmaz</strong> — yedeğini paylaşman güvenli olsun diye.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        <button className="btn btn-xs" onClick={() => downloadBackup(buildBackup(snapshot()))}>
          <Icons.download className="w-3 h-3" /> Yedek indir
        </button>
        <button className="btn btn-xs" onClick={() => fileRef.current?.click()}>
          <Icons.upload className="w-3 h-3" /> Dosyadan geri yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void read(f)
            e.target.value = ''
          }}
        />
      </div>

      {err && (
        <p className="text-[0.72rem] px-2 py-1 rounded-lg" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          {err}
        </p>
      )}

      {done && (
        <p className="text-[0.72rem] px-2 py-1 rounded-lg" style={{ background: 'var(--sage-wash)', color: 'var(--sage)' }}>
          Geri yüklendi.
        </p>
      )}

      {pending && (
        <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line-soft)' }}>
          <p className="text-[0.72rem]" style={{ color: 'var(--ink-soft)' }}>
            <strong>{formatSavedAt(pending.summary.savedAt)}</strong> tarihli yedek:
          </p>
          <ul className="text-[0.7rem] space-y-0.5" style={{ color: 'var(--ink-mute)' }}>
            <li>{pending.summary.party} karakter</li>
            <li>{pending.summary.logEntries} günlük satırı</li>
            <li>{pending.summary.noteChars} karakterlik not</li>
            <li>
              {pending.summary.packs} derleme · {pending.summary.brewEntries} kayıt
            </li>
          </ul>
          <p className="text-[0.68rem]" style={{ color: 'var(--rose)' }}>
            Bu, şu andaki grubunun, notlarının ve günlüğünün yerine geçer. Önce mevcut hâlin yedeğini almak
            iyi olur.
          </p>
          <div className="flex gap-1.5">
            <button
              className="btn btn-accent btn-xs flex-1"
              onClick={() => {
                restore(pending.backup.data)
                setPending(null)
                setDone(true)
              }}
            >
              Üstüne yaz
            </button>
            <button className="btn btn-xs flex-1" onClick={() => setPending(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ panel */

export function Campaign() {
  const [danger, setDanger] = useState(false)
  const snapshot = useStore((s) => s.snapshot)

  return (
    <Panel
      title="Kampanya"
      subtitle="Grup, notlar, günlük, ayarlar"
      icon={<Icons.users />}
      className="lg:h-full"
      bodyClass="p-3"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Party />
          <Notes />
        </div>
        <div className="space-y-5">
          <Log />
          <SettingsBlock />
          <button className="btn btn-xs" style={{ color: 'var(--rose)' }} onClick={() => setDanger(true)}>
            <Icons.trash className="w-3 h-3" /> Her şeyi sıfırla
          </button>
        </div>
      </div>

      <Modal open={danger} onClose={() => setDanger(false)} title="Emin misin?">
        <p className="text-[0.85rem] mb-3" style={{ color: 'var(--ink-soft)' }}>
          Grup, notlar, günlük, homebrew derlemelerin ve ayarların dahil <strong>her şey</strong> silinir. Bu geri
          alınamaz.
        </p>
        {/* Offered right here rather than described: the moment someone is
            about to wipe a campaign is the moment a backup is worth most. */}
        <button className="btn btn-xs mb-4" onClick={() => downloadBackup(buildBackup(snapshot()))}>
          <Icons.download className="w-3 h-3" /> Önce yedeğini indir
        </button>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={() => setDanger(false)}>
            Vazgeç
          </button>
          <button
            className="btn flex-1"
            style={{ background: 'var(--rose)', color: '#fff', borderColor: 'transparent' }}
            onClick={() => {
              localStorage.clear()
              location.reload()
            }}
          >
            Sil
          </button>
        </div>
      </Modal>
    </Panel>
  )
}
