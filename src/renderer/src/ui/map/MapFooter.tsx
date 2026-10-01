import React from 'react'
import type { MapTool } from './MapToolbar'
import type { MapData } from '../../map/types'

export type ViewMode = 'political' | 'states' | 'cores' | 'changes'

interface MapFooterProps {
  tool: MapTool
  hoveredProvId: number | null
  hoveredStateId: number | null
  mapData: MapData | null
  zoom: number
  lastValidatorMessage: string
  viewMode: ViewMode
  setViewMode: (vm: ViewMode) => void
}

export default function MapFooter({
  tool,
  hoveredProvId,
  hoveredStateId,
  mapData,
  zoom,
  lastValidatorMessage,
  viewMode,
  setViewMode
}: MapFooterProps): JSX.Element {
  const toolLabels: Record<MapTool, string> = {
    select: 'Seleccionar (V)',
    brush: 'Pincel (B)',
    bucket: 'Cubeta (G)',
    capital: 'Fijar capital (C)',
    core: 'Agregar/quitar core (K)',
    eraser: 'Borrador (E)',
    eyedropper: 'Cuentagotas (I)'
  }

  const hoveredState = hoveredStateId && mapData ? mapData.states[hoveredStateId] : null
  const hoveredProv = hoveredProvId && mapData ? mapData.provinces[hoveredProvId] : null

  return (
    <footer className="flex items-center justify-between border-t border-hoi-border bg-hoi-panel px-3 py-1 text-xs text-hoi-text">
      <div className="flex items-center gap-4">
        <div>
          <span className="text-hoi-muted">Herramienta: </span>
          <span className="font-medium text-hoi-accent">{toolLabels[tool]}</span>
        </div>

        <div className="h-4 w-px bg-hoi-border" />

        <div>
          {hoveredState ? (
            <span>
              <span className="text-hoi-muted">Provincia #{hoveredProvId ?? '—'}</span>
              {hoveredProv?.coastal && <span className="text-sky-400 font-mono text-[10px] ml-1">(Costera)</span>}
              {' · '}
              <span className="font-semibold">{hoveredState.name}</span>
              <span className="text-hoi-muted font-mono ml-1">(#{hoveredState.id})</span>
            </span>
          ) : (
            <span className="text-hoi-muted italic">Mueve el cursor sobre el mapa</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Selector de Modo de Vista */}
        <div className="flex items-center gap-1 bg-hoi-bg px-2 py-0.5 rounded border border-hoi-border">
          <span className="text-[10px] text-hoi-muted mr-1">Vista:</span>
          <button
            onClick={() => setViewMode('political')}
            className={`px-1.5 py-0.5 text-[11px] rounded ${
              viewMode === 'political' ? 'bg-hoi-accent text-black font-semibold' : 'text-hoi-muted hover:text-hoi-text'
            }`}
          >
            Político
          </button>
          <button
            onClick={() => setViewMode('states')}
            className={`px-1.5 py-0.5 text-[11px] rounded ${
              viewMode === 'states' ? 'bg-hoi-accent text-black font-semibold' : 'text-hoi-muted hover:text-hoi-text'
            }`}
          >
            Estados
          </button>
          <button
            onClick={() => setViewMode('cores')}
            className={`px-1.5 py-0.5 text-[11px] rounded ${
              viewMode === 'cores' ? 'bg-hoi-accent text-black font-semibold' : 'text-hoi-muted hover:text-hoi-text'
            }`}
          >
            Cores
          </button>
          <button
            onClick={() => setViewMode('changes')}
            className={`px-1.5 py-0.5 text-[11px] rounded ${
              viewMode === 'changes' ? 'bg-hoi-accent text-black font-semibold' : 'text-hoi-muted hover:text-hoi-text'
            }`}
          >
            Cambios
          </button>
        </div>

        <div className="h-4 w-px bg-hoi-border" />

        <div>
          <span className="text-hoi-muted">Zoom: </span>
          <span className="font-mono">{Math.round(zoom * 100)}%</span>
        </div>

        {lastValidatorMessage && (
          <>
            <div className="h-4 w-px bg-hoi-border" />
            <div className="text-amber-400 font-medium truncate max-w-xs" title={lastValidatorMessage}>
              {lastValidatorMessage}
            </div>
          </>
        )}
      </div>
    </footer>
  )
}
