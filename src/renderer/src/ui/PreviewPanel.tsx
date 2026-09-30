// Vista previa en vivo del script que se va a generar.

import { useState } from 'react'
import clsx from 'clsx'
import { Copy } from 'lucide-react'

interface Props {
  focusScript: string | null
  fileScript: string
  localisation: string
}

type Tab = 'focus' | 'file' | 'loc'

const TABS: { id: Tab; label: string }[] = [
  { id: 'focus', label: 'Este foco' },
  { id: 'file', label: 'Archivo de focos' },
  { id: 'loc', label: 'Localización' }
]

export default function PreviewPanel({ focusScript, fileScript, localisation }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('focus')
  const text =
    tab === 'focus'
      ? (focusScript ?? '# Selecciona un foco en el árbol para ver su script.')
      : tab === 'file'
        ? fileScript
        : localisation

  return (
    <div className="flex h-full flex-col bg-hoi-panel">
      <div className="flex items-center gap-1 border-b border-hoi-border px-2 py-1">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-hoi-muted">
          Vista previa
        </span>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'rounded px-2 py-1 text-xs',
              tab === t.id ? 'bg-hoi-accent text-white' : 'text-hoi-muted hover:bg-hoi-card'
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          title="Copiar"
          onClick={() => navigator.clipboard?.writeText(text)}
          className="ml-auto rounded p-1 text-hoi-muted hover:bg-hoi-card hover:text-hoi-text"
        >
          <Copy size={14} />
        </button>
      </div>
      <pre className="flex-1 select-text overflow-auto whitespace-pre p-3 font-mono text-xs leading-relaxed text-emerald-200">
        {text.replace(/\t/g, '    ')}
      </pre>
    </div>
  )
}
