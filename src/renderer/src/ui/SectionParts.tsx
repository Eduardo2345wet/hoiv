// Piezas comunes del esqueleto de las secciones: galería de plantillas, lista por grupos y "Ver código".
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { GroupNode, TemplateCard } from '../sections/ui'

/** Tarjetas con miniatura, nombre y una frase */
export function TemplateGallery({
  templates,
  value,
  onChange,
  onPick,
  compact
}: {
  templates: TemplateCard[]
  /** Plantilla marcada (en la ventana "Nuevo …") */
  value?: string
  onChange?: (id: string) => void
  /** Clic directo (estado vacío): crea con esa plantilla */
  onPick?: (id: string) => void
  compact?: boolean
}): JSX.Element {
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3'}`}>
      {templates.map((t) => {
        const on = value === t.id
        return (
          <button
            key={t.id}
            data-template={t.id}
            onClick={() => (onPick ? onPick(t.id) : onChange?.(t.id))}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${on ? 'border-hoi-accent bg-hoi-accent/10' : 'border-hoi-border bg-hoi-panel hover:bg-hoi-card'}`}
          >
            {t.thumb && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-hoi-bg text-hoi-muted">
                {t.thumb}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-hoi-text">{t.label}</div>
              <div className="mt-0.5 text-xs text-hoi-muted">{t.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** Lista con buscador y grupos plegables */
export function GroupTree({
  groups,
  selected,
  onSelect,
  header
}: {
  groups: GroupNode[]
  selected: string | null
  onSelect: (uid: string) => void
  header?: ReactNode
}): JSX.Element {
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const needle = q.trim().toLowerCase()
  const toggle = (id: string): void =>
    setClosed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const total = groups.reduce((a, g) => a + g.items.length, 0)
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="relative m-2">
        <Search size={13} className="pointer-events-none absolute left-2 top-2.5 text-hoi-muted" />
        <input
          className="input pl-7"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" data-group-tree>
        {groups.map((g) => {
          const items = needle
            ? g.items.filter(
                (i) =>
                  i.title.toLowerCase().includes(needle) ||
                  (i.subtitle ?? '').toLowerCase().includes(needle)
              )
            : g.items
          if (needle && !items.length && !g.title.toLowerCase().includes(needle)) return null
          const open = needle ? true : !closed.has(g.id)
          if (g.title === '')
            return (
              <div key={g.id} data-group={g.id}>
                {items.map((i) => (
                  <div
                    key={i.uid}
                    data-item={i.uid}
                    onClick={() => onSelect(i.uid)}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${i.uid === selected ? 'bg-hoi-accent/20 ring-1 ring-hoi-accent' : 'hover:bg-hoi-card'}`}
                  >
                    {i.thumb && <div className="flex w-8 shrink-0 justify-center">{i.thumb}</div>}
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        {i.title || <span className="text-hoi-muted">Sin nombre</span>}
                      </div>
                      {i.subtitle && (
                        <div className="truncate font-mono text-[10px] text-hoi-muted">
                          {i.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          return (
            <div key={g.id} className="mb-1" data-group={g.id}>
              <div
                className={`flex items-center gap-1 rounded px-1 py-1 text-xs font-medium uppercase tracking-wide text-hoi-muted ${g.selectUid && g.selectUid === selected ? 'bg-hoi-accent/15 text-hoi-text' : 'hover:bg-hoi-card'}`}
              >
                <button
                  aria-label={open ? 'Plegar' : 'Desplegar'}
                  className="shrink-0"
                  onClick={() => toggle(g.id)}
                >
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {g.thumb && <span className="shrink-0">{g.thumb}</span>}
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => (g.selectUid ? onSelect(g.selectUid) : toggle(g.id))}
                >
                  {g.title}
                </button>
                <span className="text-[11px] normal-case">{g.items.length}</span>
              </div>
              {open &&
                items.map((i) => (
                  <div key={i.uid}>
                    {i.heading && (
                      <div className="ml-3 mt-1 px-2 text-[10px] uppercase tracking-wide text-hoi-muted">
                        {i.heading}
                      </div>
                    )}
                    <div
                      data-item={i.uid}
                      onClick={() => onSelect(i.uid)}
                      className={`ml-3 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${i.uid === selected ? 'bg-hoi-accent/20 ring-1 ring-hoi-accent' : 'hover:bg-hoi-card'}`}
                    >
                      {i.thumb && <div className="flex w-8 shrink-0 justify-center">{i.thumb}</div>}
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          {i.title || <span className="text-hoi-muted">Sin nombre</span>}
                        </div>
                        {i.subtitle && (
                          <div className="truncate font-mono text-[10px] text-hoi-muted">
                            {i.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )
        })}
        {!total && <p className="p-2 text-xs text-hoi-muted">Todavía no hay nada.</p>}
        {total > 0 &&
          needle &&
          !groups.some((g) => g.items.some((i) => i.title.toLowerCase().includes(needle))) && (
            <p className="p-2 text-xs text-hoi-muted">Nada coincide.</p>
          )}
      </div>
    </div>
  )
}

/** "Ver código": plegado por defecto, con letra pequeña */
export function CodeView({ code }: { code: string | null | undefined }): JSX.Element | null {
  if (!code?.trim()) return null
  return (
    <details data-code-view className="mt-4 border-t border-hoi-border pt-2">
      <summary className="cursor-pointer text-xs text-hoi-muted hover:text-hoi-text">
        Ver código
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-hoi-bg p-2 font-mono text-[10px] text-hoi-muted">
        {code}
      </pre>
    </details>
  )
}
