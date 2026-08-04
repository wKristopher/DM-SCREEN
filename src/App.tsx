import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useUi, type TabKey } from './store/useUi'
import { CommandBar, OraclePanel } from './components/Oracle'
import { CombatTracker } from './components/CombatTracker'
import { Compendium } from './components/Compendium'
import { Reference } from './components/Reference'
import { DiceTray } from './components/Dice'
import { EncounterBuilder } from './components/Encounter'
import { Campaign } from './components/Campaign'
import { Forge } from './components/Forge'
import { Icons } from './components/ui'

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'screen', label: 'Ekran', icon: <Icons.scroll /> },
  { key: 'combat', label: 'Savaş', icon: <Icons.swords /> },
  { key: 'compendium', label: 'Derleme', icon: <Icons.book /> },
  { key: 'oracle', label: 'Kâhin', icon: <Icons.spark /> },
  { key: 'forge', label: 'Ocak', icon: <Icons.hammer /> },
  { key: 'campaign', label: 'Kampanya', icon: <Icons.users /> },
]

function Toast() {
  const toast = useUi((s) => s.toast)
  const setToast = useUi((s) => s.setToast)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast, setToast])

  if (!toast) return null
  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 surface px-4 py-2.5 text-[0.82rem] animate-rise max-w-[90vw]"
      style={{ boxShadow: 'var(--shadow-lift)' }}
      onClick={() => setToast(null)}
      role="status"
    >
      {toast}
    </div>
  )
}

function TurnBanner() {
  const { combatActive, combatants, turn, round, nextTurn } = useStore()
  const setTab = useUi((s) => s.setTab)
  const tab = useUi((s) => s.tab)

  if (!combatActive || !combatants.length || tab === 'combat') return null
  const active = combatants[turn]

  return (
    <button
      className="w-full surface flex items-center gap-3 px-4 py-2 animate-fade"
      style={{ borderColor: 'var(--accent-deep)' }}
      onClick={() => setTab('combat')}
    >
      <span className="chip chip-accent">Tur {round}</span>
      <span className="font-semibold text-[0.88rem] truncate flex-1 text-left">{active?.name}</span>
      <span className="text-[0.72rem]" style={{ color: 'var(--ink-mute)' }}>
        {active?.hp}/{active?.maxHp} HP
      </span>
      <span
        className="btn btn-accent btn-xs"
        onClick={(e) => {
          e.stopPropagation()
          nextTurn()
        }}
      >
        Sıradaki
      </span>
    </button>
  )
}

export default function App() {
  const tab = useUi((s) => s.tab)
  const setTab = useUi((s) => s.setTab)
  const lookup = useUi((s) => s.lookup)
  const theme = useStore((s) => s.settings.theme)
  const setSettings = useStore((s) => s.setSettings)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Alt+1..6 jumps between panels without leaving the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const idx = parseInt(e.key, 10) - 1
      if (idx >= 0 && idx < TABS.length) {
        e.preventDefault()
        setTab(TABS[idx].key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTab])

  return (
    <div className="relative z-10 h-full flex flex-col">
      {/* ---------------------------------------------------------- header */}
      <header className="shrink-0 px-3 sm:px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="w-8 h-8 rounded-xl grid place-items-center"
              style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
            >
              <Icons.spark className="w-4.5 h-4.5" />
            </span>
            <div className="hidden sm:block leading-none">
              <h1 className="panel-title font-bold text-[1.05rem]">Kâhin</h1>
              <p className="text-[0.62rem] tracking-wide" style={{ color: 'var(--ink-mute)' }}>
                DM SCREEN
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <CommandBar />
          </div>

          <button
            className="btn btn-icon shrink-0"
            onClick={() => setSettings({ theme: theme === 'dusk' ? 'parchment' : 'dusk' })}
            title={theme === 'dusk' ? 'Aydınlık tema' : 'Karanlık tema'}
          >
            {theme === 'dusk' ? <Icons.sun /> : <Icons.moon />}
          </button>

          {/* A plain link, not a fetch: the endpoint clears the cookie and
              redirects, so the browser lands on the login page by itself. */}
          <a className="btn btn-icon shrink-0" href="/api/logout" title="Çıkış yap">
            <Icons.logout />
          </a>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-0.5">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              className="btn btn-xs shrink-0"
              style={
                tab === t.key
                  ? { color: 'var(--accent)', borderColor: 'var(--accent-deep)', background: 'var(--accent-wash)' }
                  : undefined
              }
              onClick={() => setTab(t.key)}
              title={`Alt+${i + 1}`}
            >
              {t.icon}
              <span className="hidden xs:inline sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        <TurnBanner />
      </header>

      {/* ----------------------------------------------------------- body
          Below lg the panels stack and the page scrolls; at lg and up the
          layout locks to the viewport and each panel scrolls independently. */}
      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden px-3 sm:px-4 pb-3 sm:pb-4">
        {tab === 'screen' && (
          <div className="grid gap-3 lg:h-full lg:grid-cols-[1fr_20rem]">
            <Reference className="max-h-[75vh] lg:max-h-none" />
            <div className="grid gap-3 lg:grid-rows-2 min-h-0">
              <DiceTray />
              <EncounterBuilder />
            </div>
          </div>
        )}

        {tab === 'combat' && (
          <div className="grid gap-3 lg:h-full lg:grid-cols-[1fr_20rem]">
            <CombatTracker />
            <div className="hidden lg:grid gap-3 lg:grid-rows-2 min-h-0">
              <Compendium />
              <DiceTray />
            </div>
          </div>
        )}

        {tab === 'compendium' && (
          <div className="grid gap-3 lg:h-full lg:grid-cols-[1fr_20rem]">
            <Compendium
              initialQuery={lookup?.query}
              initialTab={lookup?.resource === 'spells' ? 'spells' : lookup?.resource === 'magicitems' ? 'items' : 'monsters'}
            />
            <div className="hidden lg:grid gap-3 lg:grid-rows-2 min-h-0">
              <CombatTracker />
              <DiceTray />
            </div>
          </div>
        )}

        {tab === 'oracle' && (
          <div className="grid gap-3 lg:h-full lg:grid-cols-[1fr_20rem]">
            <OraclePanel />
            <div className="hidden lg:grid gap-3 lg:grid-rows-2 min-h-0">
              <EncounterBuilder />
              <DiceTray />
            </div>
          </div>
        )}

        {tab === 'forge' && <Forge />}
        {tab === 'campaign' && <Campaign />}
      </main>

      <Toast />
    </div>
  )
}
