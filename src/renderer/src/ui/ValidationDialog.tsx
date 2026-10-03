// Ventana con los problemas encontrados antes de exportar.
// Cada problema tiene un botón "Ir" que lleva al foco o al paso del asistente del país.
import { useState } from 'react'
import Overlay from './Overlay'
import type { Issue } from '../export/validator'
import { issueKey, kindOf } from '../export/ignore'
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
  /** Claves de los avisos ignorados (guardadas en el proyecto) */
  ignoredKeys?: string[]
  onIgnore?: (issue: Issue, ignore: boolean) => void
}

/** Cuántos avisos de un mismo tipo se ven antes de "Ver todos" */
const PREVIEW = 4

export default function ValidationDialog({
  issues,
  onClose,
  onExportAnyway,
  onSelectFocus,
  onGoCountry,
  onGoState,
  onGoPending,
  onFix,
  ignoredKeys = [],
  onIgnore
}: Props): JSX.Element {
  const [showIgnored, setShowIgnored] = useState(false)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [all, setAll] = useState<Set<string>>(new Set())
  const isIgn = (i: Issue): boolean => i.severity === 'aviso' && ignoredKeys.includes(issueKey(i))
  const visible = issues.filter((i) => showIgnored || !isIgn(i))
  const hiddenCount = issues.filter(isIgn).length
  const errors = issues.filter((i) => i.severity === 'error')
  // Grupos por tipo: primero los que tienen errores
  const groups = new Map<string, Issue[]>()
  for (const i of visible) groups.set(kindOf(i), [...(groups.get(kindOf(i)) ?? []), i])
  const ordered = [...groups.entries()].sort(
    (a, b) =>
      Number(b[1].some((i) => i.severity === 'error')) -
      Number(a[1].some((i) => i.severity === 'error'))
  )
  const toggle = (set: Set<string>, k: string, f: (s: Set<string>) => void): void => {
    const n = new Set(set)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    f(n)
  }
  const go = (i: Issue): void => {
    onClose()
    if (i.goPending) onGoPending()
    else if (i.stateId) onGoState(i.stateId)
    else if (i.countryUid) onGoCountry(i.countryUid, i.step ?? 0)
    else if (i.focusUid) onSelectFocus(i.focusUid)
  }
  const row = (i: Issue, n: number): JSX.Element => (
    <li
      key={n}
      className={`flex items-start gap-2 rounded p-2 text-sm hover:bg-hoi-card ${isIgn(i) ? 'opacity-50' : ''}`}
    >
      <span className="flex-1">
        <span className={i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
          {i.severity === 'error' ? 'Error: ' : 'Aviso: '}
        </span>
        {i.message}
      </span>
      {i.fix && onFix && (
        <button className="btn-primary shrink-0 px-2 py-0.5 text-xs" onClick={() => onFix(i)}>
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
      {i.severity === 'aviso' && onIgnore && (
        <button
          className="btn shrink-0 px-2 py-0.5 text-xs"
          title="Se guarda en el proyecto: no vuelve a molestar"
          onClick={() => onIgnore(i, !isIgn(i))}
        >
          {isIgn(i) ? 'Dejar de ignorar' : 'Ignorar este aviso'}
        </button>
      )}
    </li>
  )
  return (
    <Overlay>
      <div className="max-h-[80vh] w-[700px] overflow-hidden rounded-lg border border-hoi-border bg-hoi-panel shadow-2xl">
        <div className="border-b border-hoi-border p-4">
          <h2 className="text-lg font-semibold">
            {errors.length ? `Hay ${errors.length} error(es) que arreglar` : 'Revisa estos avisos'}
          </h2>
          <p className="text-xs text-hoi-muted">
            Los errores bloquean la exportación; los avisos no. Usa "Ir" para arreglar cada uno.
          </p>
          {hiddenCount > 0 && (
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showIgnored}
                onChange={(e) => setShowIgnored(e.target.checked)}
              />
              Mostrar ignorados ({hiddenCount})
            </label>
          )}
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {ordered.map(([kind, list]) => {
            const open = !folded.has(kind)
            const full = all.has(kind)
            const shown = full ? list : list.slice(0, PREVIEW)
            return (
              <section key={kind} className="mb-2">
                <button
                  className="flex w-full items-center gap-2 rounded bg-hoi-card px-2 py-1 text-left text-sm font-semibold"
                  onClick={() => toggle(folded, kind, setFolded)}
                >
                  <span>{open ? '▾' : '▸'}</span>
                  {kind} ({list.length})
                  {list.some((i) => i.severity === 'error') && (
                    <span className="text-xs text-red-400">con errores</span>
                  )}
                </button>
                {open && (
                  <ul>
                    {shown.map(row)}
                    {list.length > PREVIEW && (
                      <li className="p-2 text-xs text-hoi-muted">
                        {full ? (
                          <button className="underline" onClick={() => toggle(all, kind, setAll)}>
                            Ver menos
                          </button>
                        ) : (
                          <>
                            … y {list.length - PREVIEW} avisos más de este tipo.{' '}
                            <button className="underline" onClick={() => toggle(all, kind, setAll)}>
                              Ver todos
                            </button>
                          </>
                        )}
                      </li>
                    )}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
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
