// Pestaña "Mapa": barra de herramientas, tarjeta del país activo, panel derecho,
// mapa en el centro y barra inferior. Tipo Paint: se pinta por ESTADO.
import { useEffect, useMemo, useRef, useState } from 'react'
import { registerCommands } from '../commands'
import {
  Eraser,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Shield,
  Star,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import type { Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import MapView, { type MapPointer, type MapViewHandle, type StrokeEvent } from './MapView'
import { handleStroke, type ToolId } from '../../map/tools'
import CountryCard from './CountryCard'
import NoNationSettings from './NoNationSettings'
import ExportImageDialog from './ExportImageDialog'
import { nextPendingIndex, noNationActive, pendingStates } from '../../map/noNation'
import { brushForKey, NO_NATION, setBrush } from '../../map/brush'
import { countryDrawColor } from '../../map/colors'
import { toHex } from '../../countries/color'
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
  lastValidatorMessage: _lastValidatorMessage
}: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const loading = useApp((s) => s.mapLoading)
  const mapError = useApp((s) => s.mapError)
  const gamePath = useApp((s) => s.gamePath)
  const activeTag = useApp((s) => s.activeTag)
  const selectedId = useApp((s) => s.selectedStateId)
  const focusReq = useApp((s) => s.focusStateRequest)
  const pick = useApp((s) => (s.pick?.kind === 'state' ? s.pick : null))
  const game = useApp(() => store.catalogGame())
  // Herramienta, vista y estilo: son de CADA pestaña (se guardan en store.ui) y la cinta los cambia
  const ui = useApp((s) => s.ui)
  const { tool, mapMode: mode, labels, capitals, provinceBorders, gameColors } = ui
  const setTool = (t: ToolId): void => store.setUi({ tool: t })
  const [exportOpen, setExportOpen] = useState(false)
  const [hover, setHover] = useState<MapPointer | null>(null)
  const brushOpts = ui.brushOpts
  const [reference, setReference] = useState<{
    src: string
    opacity: number
    visible: boolean
  } | null>(null)
  const viewRef = useRef<MapViewHandle>(null)
  // Lo que está bajo el cursor, para la barra de estado general
  useEffect(() => {
    const st = hover?.stateId ? map?.states.find((x) => x.id === hover.stateId) : undefined
    const text = hover
      ? st
        ? `${st.name} #${st.id} · provincia ${hover.province}`
        : `provincia ${hover.province} (mar/lago)`
      : ''
    if (store.get().mapStatus.hover !== text)
      store.set({ mapStatus: { ...store.get().mapStatus, hover: text } })
  }, [hover, map])
  // Comandos de la cinta (zoom, ajustar, imagen PNG, Sin nación…)
  useEffect(
    () =>
      registerCommands({
        mapZoomIn: () => viewRef.current?.zoomBy(1.25),
        mapZoomOut: () => viewRef.current?.zoomBy(0.8),
        mapFit: () => viewRef.current?.fit(),
        mapExportPng: () => setExportOpen(true),
        mapNoNation: () => setNnDialog(true),
        mapReload: () => void store.loadMap(false, true)
      }),
    []
  )

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
    if (tool === 'select' && phase === 'start')
      store.set({ selectedProvince: hover?.stateId === stateId ? (hover?.province ?? null) : null })
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
      <div className="flex min-h-0 flex-1">
        {/* 4. Mapa en el centro */}
        <div className="relative isolate min-w-0 flex-1">
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
              initialView={ui.mapView}
              onViewChange={(v) => {
                // Sin avisar a React en cada cuadro: la vista se guarda en la pestaña
                store.get().ui.mapView = v
                const z = Math.round(v.scale * 100)
                if (Math.round(store.get().mapStatus.zoom * 100) !== z)
                  store.set({ mapStatus: { ...store.get().mapStatus, zoom: v.scale } })
              }}
              onRendererKind={(k) =>
                store.set({ mapStatus: { ...store.get().mapStatus, engine: k } })
              }
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
              {mapError}
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

          {/* Aviso del mapa de demostración y la imagen de referencia (solo para calcar) */}
          <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
            {map?.source === 'demo' && (
              <div
                className="rounded border border-hoi-border bg-hoi-panel px-2 py-1 text-xs text-hoi-text shadow"
                title="Sus estados NO se exportan al mod. Configura la carpeta de HOI4 en Ajustes para usar el mapa real."
              >
                Mapa de demostración
              </div>
            )}
            <label
              className="flex cursor-pointer items-center gap-1 rounded border border-hoi-border bg-hoi-panel/95 px-2 py-1 text-xs"
              title="Si le quitas a un país del juego el estado de su capital, al exportar su capital pasa a su estado con más victory points (si no, el juego da el error «Attempting to set capital state»)"
            >
              <input
                type="checkbox"
                checked={project.mapSettings.moveLostCapitals !== false}
                onChange={(e) =>
                  store.updateProject((p) => ({
                    ...p,
                    mapSettings: { ...p.mapSettings, moveLostCapitals: e.target.checked }
                  }))
                }
              />
              Mover automáticamente las capitales perdidas
            </label>
            <div className="flex items-center gap-1 rounded border border-hoi-border bg-hoi-panel/95 px-2 py-1 text-xs">
              <label
                className="cursor-pointer"
                title="Subir una imagen PNG para calcar encima del mapa"
              >
                Referencia
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => loadReference(e.target.files?.[0])}
                />
              </label>
              {reference && (
                <>
                  <button
                    className="btn px-2 py-0.5"
                    onClick={() => setReference({ ...reference, visible: !reference.visible })}
                  >
                    {reference.visible ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={reference.opacity}
                    onChange={(e) =>
                      setReference({ ...reference, opacity: Number(e.target.value) })
                    }
                    className="w-20 accent-orange-500"
                    title="Opacidad"
                  />
                </>
              )}
            </div>
          </div>

          {pick && (
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded border border-hoi-accent bg-hoi-panel px-3 py-1 text-sm shadow">
              Haz clic en el estado que necesitas · Esc para cancelar
            </div>
          )}
        </div>

        {/* 3. Panel derecho contextual */}
        <aside className="flex w-80 min-h-0 flex-col border-l border-hoi-border bg-hoi-panel">
          <MapSidePanel project={project} onOpenWizard={onOpenWizard} onGoTab={onGoTab} />
        </aside>
      </div>

      {/* Barra de pendientes (solo con Sin nación); lo demás está en la barra de estado general */}
      {noNation && map && (
        <div className="flex items-center gap-4 border-t border-hoi-border bg-hoi-panel px-3 py-1 text-xs text-hoi-muted">
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
              className={`rounded px-2 py-0.5 ${pendingView ? 'bg-hoi-card ring-1 ring-hoi-accent' : 'bg-hoi-card hover:bg-hoi-border'}`}
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
                  <ChevronLeft size={12} className="inline" /> Anterior
                </button>
                <span className="font-mono">
                  {pendingIdx + 1}/{pending.length}
                </span>
                <button
                  className="rounded bg-hoi-card px-2 py-0.5 hover:bg-hoi-border"
                  title="Pendiente siguiente"
                  onClick={() => goPending(1)}
                >
                  Siguiente <ChevronRight size={12} className="inline" />
                </button>
              </>
            )}
          </span>
        </div>
      )}
      {nnDialog && <NoNationSettings project={project} onClose={() => setNnDialog(false)} />}
      {exportOpen && (
        <ExportImageDialog
          view={viewRef.current}
          modName={project.modName}
          initial={{ labels: labels !== 'ninguna' || capitals, provinceBorders }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
