import React, { useState, useEffect, useRef } from 'react'
import type { Project } from '../../types'
import type { MapData, State } from '../../map/types'
import { generateDemoMap } from '../../map/demoMap'
import MapToolbar, { type MapTool, type BrushOptions } from './MapToolbar'
import ActiveCountryCard from './ActiveCountryCard'
import MapRightPanel from './MapRightPanel'
import MapFooter, { type ViewMode } from './MapFooter'
import ReferenceImageControl, { type ReferenceImageState } from './ReferenceImageControl'
import MapCanvas from './MapCanvas'
import { store, useApp } from '../../store/appStore'
import { X } from 'lucide-react'

interface MapTabProps {
  project: Project
  onOpenTab: (tabName: 'focos' | 'paises' | 'ideas' | 'iconos') => void
  onOpenWizardStep: (countryUid: string, step: number) => void
  onCreateCountry: () => void
  onOpenValidator: () => void
}

export default function MapTab({
  project,
  onOpenTab,
  onOpenWizardStep,
  onCreateCountry,
  onOpenValidator
}: MapTabProps): JSX.Element {
  const settings = useApp((s) => s.game)
  const canUndo = useApp((s) => s.past.length > 0)
  const canRedo = useApp((s) => s.future.length > 0)

  // Mapa en memoria (por defecto Mapa de Demostración)
  const [mapData, setMapData] = useState<MapData>(() => generateDemoMap())
  const [loadingMap, setLoadingMap] = useState(false)
  const [loadProgress, setLoadProgress] = useState<{ progress: number; message: string } | null>(null)
  const [lastValidatorMsg, setLastValidatorMsg] = useState('')

  // Estado de la interfaz
  const [activeCountryTag, setActiveCountryTag] = useState<string | null>(
    project.countries[0]?.tag ?? null
  )
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null)
  const [tool, setTool] = useState<MapTool>('select')
  const [brushOpts, setBrushOpts] = useState<BrushOptions>({
    giveCoreOnPaint: true,
    removePreviousCores: false
  })
  const [viewMode, setViewMode] = useState<ViewMode>('political')
  const [refImg, setRefImg] = useState<ReferenceImageState>({
    dataUrl: null,
    opacity: 0.5,
    visible: false
  })

  // Cursor y Vista
  const [hoveredProvId, setHoveredProvId] = useState<number | null>(null)
  const [hoveredStateId, setHoveredStateId] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)

  const canvasRef = useRef<{ centerOnState: (stateId: number) => void; fitMap: () => void; zoomIn: () => void; zoomOut: () => void } | null>(null)

  // Cargar mapa real si hay carpeta del juego configurada
  useEffect(() => {
    const api = window.electronAPI
    if (api && settings?.gamePath) {
      setLoadingMap(true)
      const unsub = api.onMapLoadProgress?.((data) => {
        setLoadProgress(data)
      })

      api
        .loadRealMap(settings.gamePath)
        .then((res) => {
          setMapData(res.mapData)
          if (res.missingColorCount > 0) {
            setLastValidatorMsg(
              `Aviso: ${res.missingColorCount} colores de provinces.bmp no están en definition.csv`
            )
          }
        })
        .catch((err) => {
          setLastValidatorMsg(`Error al cargar el mapa real: ${err.message}`)
        })
        .finally(() => {
          setLoadingMap(false)
          setLoadProgress(null)
          unsub?.()
        })
    }
  }, [settings?.gamePath])

  const pick = useApp((s) => s.pick)
  const isPickingState = pick?.kind === 'state'

  const activeCountry = project.countries.find((c) => c.tag === activeCountryTag) ?? null
  const selectedState = selectedStateId && mapData ? mapData.states[selectedStateId] ?? null : null

  // Manejo de atajo Esc para cancelar pick
  useEffect(() => {
    if (!isPickingState) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.cancelPick()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPickingState])

  return (
    <div className="flex h-full w-full flex-col bg-hoi-bg select-none">
      {/* Barra superior de herramientas del mapa */}
      <MapToolbar
        tool={tool}
        setTool={setTool}
        brushOpts={brushOpts}
        setBrushOpts={setBrushOpts}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitMap={() => canvasRef.current?.fitMap()}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => store.undo()}
        onRedo={() => store.redo()}
      />

      {/* Banner de Selección de Estado (startPick) */}
      {isPickingState && (
        <div className="flex items-center justify-between bg-hoi-accent px-4 py-2 text-black font-semibold text-xs shadow-md z-30">
          <span>🗺 Selecciona un estado en el mapa para asignar el campo (Presiona Esc para cancelar)</span>
          <button
            onClick={() => store.cancelPick()}
            className="rounded p-1 hover:bg-black/10 text-black"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Área principal: Canvas central + Paneles flotantes y lateral derecho */}
      <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Banner / Insignia de Mapa de Demostración */}
        {mapData.isDemoMap && (
          <div className="absolute right-16 top-4 z-10 rounded bg-amber-500/20 border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur-sm">
            🗺 Mapa de demostración
          </div>
        )}

        {/* Carga del mapa real (overlay) */}
        {loadingMap && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 text-hoi-text">
            <div className="w-80 rounded-lg border border-hoi-border bg-hoi-panel p-6 shadow-2xl text-center space-y-3">
              <h3 className="font-bold text-hoi-accent text-lg">Cargando Mapa Real...</h3>
              <p className="text-xs text-hoi-muted">{loadProgress?.message || 'Procesando archivos...'}</p>
              <div className="w-full bg-hoi-bg h-3 rounded-full overflow-hidden border border-hoi-border">
                <div
                  className="bg-hoi-accent h-full transition-all duration-200"
                  style={{ width: `${loadProgress?.progress ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-hoi-muted">{loadProgress?.progress ?? 0}%</p>
            </div>
          </div>
        )}

        {/* Tarjeta de País Activo (Flotante arriba a la izquierda) */}
        <ActiveCountryCard
          project={project}
          activeCountry={activeCountry}
          onSelectCountry={setActiveCountryTag}
          onEditCountry={(uid) => onOpenWizardStep(uid, 0)}
          onCreateCountry={onCreateCountry}
          onCenterState={(sid) => canvasRef.current?.centerOnState(sid)}
        />

        {/* Control de Imagen de Referencia (Flotante arriba a la derecha) */}
        <ReferenceImageControl refImg={refImg} setRefImg={setRefImg} />

        {/* Canvas de Mapa (WebGL2 / Canvas2D) */}
        <div className="relative flex-1 min-w-0 min-h-0 bg-black overflow-hidden">
          <MapCanvas
            ref={canvasRef}
            project={project}
            mapData={mapData}
            activeCountryTag={activeCountryTag}
            selectedStateId={selectedStateId}
            tool={tool}
            brushOpts={brushOpts}
            viewMode={viewMode}
            refImg={refImg}
            onSelectState={setSelectedStateId}
            onHoverProvState={(pid, sid) => {
              setHoveredProvId(pid)
              setHoveredStateId(sid)
            }}
            onZoomChange={setZoom}
            onSetValidatorMessage={setLastValidatorMsg}
            onSelectActiveCountry={setActiveCountryTag}
            onCreateCountry={onCreateCountry}
          />
        </div>

        {/* Panel Derecho Contextual */}
        <MapRightPanel
          project={project}
          activeCountry={activeCountry}
          selectedState={selectedState}
          mapData={mapData}
          onSelectState={setSelectedStateId}
          onCenterState={(sid) => canvasRef.current?.centerOnState(sid)}
          onOpenTab={onOpenTab}
          onOpenWizardStep={onOpenWizardStep}
          onOpenValidator={onOpenValidator}
        />
      </div>

      {/* Barra Inferior */}
      <MapFooter
        tool={tool}
        hoveredProvId={hoveredProvId}
        hoveredStateId={hoveredStateId}
        mapData={mapData}
        zoom={zoom}
        lastValidatorMessage={lastValidatorMsg}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
    </div>
  )
}
