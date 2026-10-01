// Ventana con los problemas encontrados antes de exportar.
// Cada problema tiene un botón "Ir" que lleva al foco o al paso del asistente del país.
import Overlay from './Overlay'
import type { Issue } from '../export/validator'
import { STEPS } from '../countries/validateCountry'

interface Props {
  issues: Issue[]
  onClose: () => void
  onExportAnyway: () => void
  onSelectFocus: (uid: string) => void
  /** Abre el asistente del país en el paso indicado */
  onGoCountry: (countryUid: string, step: number) => void
  /** Abre el mapa centrado en un estado */
  onGoState: (stateId: number) => void
  /** Abre el mapa con "Ver pendientes" */
  onGoPending: () => void
  /** "Renombrar automáticamente" */
  onFix?: (issue: Issue) => void
}

export default function ValidationDialog({
  issues,
  onClose,
  onExportAnyway,
  onSelectFocus,
  onGoCountry,
  onGoState,
  onGoPending,
  onFix
}: Props): JSX.Element {
  const errors = issues.filter((i) => i.severity === 'error')
  const go = (i: Issue): void => {
    onClose()
    if (i.goPending) onGoPending()
    else if (i.stateId) onGoState(i.stateId)
    else if (i.countryUid) onGoCountry(i.countryUid, i.step ?? 0)
    else if (i.focusUid) onSelectFocus(i.focusUid)
  }
  return (
    <Overlay>
      <div className="max-h-[80vh] w-[640px] overflow-hidden rounded-lg border border-hoi-border bg-hoi-panel shadow-2xl">
        <div className="border-b border-hoi-border p-4">
          <h2 className="text-lg font-semibold">
            {errors.length
              ? `❌ Hay ${errors.length} error(es) que arreglar`
              : '⚠️ Revisa estos avisos'}
          </h2>
          <p className="text-xs text-hoi-muted">
            Los errores bloquean la exportación; los avisos no. Usa "Ir" para arreglar cada uno.
          </p>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {issues.map((i, n) => (
            <li key={n} className="flex items-start gap-2 rounded p-2 text-sm hover:bg-hoi-card">
              <span className="flex-1">
                <span className={i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                  {i.severity === 'error' ? 'Error: ' : 'Aviso: '}
                </span>
                {i.message}
              </span>
              {i.fix && onFix && (
                <button
                  className="btn-primary shrink-0 px-2 py-0.5 text-xs"
                  onClick={() => onFix(i)}
                >
                  Renombrar automáticamente
                </button>
              )}
              {(i.focusUid || i.countryUid || i.stateId || i.goPending) && (
                <button
                  className="btn shrink-0 px-2 py-0.5 text-xs"
                  title={
                    i.stateId
                      ? 'Centrar el mapa en el estado'
                      : i.countryUid
                        ? `Abrir el paso "${STEPS[i.step ?? 0]}"`
                        : 'Ir al foco'
                  }
                  onClick={() => go(i)}
                >
                  Ir
                </button>
              )}
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
    </Overlay>
  )
}
