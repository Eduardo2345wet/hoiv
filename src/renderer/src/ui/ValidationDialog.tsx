// Ventana con los problemas encontrados antes de exportar
import type { Issue } from '../export/validator'

interface Props {
  issues: Issue[]
  onClose: () => void
  onExportAnyway: () => void
  onSelectFocus: (uid: string) => void
}

export default function ValidationDialog({ issues, onClose, onExportAnyway, onSelectFocus }: Props): JSX.Element {
  const errors = issues.filter((i) => i.severity === 'error')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[80vh] w-[560px] overflow-hidden rounded-lg border border-hoi-border bg-hoi-panel shadow-2xl">
        <div className="border-b border-hoi-border p-4">
          <h2 className="text-lg font-semibold">
            {errors.length ? `❌ Hay ${errors.length} error(es) que arreglar` : '⚠️ Revisa estos avisos'}
          </h2>
          <p className="text-xs text-hoi-muted">Haz clic en un problema para ir al foco.</p>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {issues.map((i, n) => (
            <li
              key={n}
              onClick={() => i.focusUid && (onSelectFocus(i.focusUid), onClose())}
              className={`rounded p-2 text-sm ${i.focusUid ? 'cursor-pointer hover:bg-hoi-card' : ''}`}
            >
              <span className={i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                {i.severity === 'error' ? 'Error: ' : 'Aviso: '}
              </span>
              {i.message}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t border-hoi-border p-3">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
          {errors.length === 0 && (
            <button className="btn-primary" onClick={onExportAnyway}>
              Exportar de todos modos
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
