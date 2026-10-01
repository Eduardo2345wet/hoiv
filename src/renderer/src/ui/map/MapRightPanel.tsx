import React from 'react'
import {
  Globe,
  Flag,
  Users,
  Award,
  GitBranch,
  MapPin,
  FileText,
  Calendar,
  AlertTriangle,
  X
} from 'lucide-react'
import type { Country, Project } from '../../types'
import type { MapData, State } from '../../map/types'
import FlagThumb from '../FlagThumb'
import { validateProject } from '../../export/validator'

interface MapRightPanelProps {
  project: Project
  activeCountry: Country | null
  selectedState: State | null
  mapData: MapData | null
  onSelectState: (stateId: number | null) => void
  onCenterState: (stateId: number) => void
  onOpenTab: (tabName: 'focos' | 'paises' | 'ideas' | 'iconos') => void
  onOpenWizardStep: (countryUid: string, step: number) => void
  onOpenValidator: () => void
}

export default function MapRightPanel({
  project,
  activeCountry,
  selectedState,
  mapData,
  onSelectState,
  onCenterState,
  onOpenTab,
  onOpenWizardStep,
  onOpenValidator
}: MapRightPanelProps): JSX.Element {
  // Calcular dueño actual considerando stateEdits
  const getEffectiveStateOwner = (s: State): string => {
    const edit = project.stateEdits?.[s.id]
    if (edit && edit.owner !== undefined) return edit.owner
    return s.originalOwner
  }

  // Calcular cores actuales considerando stateEdits
  const getEffectiveStateCores = (s: State): string[] => {
    const edit = project.stateEdits?.[s.id]
    let cores = [...s.originalCores]
    if (edit) {
      if (edit.removeCores) {
        cores = cores.filter((c) => !edit.removeCores?.includes(c))
      }
      if (edit.addCores) {
        edit.addCores.forEach((c) => {
          if (!cores.includes(c)) cores.push(c)
        })
      }
    }
    return cores
  }

  // 1. Un estado específico seleccionado
  if (selectedState) {
    const ownerTag = getEffectiveStateOwner(selectedState)
    const ownerCountry = project.countries.find((c) => c.tag === ownerTag) ?? null
    const cores = getEffectiveStateCores(selectedState)

    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-hoi-border bg-hoi-panel p-4 text-hoi-text overflow-y-auto">
        <div className="flex items-center justify-between border-b border-hoi-border pb-3">
          <div>
            <span className="text-xs font-mono text-hoi-accent uppercase">Estado #{selectedState.id}</span>
            <h2 className="text-lg font-bold">{selectedState.name}</h2>
          </div>
          <button
            onClick={() => onSelectState(null)}
            className="rounded p-1 text-hoi-muted hover:bg-hoi-bg hover:text-hoi-text"
            title="Cerrar panel de estado"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          {/* Dueño */}
          <div className="rounded border border-hoi-border bg-hoi-bg p-3">
            <span className="text-hoi-muted uppercase font-semibold text-[10px] block mb-1">Dueño Actual</span>
            {ownerTag ? (
              <div className="flex items-center gap-2">
                {ownerCountry ? (
                  <div className="h-6 w-9 shrink-0 overflow-hidden rounded border border-hoi-border bg-black">
                    <FlagThumb country={ownerCountry} size="small" />
                  </div>
                ) : (
                  <div className="flex h-6 w-9 items-center justify-center rounded border border-hoi-border bg-slate-800 font-mono font-bold text-[10px]">
                    {ownerTag}
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm">
                    {ownerCountry ? ownerCountry.names.name : ownerTag}
                  </div>
                  <div className="font-mono text-hoi-muted">{ownerTag}</div>
                </div>
              </div>
            ) : (
              <span className="text-amber-400 italic">Sin dueño (Tierra de nadie / neutral)</span>
            )}
          </div>

          {/* Cores */}
          <div className="rounded border border-hoi-border bg-hoi-bg p-3">
            <span className="text-hoi-muted uppercase font-semibold text-[10px] block mb-1">Cores (Reclamaciones)</span>
            {cores.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {cores.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-hoi-panel px-2 py-0.5 font-mono text-xs font-semibold border border-hoi-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-hoi-muted italic">Sin cores asignados</span>
            )}
          </div>

          {/* Información General */}
          <div className="space-y-2 rounded border border-hoi-border bg-hoi-bg p-3">
            <div className="flex justify-between">
              <span className="text-hoi-muted">Categoría:</span>
              <span className="font-medium capitalize">{selectedState.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-hoi-muted">Provincias ({selectedState.provinces.length}):</span>
              <span className="font-mono text-[11px] truncate max-w-[140px]" title={selectedState.provinces.join(', ')}>
                {selectedState.provinces.join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-hoi-muted">Puntos de Victoria:</span>
              <span className="font-mono">
                {selectedState.victoryPoints.length > 0
                  ? selectedState.victoryPoints.map(([p, pts]) => `${p}:${pts}`).join(', ')
                  : 'Ninguno'}
              </span>
            </div>
            <div className="flex justify-between border-t border-hoi-border/50 pt-2">
              <span className="text-hoi-muted flex items-center gap-1">
                <FileText size={12} /> Archivo:
              </span>
              <span className="font-mono text-[11px] text-hoi-accent">{selectedState.sourceFile}</span>
            </div>
            {selectedState.hasDateChanges && (
              <div className="flex items-center gap-1.5 text-amber-400 border-t border-hoi-border/50 pt-2">
                <Calendar size={12} />
                <span>Tiene cambios con fecha (1939...)</span>
              </div>
            )}
          </div>

          <button
            onClick={() => onCenterState(selectedState.id)}
            className="btn w-full justify-center"
          >
            <MapPin size={14} /> Centrar en el mapa
          </button>
        </div>
      </aside>
    )
  }

  // 2. Con País Activo seleccionado (y sin estado seleccionado)
  if (activeCountry) {
    // Obtener lista de estados que pertenecen a este país activo
    const ownedStates: State[] = []
    if (mapData) {
      Object.values(mapData.states).forEach((s) => {
        if (getEffectiveStateOwner(s) === activeCountry.tag) {
          ownedStates.push(s)
        }
      })
    }

    return (
      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-hoi-border bg-hoi-panel p-4 text-hoi-text overflow-y-auto">
        <div className="border-b border-hoi-border pb-3">
          <span className="text-xs font-mono text-hoi-accent uppercase">País Activo</span>
          <h2 className="text-lg font-bold truncate">{activeCountry.names.name}</h2>
          <span className="font-mono text-xs text-hoi-muted">{activeCountry.tag}</span>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          {/* Accesos directos del país */}
          <div className="space-y-1.5">
            <span className="text-hoi-muted uppercase font-semibold text-[10px]">Accesos Rápidos</span>
            <button
              onClick={() => onOpenTab('focos')}
              className="btn w-full justify-start gap-2"
            >
              <GitBranch size={14} className="text-hoi-accent" /> Árbol de focos de este país
            </button>
            <button
              onClick={() => onOpenWizardStep(activeCountry.uid, 2)}
              className="btn w-full justify-start gap-2"
            >
              <Flag size={14} className="text-amber-400" /> Banderas del país
            </button>
            <button
              onClick={() => onOpenWizardStep(activeCountry.uid, 3)}
              className="btn w-full justify-start gap-2"
            >
              <Users size={14} className="text-sky-400" /> Líderes y personajes
            </button>
            <button
              onClick={() => onOpenWizardStep(activeCountry.uid, 1)}
              className="btn w-full justify-start gap-2"
            >
              <Award size={14} className="text-emerald-400" /> Política e ideología
            </button>
          </div>

          {/* Lista de estados del país */}
          <div className="border-t border-hoi-border pt-3">
            <div className="flex items-center justify-between pb-2">
              <span className="text-hoi-muted uppercase font-semibold text-[10px]">
                Estados Pertenecientes ({ownedStates.length})
              </span>
            </div>
            {ownedStates.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-1 border border-hoi-border rounded bg-hoi-bg p-1">
                {ownedStates.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectState(s.id)
                      onCenterState(s.id)
                    }}
                    className="flex w-full items-center justify-between rounded p-1.5 text-left hover:bg-hoi-panel text-xs"
                  >
                    <span className="font-medium truncate max-w-[170px]">{s.name}</span>
                    <span className="font-mono text-[10px] text-hoi-muted">#{s.id}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded border border-hoi-border bg-hoi-bg p-3 text-center text-hoi-muted italic">
                Este país aún no posee estados en el mapa. Utiliza la herramienta Pincel (B) o Cubeta (G) para asignarle territorio.
              </div>
            )}
          </div>
        </div>
      </aside>
    )
  }

  // 3. Sin País Activo (Resumen del Mod)
  const issues = validateProject(project)
  const errCount = issues.filter((i) => i.severity === 'error').length
  const warnCount = issues.filter((i) => i.severity === 'aviso').length

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-hoi-border bg-hoi-panel p-4 text-hoi-text overflow-y-auto">
      <div className="border-b border-hoi-border pb-3">
        <span className="text-xs font-mono text-hoi-accent uppercase">Resumen del Mod</span>
        <h2 className="text-lg font-bold truncate">{project.modName}</h2>
      </div>

      <div className="space-y-4 pt-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOpenTab('paises')}
            className="flex flex-col items-center justify-center rounded border border-hoi-border bg-hoi-bg p-3 hover:bg-hoi-panel"
          >
            <Globe size={20} className="text-hoi-accent mb-1" />
            <span className="text-base font-bold">{project.countries.length}</span>
            <span className="text-[10px] text-hoi-muted">Países</span>
          </button>
          <button
            onClick={() => onOpenTab('ideas')}
            className="flex flex-col items-center justify-center rounded border border-hoi-border bg-hoi-bg p-3 hover:bg-hoi-panel"
          >
            <Award size={20} className="text-emerald-400 mb-1" />
            <span className="text-base font-bold">{project.ideas.length}</span>
            <span className="text-[10px] text-hoi-muted">Espíritus</span>
          </button>
        </div>

        <button
          onClick={onOpenValidator}
          className="flex w-full items-center justify-between rounded border border-hoi-border bg-hoi-bg p-3 hover:bg-hoi-panel"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={errCount > 0 ? 'text-red-400' : 'text-amber-400'} />
            <div className="text-left">
              <div className="font-bold">Validador del Mod</div>
              <div className="text-[10px] text-hoi-muted">
                {errCount} errores, {warnCount} avisos
              </div>
            </div>
          </div>
        </button>

        <div className="rounded border border-hoi-border bg-hoi-bg p-3 space-y-2">
          <div className="font-semibold text-hoi-accent">Edición del Mapa</div>
          <div className="text-hoi-muted/80 leading-relaxed">
            Selecciona o crea un país activo en la tarjeta flotante superior para pintar estados, establecer la capital o modificar cores.
          </div>
        </div>
      </div>
    </aside>
  )
}
