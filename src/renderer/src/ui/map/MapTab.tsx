// Pestaña "Mapa": barra de herramientas, tarjeta del país activo, panel derecho,
// mapa en el centro y barra inferior. Tipo Paint: se pinta por ESTADO.
import { useEffect, useRef, useState } from 'react'
import {
  Eraser,
  Maximize,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Redo2,
  Shield,
  Star,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import MapView, {
  LABEL_MODES,
  type LabelMode,
  type MapPointer,
  type MapViewHandle,
  type StrokeEvent
} from './MapView'
import { VIEW_MODES, type ViewMode } from '../../map/colors'
import { handleStroke, type ToolId } from '../../map/tools'
import CountryCard from './CountryCard'
import MapSidePanel from './MapSidePanel'

interface Props {
  project: Project
  onOpenWizard: (countryUid?: string, step?: number) => void
  onGoTab: (tab: 'focos' | 'paises' | 'ideas' | 'iconos') => void
  lastValidatorMessage: string
}

export const TOOLS: {
  id: ToolId
  label: string
  key: string
  icon: JSX.Element
  cursor: string
}[] = [
  {
    id: 'select',
    label: 'Seleccionar',
    key: 'V',
    icon: <MousePointer2 size={16} />,
    cursor: 'default'
  },
  { id: 'brush', label: 'Pincel', key: 'B', icon: <Paintbrush size={16} />, cursor: 'crosshair' },
  { id: 'bucket', label: 'Cubeta', key: 'G', icon: <PaintBucket size={16} />, cursor: 'cell' },
  { id: 'capital', label: 'Fijar capital', key: 'C', icon: <Star size={16} />, cursor: 'pointer' },
  {
    id: 'core',
    label: 'Agregar/quitar core (Shift = quitar)',
    key: 'K',
    icon: <Shield size={16} />,
    cursor: 'copy'
  },
  {
    id: 'eraser',
    label: 'Borrador (vuelve al original)',
    key: 'E',
    icon: <Eraser size={16} />,
    cursor: 'not-allowed'
  },
  {
    id: 'eyedropper',
    label: 'Cuentagotas (tomar país)',
    key: 'I',
    icon: <Pipette size={16} />,
    cursor: 'alias'
  }
]

export default function MapTab({
  project,
  onOpenWizard,
  onGoTab,
  lastValidatorMessage
}: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const loading = useApp((s) => s.mapLoading)
  const mapError = useApp((s) => s.mapError)
  const gamePath = useApp((s) => s.gamePath)
  const activeTag = useApp((s) => s.activeTag)
  const selectedId = useApp((s) => s.selectedStateId)
  const focusReq = useApp((s) => s.focusStateRequest)
  const pick = useApp((s) => (s.pick?.kind === 'state' ? s.pick : null))
  const canUndo = useApp((s) => s.past.length > 0)
  const canRedo = useApp((s) => s.future.length > 0)
  const game = useApp(() => store.catalogGame())
  const [tool, setTool] = useState<ToolId>('select')
  const [mode, setMode] = useState<ViewMode>('politico')
  // Estilo del mapa
  const [labels, setLabels] = useState<LabelMode>('id')
  const [provinceBorders, setProvinceBorders] = useState(false)
  const [gameColors, setGameColors] = useState(false)
  const [hover, setHover] = useState<MapPointer | null>(null)
  const [message, setMessage] = useState('')
  const [zoom, setZoom] = useState(1)
  const [rendererKind, setRendererKind] = useState('')
  const [brushOpts, setBrushOpts] = useState({ giveCore: true, removePreviousCores: false })
  const [reference, setReference] = useState<{
    src: string
    opacity: number
    visible: boolean
  } | null>(null)
  const viewRef = useRef<MapViewHandle>(null)
  const hoverState = hover?.stateId ? map?.states.find((s) => s.id === hover.stateId) : undefined

  // Cargar el mapa la primera vez
  useEffect(() => {
    if (!map && !loading) void store.loadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pedidos de "centrar en un estado" (lista de estados, validador, capital)
  useEffect(() => {
    if (focusReq) viewRef.current?.centerOn(focusReq.id)
  }, [focusReq])

  // Atajos de teclado (fuera de campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (
        t.closest('input,textarea,select,[contenteditable],.injectionDiv') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return
      if (e.key === 'Escape' && pick) {
        store.cancelPick()
        return
      }
      // Hay una ventana visible encima (las ocultas, como el asistente mientras eliges, no cuentan)
      if (
        [...document.querySelectorAll<HTMLElement>('[data-modal]')].some(
          (m) => m.getClientRects().length > 0
        )
      )
        return
      const k = e.key.toUpperCase()
      const found = TOOLS.find((x) => x.key === k)
      if (found) setTool(found.id)
      else if (k === 'F') viewRef.current?.fit()
      else if (k === '+' || k === '=') viewRef.current?.zoomBy(1.25)
      else if (k === '-') viewRef.current?.zoomBy(0.8)
      else if (e.key === 'Escape' && pick) store.cancelPick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick])

  const say = (m: string): void => setMessage(m)

  const onStroke = (phase: 'start' | 'move' | 'end', stateId: number, e: StrokeEvent): void => {
    // Modo "elegir en el mapa" (capital del asistente, bloques…)
    if (pick) {
      if (phase !== 'start') return
      if (!stateId) return say('Eso es mar: elige un estado de tierra.')
      store.finishPick(String(stateId))
      return
    }
    handleStroke(tool, phase, stateId, e, { say, brush: brushOpts })
  }

  const loadReference = (file: File | undefined): void => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setReference({ src: String(r.result), opacity: 50, visible: true })
    r.readAsDataURL(file)
  }

  const toolInfo = TOOLS.find((t) => t.id === tool)!
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 1. Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-hoi-border bg-hoi-panel px-2 py-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.key})`}
            className={tool === t.id ? 'btn-primary px-2' : 'btn px-2'}
            onClick={() => setTool(t.id)}
          >
            {t.icon}
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-hoi-border" />
        <button
          className="btn px-2"
          title="Acercar (+)"
          onClick={() => viewRef.current?.zoomBy(1.25)}
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="btn px-2"
          title="Alejar (–)"
          onClick={() => viewRef.current?.zoomBy(0.8)}
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="btn px-2"
          title="Ajustar al mapa (F)"
          onClick={() => viewRef.current?.fit()}
        >
          <Maximize size={16} />
        </button>
        <button
          className="btn px-2 disabled:opacity-40"
          title="Deshacer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => store.undo()}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn px-2 disabled:opacity-40"
          title="Rehacer (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => store.redo()}
        >
          <Redo2 size={16} />
        </button>
        {tool === 'brush' && (
          <div className="ml-2 flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={brushOpts.giveCore}
                onChange={(e) => setBrushOpts({ ...brushOpts, giveCore: e.target.checked })}
              />
              Dar core al pintar
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={brushOpts.removePreviousCores}
                onChange={(e) =>
                  setBrushOpts({ ...brushOpts, removePreviousCores: e.target.checked })
                }
              />
              Quitar cores del dueño anterior
            </label>
          </div>
        )}
        <div className="flex-1" />
        {/* Imagen de referencia (solo visual) */}
        <label
          className="btn cursor-pointer px-2 text-xs"
          title="Subir una imagen PNG para calcar encima del mapa"
        >
          🖼 Referencia
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => loadReference(e.target.files?.[0])}
          />
        </label>
        {reference && (
          <div className="flex items-center gap-1 text-xs">
            <button
              className="btn px-2 py-1"
              onClick={() => setReference({ ...reference, visible: !reference.visible })}
            >
              {reference.visible ? 'Ocultar' : 'Mostrar'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={reference.opacity}
              onChange={(e) => setReference({ ...reference, opacity: Number(e.target.value) })}
              className="w-24 accent-orange-500"
              title="Opacidad"
            />
            <span className="w-8">{reference.opacity}%</span>
          </div>
        )}
        {gamePath && (
          <button
            className="btn px-2 text-xs"
            title="Volver a leer el mapa del juego"
            onClick={() => void store.loadMap()}
          >
            Recargar mapa
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 4. Mapa en el centro */}
        <div className="relative min-w-0 flex-1">
          {map && (
            <MapView
              ref={viewRef}
              map={map}
              project={project}
              game={game}
              paletteOptions={{
                mode,
                activeTag,
                selectedId,
                gameColors,
                blankUnpainted: false,
                highlightPending: false
              }}
              labels={labels}
              provinceBorders={provinceBorders}
              cursor={pick ? 'crosshair' : toolInfo.cursor}
              reference={reference}
              onStroke={onStroke}
              onHover={setHover}
              onViewChange={(v) => setZoom(v.scale)}
              onRendererKind={setRendererKind}
            />
          )}
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-hoi-bg/90">
              <div className="text-sm">{loading.message}</div>
              <div className="h-3 w-80 overflow-hidden rounded bg-hoi-card">
                <div
                  className="h-full bg-hoi-accent transition-all"
                  style={{ width: `${loading.pct}%` }}
                />
              </div>
              <div className="text-xs text-hoi-muted">{loading.pct} %</div>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-x-0 top-12 z-30 mx-auto w-fit max-w-lg rounded border border-red-500 bg-red-950/90 p-3 text-sm">
              ❌ {mapError}
              <div className="mt-2 flex gap-2">
                <button className="btn text-xs" onClick={() => void store.loadMap()}>
                  Reintentar
                </button>
                <button className="btn text-xs" onClick={() => void store.loadMap(true)}>
                  Usar el mapa de demostración
                </button>
              </div>
            </div>
          )}

          {/* 2. Tarjeta del país activo */}
          <div className="absolute left-3 top-3 z-10">
            <CountryCard project={project} onOpenWizard={onOpenWizard} />
          </div>

          {/* Etiqueta del mapa y selector de modo de vista */}
          <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
            {map?.source === 'demo' && (
              <div
                className="rounded bg-sky-600/90 px-2 py-1 text-xs font-semibold text-white shadow"
                title="Sus estados NO se exportan al mod. Configura la carpeta de HOI4 en Ajustes para usar el mapa real."
              >
                Mapa de demostración
              </div>
            )}
            <select
              className="rounded border border-hoi-border bg-hoi-panel px-2 py-1 text-xs"
              value={mode}
              onChange={(e) => setMode(e.target.value as ViewMode)}
            >
              {VIEW_MODES.map(([m, l]) => (
                <option key={m} value={m}>
                  Vista: {l}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-hoi-border bg-hoi-panel px-2 py-1 text-xs"
              value={labels}
              onChange={(e) => setLabels(e.target.value as LabelMode)}
              title="Etiquetas de los estados (solo se muestran si caben)"
            >
              {LABEL_MODES.map(([m, l]) => (
                <option key={m} value={m}>
                  Etiquetas: {l}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-0.5 rounded border border-hoi-border bg-hoi-panel/95 px-2 py-1 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={provinceBorders}
                  onChange={(e) => setProvinceBorders(e.target.checked)}
                />
                Fronteras de provincia
              </label>
              <label
                className="flex items-center gap-1"
                title="Aplica el apagado del juego: saturación ×0.6 y valor ×0.8"
              >
                <input
                  type="checkbox"
                  checked={gameColors}
                  onChange={(e) => setGameColors(e.target.checked)}
                />
                Colores como en el juego
              </label>
            </div>
          </div>

          {pick && (
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded bg-amber-500 px-3 py-1 text-sm font-semibold text-black shadow">
              🗺 Haz clic en el estado que necesitas · Esc para cancelar
            </div>
          )}
        </div>

        {/* 3. Panel derecho contextual */}
        <aside className="flex w-80 min-h-0 flex-col border-l border-hoi-border bg-hoi-panel">
          <MapSidePanel project={project} onOpenWizard={onOpenWizard} onGoTab={onGoTab} />
        </aside>
      </div>

      {/* 5. Barra inferior */}
      <div className="flex items-center gap-4 border-t border-hoi-border bg-hoi-panel px-3 py-1 text-xs text-hoi-muted">
        <span className="text-hoi-text">{pick ? 'Elegir en el mapa' : toolInfo.label}</span>
        <span>
          {hover
            ? hoverState
              ? `${hoverState.name} #${hoverState.id} · provincia ${hover.province}`
              : `provincia ${hover.province} (mar/lago)`
            : '—'}
        </span>
        <span>Zoom {Math.round(zoom * 100)} %</span>
        {rendererKind && (
          <span title="Motor de dibujo">{rendererKind === 'webgl2' ? 'WebGL2' : 'Canvas 2D'}</span>
        )}
        <span className="flex-1 truncate text-right" title={message || lastValidatorMessage}>
          {message || lastValidatorMessage}
        </span>
      </div>
    </div>
  )
}
