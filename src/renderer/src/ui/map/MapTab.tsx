// Pestaña "Mapa": barra de herramientas, tarjeta del país activo, panel derecho,
// mapa en el centro y barra inferior. Tipo Paint: se pinta por ESTADO.
import { useEffect, useMemo, useRef, useState } from 'react'
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
import PalettePanel from './PalettePanel'
import NoNationSettings from './NoNationSettings'
import { nextPendingIndex, noNationActive, pendingStates } from '../../map/noNation'
import { brushForKey, NO_NATION, setBrush } from '../../map/brush'
import { countryDrawColor } from '../../map/colors'
import { toHex } from '../../countries/color'
import MapBaseDialog from './MapBaseDialog'
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
  {
    id: 'brush',
    label: 'Pincel (clic derecho borra)',
    key: 'B',
    icon: <Paintbrush size={16} />,
    cursor: 'crosshair'
  },
  {
    id: 'bucket',
    label: 'Cubeta (sin confirmación; clic derecho borra)',
    key: 'G',
    icon: <PaintBucket size={16} />,
    cursor: 'cell'
  },
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
  // Herramienta por defecto: el Pincel si ya hay un país como pincel
  const [tool, setTool] = useState<ToolId>(() => (store.get().activeTag ? 'brush' : 'select'))
  const [mode, setMode] = useState<ViewMode>('politico')
  // Estilo del mapa
  const [labels, setLabels] = useState<LabelMode>('id')
  const [capitals, setCapitals] = useState(true)
  const [provinceBorders, setProvinceBorders] = useState(false)
  const [gameColors, setGameColors] = useState(false)
  const [hover, setHover] = useState<MapPointer | null>(null)
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

  // Base del mapa: se pregunta UNA vez; el mapa cargado sigue a la base elegida
  const ms = project.mapSettings
  // Modo Sin nación: pendientes y recorrido uno por uno
  const noNation = noNationActive(project)
  const pendingView = useApp((s) => s.pendingView)
  const [nnDialog, setNnDialog] = useState(false)
  const [pendingIdx, setPendingIdx] = useState(0)
  const pending = useMemo(
    () => (map && noNation ? pendingStates(project, map) : []),
    [map, project, noNation]
  )
  const goPending = (dir: number): void => {
    if (!pending.length) return
    const i = nextPendingIndex(pending.length, pendingIdx, dir)
    setPendingIdx(i)
    store.focusState(pending[i])
  }
  const [baseDialog, setBaseDialog] = useState(ms.base === null)
  useEffect(() => {
    void store.ensureMap()
  }, [ms.base, ms.mod?.path, gamePath])

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
      // Teclas 1–9: las primeras 9 muestras de "Mis países"
      if (/^[1-9]$/.test(e.key)) {
        const tag = brushForKey(project, e.key)
        if (tag) setBrush(tag)
        return
      }
      if (found) setTool(found.id)
      else if (k === 'F') viewRef.current?.fit()
      else if (k === '+' || k === '=') viewRef.current?.zoomBy(1.25)
      else if (k === '-') viewRef.current?.zoomBy(0.8)
      else if (e.key === 'Escape' && pick) store.cancelPick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick, project.countries])

  useEffect(() => {
    if (activeTag && (tool === 'select' || tool === 'eyedropper')) setTool('brush')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag])

  const toast = (m: string, opts: { undo?: boolean; error?: boolean } = {}): void =>
    store.toast(m, { undo: opts.undo, kind: opts.error ? 'error' : 'info' })

  const onStroke = (phase: 'start' | 'move' | 'end', stateId: number, e: StrokeEvent): void => {
    // Modo "elegir en el mapa" (capital del asistente, bloques…)
    if (pick) {
      if (phase !== 'start') return
      if (!stateId) return toast('Eso es mar: elige un estado de tierra.')
      store.finishPick(String(stateId))
      return
    }
    handleStroke(tool, phase, stateId, e, { toast, brush: brushOpts })
  }

  const loadReference = (file: File | undefined): void => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setReference({ src: String(r.result), opacity: 50, visible: true })
    r.readAsDataURL(file)
  }

  const toolInfo = TOOLS.find((t) => t.id === tool)!
  // Cursor: un circulito con el color del pincel activo (Pincel y Cubeta)
  const brushCursor = useMemo(() => {
    if (tool !== 'brush' && tool !== 'bucket' && tool !== 'eraser') return null
    const erase = tool === 'eraser' || activeTag === NO_NATION
    if (!erase && !activeTag) return null
    const fill = erase ? '#ffffff' : toHex(countryDrawColor(activeTag!, project, game, gameColors))
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">` +
      `<circle cx="10" cy="10" r="7" fill="${fill}" stroke="#111" stroke-width="2"${erase ? ' stroke-dasharray="3 2"' : ''}/>` +
      `<circle cx="10" cy="10" r="8.5" fill="none" stroke="#fff" stroke-width="1"/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, crosshair`
  }, [tool, activeTag, project, game, gameColors])
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
        <button
          className="btn px-2 text-xs"
          title="Punto de partida del mapa"
          onClick={() => setBaseDialog(true)}
        >
          🗺 Base:{' '}
          {ms.base === 'blank'
            ? 'lienzo en blanco'
            : ms.base === 'mod'
              ? `mod "${ms.mod?.name}"`
              : 'mapa del juego'}
          {noNation && ' · Sin nación'}
        </button>
        {noNation && (
          <button
            className="btn px-2 text-xs"
            title="Nombre, tag y cores del país técnico"
            onClick={() => setNnDialog(true)}
          >
            ⚙ Sin nación
          </button>
        )}
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
        {/* Paleta de países (izquierda, plegable) */}
        <PalettePanel project={project} gameColors={gameColors} onOpenWizard={onOpenWizard} />
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
                blankUnpainted: ms.base === 'blank',
                highlightPending: noNation && pendingView
              }}
              labels={labels}
              capitals={capitals}
              provinceBorders={provinceBorders}
              cursor={pick ? 'crosshair' : (brushCursor ?? toolInfo.cursor)}
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
            <CountryCard project={project} gameColors={gameColors} onOpenWizard={onOpenWizard} />
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
              <label
                className="flex items-center gap-1"
                title="Nombre del país con ★ en su capital"
              >
                <input
                  type="checkbox"
                  checked={capitals}
                  onChange={(e) => setCapitals(e.target.checked)}
                />
                Capitales
              </label>
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
        {noNation && map && (
          <span className="flex items-center gap-2 text-hoi-text">
            <span title="Estados que todavía son Sin nación">
              Pendientes: <b>{pending.length}</b> de {map.states.length} estados
            </span>
            <span
              className="h-2 w-24 overflow-hidden rounded bg-hoi-card"
              title="Progreso del mapa"
            >
              <span
                className="block h-full bg-emerald-500"
                style={{
                  width: `${((map.states.length - pending.length) / Math.max(1, map.states.length)) * 100}%`
                }}
              />
            </span>
            <button
              className={`rounded px-2 py-0.5 ${pendingView ? 'bg-amber-500 text-black' : 'bg-hoi-card hover:bg-hoi-border'}`}
              onClick={() => store.set({ pendingView: !pendingView })}
            >
              Ver pendientes
            </button>
            {pendingView && pending.length > 0 && (
              <>
                <button
                  className="rounded bg-hoi-card px-2 py-0.5 hover:bg-hoi-border"
                  title="Pendiente anterior"
                  onClick={() => goPending(-1)}
                >
                  ◀ Anterior
                </button>
                <span className="font-mono">
                  {pendingIdx + 1}/{pending.length}
                </span>
                <button
                  className="rounded bg-hoi-card px-2 py-0.5 hover:bg-hoi-border"
                  title="Pendiente siguiente"
                  onClick={() => goPending(1)}
                >
                  Siguiente ▶
                </button>
              </>
            )}
          </span>
        )}
        {rendererKind && (
          <span title="Motor de dibujo">{rendererKind === 'webgl2' ? 'WebGL2' : 'Canvas 2D'}</span>
        )}
        <span className="flex-1 truncate text-right" title={lastValidatorMessage}>
          {lastValidatorMessage}
        </span>
      </div>
      {baseDialog && <MapBaseDialog project={project} onClose={() => setBaseDialog(false)} />}
      {nnDialog && <NoNationSettings project={project} onClose={() => setNnDialog(false)} />}
    </div>
  )
}
