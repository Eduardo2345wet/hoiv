import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback
} from 'react'
import type { Country, Project } from '../../types'
import type { MapData, State } from '../../map/types'
import type { MapTool, BrushOptions } from './MapToolbar'
import type { ViewMode } from './MapFooter'
import type { ReferenceImageState } from './ReferenceImageControl'
import { mapColor } from '../../countries/color'
import { store, useApp } from '../../store/appStore'

export interface MapCanvasHandle {
  centerOnState: (stateId: number) => void
  fitMap: () => void
  zoomIn: () => void
  zoomOut: () => void
}

interface MapCanvasProps {
  project: Project
  mapData: MapData
  activeCountryTag: string | null
  selectedStateId: number | null
  tool: MapTool
  brushOpts: BrushOptions
  viewMode: ViewMode
  refImg: ReferenceImageState
  onSelectState: (stateId: number | null) => void
  onHoverProvState: (provId: number | null, stateId: number | null) => void
  onZoomChange: (zoom: number) => void
  onSetValidatorMessage: (msg: string) => void
  onSelectActiveCountry: (tag: string) => void
  onCreateCountry: () => void
}

function getStableColorForTag(tag: string): [number, number, number] {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const r = (Math.abs(hash) % 180) + 40
  const g = (Math.abs(hash >> 3) % 180) + 40
  const b = (Math.abs(hash >> 6) % 180) + 40
  return [r, g, b]
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    project,
    mapData,
    activeCountryTag,
    selectedStateId,
    tool,
    brushOpts,
    viewMode,
    refImg,
    onSelectState,
    onHoverProvState,
    onZoomChange,
    onSetValidatorMessage,
    onSelectActiveCountry,
    onCreateCountry
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null)

  // Zoom & Pan
  const [zoom, setZoomState] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const isSpacePressedRef = useRef(false)
  const isMouseDownRef = useRef(false)
  const currentStrokeStatesRef = useRef<Set<number>>(new Set())
  const strokeGroupRef = useRef<string | null>(null)

  const pick = useApp((s) => s.pick)

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    stateName: string
    stateId: number
    owner: string
    cores: string[]
    provId: number
    victoryPoints: number
  } | null>(null)

  // Obtener dueño efectivo de estado
  const getEffectiveOwner = useCallback(
    (s: State): string => {
      const edit = project.stateEdits?.[s.id]
      if (edit && edit.owner !== undefined) return edit.owner
      return s.originalOwner
    },
    [project.stateEdits]
  )

  // Obtener cores efectivos de estado
  const getEffectiveCores = useCallback(
    (s: State): string[] => {
      const edit = project.stateEdits?.[s.id]
      let cores = [...s.originalCores]
      if (edit) {
        if (edit.removeCores) cores = cores.filter((c) => !edit.removeCores?.includes(c))
        if (edit.addCores) {
          edit.addCores.forEach((c) => {
            if (!cores.includes(c)) cores.push(c)
          })
        }
      }
      return cores
    },
    [project.stateEdits]
  )

  // Obtener color RGB asignado a un estado según viewMode
  const getStateColor = useCallback(
    (s: State): [number, number, number] => {
      if (viewMode === 'states') {
        const h = (s.id * 137.508) % 360
        return [
          Math.floor(128 + 127 * Math.cos((h * Math.PI) / 180)),
          Math.floor(128 + 127 * Math.sin((h * Math.PI) / 180)),
          Math.floor(128 + 127 * Math.cos(((h + 120) * Math.PI) / 180))
        ]
      }

      if (viewMode === 'cores') {
        if (activeCountryTag) {
          const cores = getEffectiveCores(s)
          if (cores.includes(activeCountryTag)) {
            return [245, 158, 11] // Ámbar brillante
          }
        }
        return [60, 60, 70]
      }

      if (viewMode === 'changes') {
        if (project.stateEdits?.[s.id]) {
          return [16, 185, 129] // Verde esmeralda brillante
        }
        return [50, 50, 60]
      }

      // Modo Político por defecto
      const owner = getEffectiveOwner(s)
      if (!owner) return [100, 100, 110]

      const country = project.countries.find((c) => c.tag === owner)
      if (country) {
        return mapColor(country.color)
      }
      return mapColor(getStableColorForTag(owner))
    },
    [viewMode, activeCountryTag, getEffectiveCores, project.stateEdits, project.countries, getEffectiveOwner]
  )

  // Centrar vista en un estado
  const centerOnState = useCallback(
    (stateId: number) => {
      const state = mapData.states[stateId]
      if (!state || !canvasRef.current) return

      const pixelIndices = mapData.statePixelIndices[stateId]
      if (!pixelIndices || pixelIndices.length === 0) return

      let sumX = 0
      let sumY = 0
      for (let i = 0; i < pixelIndices.length; i++) {
        const idx = pixelIndices[i]
        sumX += idx % mapData.width
        sumY += Math.floor(idx / mapData.width)
      }
      const centerX = sumX / pixelIndices.length
      const centerY = sumY / pixelIndices.length

      const canvas = canvasRef.current
      const containerWidth = canvas.clientWidth
      const containerHeight = canvas.clientHeight

      const newPanX = containerWidth / 2 - centerX * zoom
      const newPanY = containerHeight / 2 - centerY * zoom

      setPan({ x: newPanX, y: newPanY })
    },
    [mapData, zoom]
  )

  // Ajustar mapa a la pantalla
  const fitMap = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight

    const scaleX = containerWidth / mapData.width
    const scaleY = containerHeight / mapData.height
    const newZoom = Math.min(scaleX, scaleY) * 0.95

    const newPanX = (containerWidth - mapData.width * newZoom) / 2
    const newPanY = (containerHeight - mapData.height * newZoom) / 2

    setZoomState(newZoom)
    onZoomChange(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [mapData.width, mapData.height, onZoomChange])

  useImperativeHandle(ref, () => ({
    centerOnState,
    fitMap,
    zoomIn: () => {
      setZoomState((z) => {
        const nz = Math.min(10, z * 1.25)
        onZoomChange(nz)
        return nz
      })
    },
    zoomOut: () => {
      setZoomState((z) => {
        const nz = Math.max(0.1, z / 1.25)
        onZoomChange(nz)
        return nz
      })
    }
  }))

  useEffect(() => {
    fitMap()
  }, [fitMap])

  // Canvas 2D Render Pipeline para mapa (garantiza compatibilidad 100% fluida en sandbox)
  const mapImageBufferRef = useRef<ImageData | null>(null)
  const mapCanvas2DRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // Inicializar canvas offscreen para la imagen base del mapa
    const offscreen = document.createElement('canvas')
    offscreen.width = mapData.width
    offscreen.height = mapData.height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    const imgData = ctx.createImageData(mapData.width, mapData.height)
    const data = imgData.data

    // Dibujar cada píxel
    for (let i = 0; i < mapData.provinceIndex.length; i++) {
      const provId = mapData.provinceIndex[i]
      const stateId = mapData.provinceToState[provId]
      const state = mapData.states[stateId]

      let r = 18
      let g = 32
      let b = 58

      if (state) {
        const rgb = getStateColor(state)
        r = rgb[0]
        g = rgb[1]
        b = rgb[2]
      } else {
        const prov = mapData.provinces[provId]
        if (prov && (prov.type === 'sea' || prov.type === 'lake')) {
          r = 18
          g = 32
          b = 58
        }
      }

      const offset = i * 4
      data[offset] = r
      data[offset + 1] = g
      data[offset + 2] = b
      data[offset + 3] = 255
    }

    // Dibujar fronteras
    for (let y = 0; y < mapData.height - 1; y++) {
      for (let x = 0; x < mapData.width - 1; x++) {
        const idx = x + y * mapData.width
        const p1 = mapData.provinceIndex[idx]
        const p2 = mapData.provinceIndex[idx + 1]
        const p3 = mapData.provinceIndex[idx + mapData.width]

        const s1 = mapData.provinceToState[p1]
        const s2 = mapData.provinceToState[p2]
        const s3 = mapData.provinceToState[p3]

        if (s1 !== s2 || s1 !== s3) {
          const off = idx * 4
          if (s1 > 0 && (s2 > 0 || s3 > 0)) {
            // Frontera de estado
            data[off] = Math.max(0, data[off] - 40)
            data[off + 1] = Math.max(0, data[off + 1] - 40)
            data[off + 2] = Math.max(0, data[off + 2] - 40)
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
    mapImageBufferRef.current = imgData
    mapCanvas2DRef.current = offscreen
  }, [mapData, getStateColor])

  // Bucle de renderizado principal
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !containerRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight
    canvas.width = containerWidth
    canvas.height = containerHeight

    ctx.clearRect(0, 0, containerWidth, containerHeight)
    ctx.imageSmoothingEnabled = false

    // Renderizar imagen del mapa ajustada con zoom y pan
    if (mapCanvas2DRef.current) {
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      ctx.drawImage(mapCanvas2DRef.current, 0, 0)

      // Marcar capitales con una estrella en el mapa
      project.countries.forEach((c) => {
        if (c.capital && mapData.states[c.capital]) {
          const pixelIndices = mapData.statePixelIndices[c.capital]
          if (pixelIndices && pixelIndices.length > 0) {
            const idx = pixelIndices[Math.floor(pixelIndices.length / 2)]
            const cx = idx % mapData.width
            const cy = Math.floor(idx / mapData.width)

            ctx.fillStyle = '#f59e0b'
            ctx.font = `${Math.max(12, 16 / zoom)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('★', cx, cy)
          }
        }
      })

      // Resaltar estado seleccionado con contorno
      if (selectedStateId && mapData.statePixelIndices[selectedStateId]) {
        const pixelIndices = mapData.statePixelIndices[selectedStateId]
        ctx.fillStyle = 'rgba(245, 158, 11, 0.35)'
        for (let i = 0; i < pixelIndices.length; i += 2) {
          const idx = pixelIndices[i]
          const x = idx % mapData.width
          const y = Math.floor(idx / mapData.width)
          ctx.fillRect(x, y, 1, 1)
        }
      }

      ctx.restore()
    }

    // Renderizar Minimapa en la esquina inferior derecha
    const minimap = minimapCanvasRef.current
    if (minimap && mapCanvas2DRef.current) {
      minimap.width = 180
      minimap.height = 90
      const mctx = minimap.getContext('2d')
      if (mctx) {
        mctx.imageSmoothingEnabled = true
        mctx.drawImage(mapCanvas2DRef.current, 0, 0, 180, 90)

        // Rectángulo de vista actual
        const vx = (-pan.x / (mapData.width * zoom)) * 180
        const vy = (-pan.y / (mapData.height * zoom)) * 90
        const vw = (containerWidth / (mapData.width * zoom)) * 180
        const vh = (containerHeight / (mapData.height * zoom)) * 90

        mctx.strokeStyle = '#ef4444'
        mctx.lineWidth = 1.5
        mctx.strokeRect(vx, vy, vw, vh)
      }
    }
  }, [pan, zoom, mapData, selectedStateId, project.countries])

  // Manejo de eventos de mouse y teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY < 0 ? 1.15 : 0.85
    const newZoom = Math.min(10, Math.max(0.1, zoom * factor))

    const mapX = (mouseX - pan.x) / zoom
    const mapY = (mouseY - pan.y) / zoom

    const newPanX = mouseX - mapX * newZoom
    const newPanY = mouseY - mapY * newZoom

    setZoomState(newZoom)
    onZoomChange(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressedRef.current) {
      // Arrastrar vista
      isDraggingRef.current = true
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      return
    }

    if (e.button === 0) {
      isMouseDownRef.current = true
      currentStrokeStatesRef.current.clear()
      strokeGroupRef.current = `map_stroke:${Date.now()}`
      handleMapClickOrDrag(e.clientX, e.clientY, e.shiftKey)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    if (isDraggingRef.current) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      })
      return
    }

    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const mapX = Math.floor((mouseX - pan.x) / zoom)
    const mapY = Math.floor((mouseY - pan.y) / zoom)

    if (mapX >= 0 && mapX < mapData.width && mapY >= 0 && mapY < mapData.height) {
      const idx = mapX + mapY * mapData.width
      const provId = mapData.provinceIndex[idx]
      const stateId = mapData.provinceToState[provId]

      onHoverProvState(provId, stateId)

      const state = mapData.states[stateId]
      if (state) {
        const owner = getEffectiveOwner(state)
        const cores = getEffectiveCores(state)
        const vp = state.victoryPoints.find(([p]) => p === provId)?.[1] ?? 0

        setTooltip({
          visible: true,
          x: e.clientX + 15,
          y: e.clientY + 15,
          stateName: state.name,
          stateId: state.id,
          owner: owner || 'Sin dueño',
          cores,
          provId,
          victoryPoints: vp
        })
      } else {
        setTooltip(null)
      }

      if (isMouseDownRef.current && (tool === 'brush' || tool === 'eraser')) {
        handleMapClickOrDrag(e.clientX, e.clientY, e.shiftKey)
      }
    } else {
      onHoverProvState(null, null)
      setTooltip(null)
    }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
    isMouseDownRef.current = false
    strokeGroupRef.current = null
    store.endGroup()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const newZoom = Math.min(10, zoom * 1.5)
    const mapX = (mouseX - pan.x) / zoom
    const mapY = (mouseY - pan.y) / zoom

    const newPanX = mouseX - mapX * newZoom
    const newPanY = mouseY - mapY * newZoom

    setZoomState(newZoom)
    onZoomChange(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  // Interacción de herramientas sobre el mapa
  const handleMapClickOrDrag = (clientX: number, clientY: number, shiftKey: boolean) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top

    const mapX = Math.floor((mouseX - pan.x) / zoom)
    const mapY = Math.floor((mouseY - pan.y) / zoom)

    if (mapX < 0 || mapX >= mapData.width || mapY < 0 || mapY >= mapData.height) return

    const idx = mapX + mapY * mapData.width
    const provId = mapData.provinceIndex[idx]
    const stateId = mapData.provinceToState[provId]

    const state = mapData.states[stateId]
    if (!state) return

    if (pick?.kind === 'state') {
      store.finishPick(String(stateId))
      return
    }

    // Requerir país activo para herramientas que asignan dueño
    if (['brush', 'bucket', 'capital', 'core'].includes(tool) && !activeCountryTag) {
      onSetValidatorMessage('Primero elige o crea un país en la tarjeta flotante.')
      return
    }

    if (tool === 'select') {
      onSelectState(stateId)
      return
    }

    if (tool === 'capital' && activeCountryTag) {
      const currentOwner = getEffectiveOwner(state)
      if (currentOwner !== activeCountryTag) {
        onSetValidatorMessage(`No puedes fijar la capital en "${state.name}" porque no pertenece a ${activeCountryTag}.`)
        return
      }
      store.updateProject((p) => {
        const country = p.countries.find((c) => c.tag === activeCountryTag)
        if (!country) return p
        return {
          ...p,
          countries: p.countries.map((c) => (c.tag === activeCountryTag ? { ...c, capital: stateId } : c))
        }
      })
      onSetValidatorMessage(`Capital fijada en ${state.name} (#${stateId}).`)
      return
    }

    if (tool === 'core' && activeCountryTag) {
      store.updateProject((p) => {
        const edits = { ...(p.stateEdits || {}) }
        const currentEdit = edits[stateId] || {}
        let cores = getEffectiveCores(state)

        if (shiftKey) {
          // Quitar core
          cores = cores.filter((c) => c !== activeCountryTag)
        } else {
          // Agregar core
          if (!cores.includes(activeCountryTag)) cores.push(activeCountryTag)
        }

        edits[stateId] = {
          ...currentEdit,
          addCores: cores.filter((c) => !state.originalCores.includes(c)),
          removeCores: state.originalCores.filter((c) => !cores.includes(c))
        }

        return { ...p, stateEdits: edits }
      })
      return
    }

    if (tool === 'eraser') {
      store.updateProject((p) => {
        const edits = { ...(p.stateEdits || {}) }
        delete edits[stateId]
        return { ...p, stateEdits: edits }
      })
      return
    }

    if (tool === 'eyedropper') {
      const owner = getEffectiveOwner(state)
      if (owner) {
        const existsInMod = project.countries.some((c) => c.tag === owner)
        if (existsInMod) {
          onSelectActiveCountry(owner)
        } else {
          if (confirm(`El dueño de este estado es "${owner}" (país del juego). ¿Deseas agregarlo como país al mod?`)) {
            onCreateCountry()
          }
        }
      }
      return
    }

    if (tool === 'brush' && activeCountryTag) {
      if (currentStrokeStatesRef.current.has(stateId)) return
      currentStrokeStatesRef.current.add(stateId)

      store.updateProject(
        (p) => {
          const edits = { ...(p.stateEdits || {}) }
          const currentEdit = edits[stateId] || {}
          const prevOwner = getEffectiveOwner(state)

          let cores = getEffectiveCores(state)
          if (brushOpts.giveCoreOnPaint && !cores.includes(activeCountryTag)) {
            cores.push(activeCountryTag)
          }
          if (brushOpts.removePreviousCores && prevOwner && prevOwner !== activeCountryTag) {
            cores = cores.filter((c) => c !== prevOwner)
          }

          edits[stateId] = {
            ...currentEdit,
            owner: activeCountryTag,
            addCores: cores.filter((c) => !state.originalCores.includes(c)),
            removeCores: state.originalCores.filter((c) => !cores.includes(c))
          }

          return { ...p, stateEdits: edits }
        },
        { group: strokeGroupRef.current || undefined }
      )
      return
    }

    if (tool === 'bucket' && activeCountryTag) {
      const startOwner = getEffectiveOwner(state)

      // BFS para encontrar estados conectados por tierra con el mismo dueño
      const queue = [stateId]
      const visited = new Set<number>([stateId])

      while (queue.length > 0) {
        const curr = queue.shift()!
        const adj = mapData.stateAdjacency[curr] || []
        adj.forEach((neighborId) => {
          if (!visited.has(neighborId)) {
            const nState = mapData.states[neighborId]
            if (nState && getEffectiveOwner(nState) === startOwner) {
              visited.add(neighborId)
              queue.push(neighborId)
            }
          }
        })
      }

      if (visited.size > 30) {
        if (!confirm(`La cubeta pintará ${visited.size} estados conectados. ¿Deseas continuar?`)) {
          return
        }
      }

      store.updateProject((p) => {
        const edits = { ...(p.stateEdits || {}) }

        visited.forEach((sid) => {
          const st = mapData.states[sid]
          if (!st) return

          let cores = getEffectiveCores(st)
          if (brushOpts.giveCoreOnPaint && !cores.includes(activeCountryTag)) {
            cores.push(activeCountryTag)
          }

          edits[sid] = {
            ...(edits[sid] || {}),
            owner: activeCountryTag,
            addCores: cores.filter((c) => !st.originalCores.includes(c)),
            removeCores: st.originalCores.filter((c) => !cores.includes(c))
          }
        })

        return { ...p, stateEdits: edits }
      })
    }
  }

  const handleMinimapClick = (e: React.MouseEvent) => {
    const minimap = minimapCanvasRef.current
    if (!minimap || !containerRef.current) return

    const rect = minimap.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / rect.width
    const my = (e.clientY - rect.top) / rect.height

    const targetX = mx * mapData.width
    const targetY = my * mapData.height

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight

    setPan({
      x: containerWidth / 2 - targetX * zoom,
      y: containerHeight / 2 - targetY * zoom
    })
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      {/* Canvas del Mapa */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="block h-full w-full cursor-crosshair"
      />

      {/* Imagen de referencia opcional */}
      {refImg.dataUrl && refImg.visible && (
        <img
          src={refImg.dataUrl}
          alt="Referencia"
          className="absolute inset-0 pointer-events-none object-contain h-full w-full"
          style={{ opacity: refImg.opacity }}
        />
      )}

      {/* Minimapa Flotante */}
      <div className="absolute right-4 bottom-4 z-10 overflow-hidden rounded border border-hoi-border bg-hoi-panel/90 shadow-xl backdrop-blur-sm">
        <canvas
          ref={minimapCanvasRef}
          onClick={handleMinimapClick}
          className="block cursor-pointer"
        />
      </div>

      {/* Tooltip al pasar el cursor */}
      {tooltip && tooltip.visible && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-hoi-panel/95 p-2 text-xs text-hoi-text shadow-xl border border-hoi-border backdrop-blur-sm space-y-0.5"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-hoi-accent">{tooltip.stateName} <span className="font-mono text-hoi-muted">(#{tooltip.stateId})</span></div>
          <div><span className="text-hoi-muted">Dueño: </span><span className="font-semibold">{tooltip.owner}</span></div>
          <div><span className="text-hoi-muted">Cores: </span><span className="font-mono">{tooltip.cores.join(', ') || 'Ninguno'}</span></div>
          <div className="text-[10px] text-hoi-muted border-t border-hoi-border/50 pt-1 flex gap-2">
            <span>Provincia #{tooltip.provId}</span>
            {tooltip.victoryPoints > 0 && <span>VP: {tooltip.victoryPoints}</span>}
          </div>
        </div>
      )}
    </div>
  )
})

export default MapCanvas
