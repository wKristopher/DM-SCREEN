/** Small shared primitives. Icons are inline SVG so nothing loads from a CDN. */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode, InputHTMLAttributes, CSSProperties } from 'react'

/* ------------------------------------------------------------------ icons */

type IconProps = { className?: string; style?: CSSProperties; title?: string }
const s = (p: IconProps) => ({
  className: p.className ?? 'w-4 h-4',
  style: p.style,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Icons = {
  swords: (p: IconProps) => (
    <svg {...s(p)}><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6M16 16l4 4M19 21l2-2" /><path d="M14.5 6.5 18 3h3v3l-3.5 3.5" /><path d="m5 14 5 5M3 21l2-2" /></svg>
  ),
  book: (p: IconProps) => (
    <svg {...s(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  scroll: (p: IconProps) => (
    <svg {...s(p)}><path d="M19 17V5a2 2 0 0 0-2-2H5" /><path d="M8 21h9a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H8v4z" /><path d="M8 21a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2" /><path d="M9 8h6M9 12h4" /></svg>
  ),
  dice: (p: IconProps) => (
    <svg {...s(p)}><path d="m12 2 9 5.5v9L12 22l-9-5.5v-9z" /><path d="M12 2v20M3 7.5l9 5 9-5" /></svg>
  ),
  eye: (p: IconProps) => (
    <svg {...s(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  eyeOff: (p: IconProps) => (
    <svg {...s(p)}><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.16 3.19M6.61 6.61A18 18 0 0 0 2 12s3.5 8 10 8a9 9 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" /></svg>
  ),
  users: (p: IconProps) => (
    <svg {...s(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  pen: (p: IconProps) => (
    <svg {...s(p)}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /><path d="m15 5 4 4" /></svg>
  ),
  flask: (p: IconProps) => (
    <svg {...s(p)}><path d="M10 2v7.5L4.2 19a2 2 0 0 0 1.7 3h12.2a2 2 0 0 0 1.7-3L14 9.5V2" /><path d="M9 2h6M6.5 15h11" /></svg>
  ),
  spark: (p: IconProps) => (
    <svg {...s(p)}><path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" /><circle cx="12" cy="12" r="3.2" /></svg>
  ),
  gear: (p: IconProps) => (
    <svg {...s(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
  plus: (p: IconProps) => <svg {...s(p)}><path d="M12 5v14M5 12h14" /></svg>,
  x: (p: IconProps) => <svg {...s(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  trash: (p: IconProps) => (
    <svg {...s(p)}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
  ),
  chevronR: (p: IconProps) => <svg {...s(p)}><path d="m9 18 6-6-6-6" /></svg>,
  chevronL: (p: IconProps) => <svg {...s(p)}><path d="m15 18-6-6 6-6" /></svg>,
  chevronD: (p: IconProps) => <svg {...s(p)}><path d="m6 9 6 6 6-6" /></svg>,
  search: (p: IconProps) => <svg {...s(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>,
  refresh: (p: IconProps) => (
    <svg {...s(p)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
  ),
  download: (p: IconProps) => <svg {...s(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>,
  upload: (p: IconProps) => <svg {...s(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  heart: (p: IconProps) => (
    <svg {...s(p)}><path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 12 5.6 5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7z" /></svg>
  ),
  shield: (p: IconProps) => <svg {...s(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  moon: (p: IconProps) => <svg {...s(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  sun: (p: IconProps) => (
    <svg {...s(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ),
  hammer: (p: IconProps) => (
    <svg {...s(p)}><path d="m15 12-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9" /><path d="m18 15 4-4-6.5-6.5-2 2L11 4l-3 3 2.5 2.5-2 2z" /></svg>
  ),
  logout: (p: IconProps) => (
    <svg {...s(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
  ),
  skull: (p: IconProps) => (
    <svg {...s(p)}><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><path d="M8 20v-2.2a1 1 0 0 0-.6-.9A7 7 0 0 1 12 3a7 7 0 0 1 4.6 13.9 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" /><path d="M11 17h2" /></svg>
  ),
}

/* ------------------------------------------------------------------ layout */

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`surface flex flex-col overflow-hidden ${className}`}>
      {title && (
        <header className="flex items-center gap-2.5 px-4 py-3 hairline shrink-0">
          {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="panel-title text-[0.95rem] font-semibold truncate">{title}</h2>
            {subtitle && (
              <p className="text-[0.7rem] truncate" style={{ color: 'var(--ink-mute)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={`flex-1 min-h-0 overflow-auto ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
      {icon && <span style={{ color: 'var(--ink-mute)', opacity: 0.5 }}>{icon}</span>}
      <p className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
        {title}
      </p>
      {hint && (
        <p className="text-xs max-w-xs" style={{ color: 'var(--ink-mute)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-[0.7rem] font-medium mb-1" style={{ color: 'var(--ink-mute)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[0.66rem] mt-1" style={{ color: 'var(--ink-mute)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}

export function NumberField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={`field field-sm text-center ${props.className ?? ''}`} />
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-auto animate-fade"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`surface w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} my-auto animate-rise`}
        style={{ boxShadow: 'var(--shadow-lift)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3.5 hairline">
          <h3 className="panel-title font-semibold">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Kapat">
            <Icons.x />
          </button>
        </header>
        <div className="p-5 max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ misc */

/** Renders the tiny subset of markdown our rules text uses. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<span style="opacity:.4;text-decoration:line-through">$1</span>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Hp({ current, max, temp = 0 }: { current: number; max: number; temp?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const color = pct > 50 ? 'var(--sage)' : pct > 25 ? 'var(--accent)' : 'var(--rose)'
  return (
    <div className="h-1.5 rounded-full overflow-hidden w-full" style={{ background: 'var(--line-soft)' }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
      {temp > 0 && <div className="h-full" style={{ width: '0%' }} />}
    </div>
  )
}

/** Copy-to-clipboard button with a transient confirmation. */
export function CopyButton({ text, label = 'Kopyala' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <button
      className="btn btn-ghost btn-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          timer.current = window.setTimeout(() => setDone(false), 1400)
        } catch {
          /* clipboard blocked — nothing useful to say */
        }
      }}
    >
      {done ? 'Kopyalandı' : label}
    </button>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs animate-pulse-soft" style={{ color: 'var(--ink-mute)' }}>
      <Icons.refresh className="w-4 h-4" />
      {label ?? 'Yükleniyor…'}
    </div>
  )
}
