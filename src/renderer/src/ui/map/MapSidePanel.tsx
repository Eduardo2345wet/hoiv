// Panel derecho del mapa: estado seleccionado, país activo o resumen del mod
import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { countryStates, effectiveCores, effectiveOwner, isChanged } from '../../map/mapOps'
import { validateProject } from '../../export/validator'
import { STEP } from '../../countries/validateCountry'
import FlagThumb from '../FlagThumb'

interface Props {
  project: Project
  onOpenWizard: (countryUid?: string, step?: number) => void
  onGoTab: (tab: 'focos' | 'paises' | 'ideas' | 'iconos') => void
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }): JSX.Element => (
  <div className="flex gap-2 py-0.5 text-sm">
    <span className="w-28 shrink-0 text-hoi-muted">{k}</span>
    <span className="min-w-0 flex-1 break-words">{v}</span>
  </div>
)

export default function MapSidePanel({ project, onOpenWizard, onGoTab }: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const activeTag = useApp((s) => s.activeTag)
  const selectedId = useApp((s) => s.selectedStateId)
  const game = useApp(() => store.catalogGame())
  const state = selectedId ? map?.states.find((s) => s.id === selectedId) : undefined
  const country = project.countries.find((c) => c.tag === activeTag)
  const myStates = useMemo(
    () =>
      map && activeTag
        ? countryStates(project, map, activeTag).map((id) => map.states.find((s) => s.id === id)!)
        : [],
    [map, project, activeTag]
  )
  const issues = useMemo(() => validateProject(project, game), [project, game])

  // ---- Estado seleccionado ----
  if (state) {
    const owner = effectiveOwner(state, project)
    const ownerCountry = project.countries.find((c) => c.tag === owner)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-hoi-border px-4 py-2">
          <h2 className="font-semibold text-hoi-accent">Estado #{state.id}</h2>
          <button title="Cerrar" onClick={() => store.set({ selectedStateId: null })}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Row k="Nombre" v={state.name} />
          <Row
            k="Dueño"
            v={
              <span className="flex items-center gap-2">
                {ownerCountry && <FlagThumb country={ownerCountry} height={14} />}
                <span className="font-mono">{owner || '—'}</span>
                {owner !== state.owner && (
                  <span className="text-xs text-hoi-muted">(antes {state.owner})</span>
                )}
              </span>
            }
          />
          <Row k="Cores" v={effectiveCores(state, project).join(', ') || '—'} />
          <Row
            k="Provincias"
            v={`${state.provinces.length}: ${state.provinces.slice(0, 20).join(', ')}${state.provinces.length > 20 ? '…' : ''}`}
          />
          <Row
            k="Victory points"
            v={state.victoryPoints.map(([p, v]) => `${p}: ${v}`).join(' · ') || 'ninguno'}
          />
          <Row k="Categoría" v={state.category || '—'} />
          <Row k="Archivo" v={<span className="font-mono text-xs">{state.file}</span>} />
          <Row
            k="Cambios con fecha"
            v={state.hasDatedChanges ? '⚠ sí (1939.1.1 = { … } u otros)' : 'no'}
          />
          <Row k="Modificado" v={isChanged(state, project) ? 'sí' : 'no'} />
          <button
            className="btn mt-3 w-full justify-center text-xs"
            onClick={() => store.focusState(state.id)}
          >
            Centrar en el mapa
          </button>
        </div>
      </div>
    )
  }

  // ---- País activo ----
  if (activeTag) {
    const tree = project.focusTrees.find((t) => t.id === country?.focusTreeId)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="border-b border-hoi-border px-4 py-2 font-semibold text-hoi-accent">
          {country?.names.name ?? activeTag}
        </h2>
        <div className="grid grid-cols-2 gap-1 p-3">
          <button
            className="btn justify-center text-xs"
            disabled={!country}
            onClick={() => {
              if (!country) return
              if (tree) store.set({ activeTreeId: tree.id })
              onGoTab(tree ? 'focos' : 'paises')
            }}
          >
            Árbol de focos
          </button>
          <button
            className="btn justify-center text-xs"
            disabled={!country}
            onClick={() => country && onOpenWizard(country.uid, STEP.bandera)}
          >
            Bandera
          </button>
          <button
            className="btn justify-center text-xs"
            disabled={!country}
            onClick={() => country && onOpenWizard(country.uid, STEP.lider)}
          >
            Líderes
          </button>
          <button
            className="btn justify-center text-xs"
            disabled={!country}
            onClick={() => country && onOpenWizard(country.uid, STEP.politica)}
          >
            Política
          </button>
        </div>
        <div className="border-t border-hoi-border px-4 py-2 text-xs text-hoi-muted">
          Estados del país ({myStates.length})
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {myStates.map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full justify-between rounded px-2 py-1 text-left text-sm hover:bg-hoi-card"
                onClick={() => store.focusState(s.id)}
              >
                <span className="truncate">
                  {country?.capital === s.id && '★ '}
                  {s.name}
                </span>
                <span className="font-mono text-xs text-hoi-muted">#{s.id}</span>
              </button>
            </li>
          ))}
          {!myStates.length && (
            <li className="px-2 text-sm text-hoi-muted">
              Sin estados. Píntalos con el pincel (B).
            </li>
          )}
        </ul>
      </div>
    )
  }

  // ---- Resumen del mod ----
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <h2 className="mb-3 font-semibold text-hoi-accent">{project.modName}</h2>
      <button className="btn mb-1 justify-between text-sm" onClick={() => onGoTab('paises')}>
        Países del mod <span>{project.countries.length}</span>
      </button>
      <div className="mb-2 flex flex-wrap gap-1 px-1">
        {project.countries.map((c) => (
          <button key={c.uid} title={c.names.name} onClick={() => store.set({ activeTag: c.tag })}>
            <FlagThumb country={c} height={18} />
          </button>
        ))}
      </div>
      <button className="btn mb-1 justify-between text-sm" onClick={() => onGoTab('ideas')}>
        Espíritus nacionales <span>{project.ideas.length}</span>
      </button>
      <button className="btn mb-1 justify-between text-sm" onClick={() => onGoTab('iconos')}>
        Íconos <span>{project.icons.length}</span>
      </button>
      <div className="btn mb-1 justify-between text-sm">
        Estados modificados <span>{Object.keys(project.stateEdits).length}</span>
      </div>
      <div
        className={`mt-3 rounded border p-2 text-sm ${errors ? 'border-red-500 text-red-300' : 'border-hoi-border'}`}
      >
        Validador: {errors} error(es), {warnings} aviso(s)
        <div className="text-xs text-hoi-muted">Pulsa "Exportar mod" para ver el detalle.</div>
      </div>
    </div>
  )
}
