// Componentes comunes de las secciones nuevas (tokens: tema oscuro, acento #e8913a).
import { useState, type ReactNode } from 'react'

export function Button({
  children,
  primary,
  disabled,
  title,
  onClick,
  small
}: {
  children: ReactNode
  primary?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
  small?: boolean
}): JSX.Element {
  return (
    <button
      className={`${primary ? 'btn-primary' : 'btn'} ${small ? 'px-2 py-0.5 text-xs' : ''} disabled:opacity-40`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  title,
  onClick,
  disabled
}: {
  icon: ReactNode
  title: string
  onClick?: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-hoi-muted hover:bg-hoi-card hover:text-hoi-text disabled:opacity-40"
    >
      {icon}
    </button>
  )
}

/** Etiqueta + ayuda + error alrededor de un control */
export function Field({
  label,
  help,
  error,
  children
}: {
  label: string
  help?: string
  error?: string | null
  children: ReactNode
}): JSX.Element {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-hoi-muted">{help}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function Select({
  value,
  options,
  onChange
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}): JSX.Element {
  return (
    <input
      type="number"
      className="input w-28"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function Tabs({
  tabs,
  value,
  onChange
}: {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}): JSX.Element {
  return (
    <div className="flex border-b border-hoi-border" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 text-sm ${value === t.id ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted hover:text-hoi-text'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({
  children,
  tone
}: {
  children: ReactNode
  tone?: 'warn' | 'error' | 'ok'
}): JSX.Element {
  const c =
    tone === 'error'
      ? 'bg-red-500/20 text-red-300'
      : tone === 'warn'
        ? 'bg-yellow-500/20 text-yellow-300'
        : tone === 'ok'
          ? 'bg-green-500/20 text-green-300'
          : 'bg-hoi-card text-hoi-muted'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${c}`}>{children}</span>
}

export function Card({
  title,
  children,
  actions
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
}): JSX.Element {
  return (
    <section className="mb-3 rounded border border-hoi-border bg-hoi-panel p-3">
      {(title || actions) && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/** Estado vacío: un texto corto y un botón "Crear …" (nunca datos de ejemplo) */
export function EmptyState({
  text,
  action
}: {
  text: string
  action?: { label: string; onClick?: () => void; disabled?: boolean; title?: string }
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-hoi-muted">
      <p className="max-w-sm">{text}</p>
      {action && (
        <Button primary disabled={action.disabled} title={action.title} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/** Lista con buscador */
export function ListPanel<T extends { uid?: string; id?: string }>({
  items,
  label,
  selected,
  onSelect,
  placeholder = 'Buscar…',
  header
}: {
  items: T[]
  label: (i: T) => string
  selected: string | null
  onSelect: (key: string) => void
  placeholder?: string
  header?: ReactNode
}): JSX.Element {
  const [q, setQ] = useState('')
  const key = (i: T): string => i.uid ?? i.id ?? ''
  const shown = items.filter((i) => label(i).toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <input
        className="input m-2"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {shown.map((i) => (
          <li
            key={key(i)}
            onClick={() => onSelect(key(i))}
            className={`mb-1 cursor-pointer truncate rounded px-2 py-1.5 text-sm ${key(i) === selected ? 'bg-hoi-accent/20 ring-1 ring-hoi-accent' : 'hover:bg-hoi-card'}`}
          >
            {label(i) || <span className="text-red-400">sin nombre</span>}
          </li>
        ))}
        {!shown.length && items.length > 0 && (
          <li className="p-2 text-xs text-hoi-muted">Nada coincide.</li>
        )}
      </ul>
    </div>
  )
}

/** Tres zonas: lista a la izquierda, editor al centro, panel a la derecha (plegable) */
export function SplitPane({
  left,
  center,
  right,
  rightTitle = 'Propiedades y vista previa'
}: {
  left: ReactNode
  center: ReactNode
  right?: ReactNode
  rightTitle?: string
}): JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex h-full min-h-0">
      <aside className="w-64 shrink-0 border-r border-hoi-border bg-hoi-panel">{left}</aside>
      <div className="min-w-0 flex-1 overflow-y-auto">{center}</div>
      {right && (
        <aside
          className={`shrink-0 border-l border-hoi-border bg-hoi-panel ${open ? 'w-80' : 'w-8'}`}
        >
          <button
            className="w-full px-2 py-1 text-left text-xs text-hoi-muted hover:text-hoi-text"
            title={open ? 'Plegar' : 'Mostrar'}
            onClick={() => setOpen(!open)}
          >
            {open ? `▸ ${rightTitle}` : '◂'}
          </button>
          {open && <div className="h-[calc(100%-28px)] overflow-y-auto p-3">{right}</div>}
        </aside>
      )}
    </div>
  )
}
