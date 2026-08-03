/** The classic behind-the-screen tables. Bundled — works with no network. */

import { useMemo, useState } from 'react'
import { REF_TABLES, CONDITIONS, ACTIONS_IN_COMBAT } from '../lib/srd'
import { Icons, Panel, RichText } from './ui'

const ACCENT: Record<string, string> = {
  accent: 'var(--accent)',
  sage: 'var(--sage)',
  rose: 'var(--rose)',
  violet: 'var(--violet)',
  azure: 'var(--azure)',
}

function Card({
  title,
  subtitle,
  color,
  children,
}: {
  title: string
  subtitle?: string
  color: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden break-inside-avoid mb-2.5"
      style={{ background: 'var(--bg-deep)', borderTop: `2px solid ${color}` }}
    >
      <header className="px-3 pt-2.5 pb-1.5">
        <h3 className="panel-title font-semibold text-[0.86rem] leading-tight" style={{ color }}>
          {title}
        </h3>
        {subtitle && (
          // lang="en" matters here: the page is Turkish, and Turkish casing
          // rules would uppercase these English rules terms as "CONDİTİONS".
          <p lang="en" className="text-[0.65rem] uppercase tracking-wider" style={{ color: 'var(--ink-mute)' }}>
            {subtitle}
          </p>
        )}
      </header>
      <div className="px-3 pb-3">{children}</div>
    </section>
  )
}

export function Reference({ className = '' }: { className?: string }) {
  const [filter, setFilter] = useState('')

  const q = filter.trim().toLocaleLowerCase('tr')

  const tables = useMemo(
    () =>
      REF_TABLES.filter(
        (t) =>
          !q ||
          t.title.toLocaleLowerCase('tr').includes(q) ||
          t.subtitle?.toLocaleLowerCase('tr').includes(q) ||
          t.rows?.some((r) => r.join(' ').toLocaleLowerCase('tr').includes(q)),
      ),
    [q],
  )

  const conditions = useMemo(
    () =>
      CONDITIONS.filter(
        (c) => !q || c.name.toLocaleLowerCase('tr').includes(q) || c.desc.toLocaleLowerCase('tr').includes(q),
      ),
    [q],
  )

  const actions = useMemo(
    () =>
      ACTIONS_IN_COMBAT.filter(
        (a) => !q || a.name.toLocaleLowerCase('tr').includes(q) || a.desc.toLocaleLowerCase('tr').includes(q),
      ),
    [q],
  )

  return (
    <Panel
      title="Ekran"
      subtitle="Çevrimdışı hızlı başvuru"
      icon={<Icons.scroll />}
      className={`lg:h-full ${className}`}
      bodyClass="p-3"
    >
      <div className="relative mb-3">
        <Icons.search
          className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--ink-mute)' }}
        />
        <input
          className="field pl-8"
          placeholder="Tablolarda ara: grapple, cover, exhaustion…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="columns-1 md:columns-2 xl:columns-3 gap-2.5">
        {conditions.length > 0 && (
          <Card title="Durumlar" subtitle="Conditions" color="var(--rose)">
            <div className="space-y-2">
              {conditions.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[0.8rem]">{c.name}</span>
                    {c.tag && <span className="chip chip-mute">{c.tag}</span>}
                  </div>
                  <p className="text-[0.74rem] leading-snug" style={{ color: 'var(--ink-mute)' }}>
                    <RichText text={c.desc} />
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {actions.length > 0 && (
          <Card title="Savaşta Aksiyonlar" subtitle="Actions in Combat" color="var(--accent)">
            <div className="space-y-1.5">
              {actions.map((a) => (
                <div key={a.name}>
                  <span className="font-semibold text-[0.8rem]">{a.name}</span>
                  <p className="text-[0.74rem] leading-snug" style={{ color: 'var(--ink-mute)' }}>
                    <RichText text={a.desc} />
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tables.map((t) => (
          <Card key={t.id} title={t.title} subtitle={t.subtitle} color={ACCENT[t.accent]}>
            <table className="w-full text-[0.76rem]">
              <thead>
                <tr>
                  {t.columns?.map((c) => (
                    <th
                      key={c}
                      className="text-left font-medium pb-1 pr-2"
                      style={{ color: 'var(--ink-mute)', borderBottom: '1px solid var(--line-soft)' }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows?.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="py-1 pr-2 align-top leading-snug"
                        style={{
                          color: j === 0 ? 'var(--ink)' : 'var(--ink-soft)',
                          fontWeight: j === 0 ? 550 : 400,
                        }}
                      >
                        <RichText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      {!tables.length && !conditions.length && !actions.length && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--ink-mute)' }}>
          "{filter}" için bir şey yok.
        </p>
      )}
    </Panel>
  )
}
