// Vista del mapa: render (WebGL2 o Canvas 2D), zoom con la rueda centrado en el cursor,
// desplazamiento con botón central o espacio + arrastre, doble clic = zoom, clic O(1)
// (píxel → provincia → estado), tooltip, estrellas de capital, minimapa e imagen de referencia.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { MapData } from '../../../../shared/map/types'
import type { Project } from '../../types'
import type { GameCatalog } from '../../catalog/catalog'
import { buildPalette, type PaletteOptions } from '../../map/colors'
import type { MapRenderer, View } from '../../map/renderer'
import { createWebGLRenderer } from '../../map/webglRenderer'
import { createCanvasRenderer } from '../../map/canvasRenderer'
import { MAP_THEME, THEME_RGB } from '../../../../shared/map/theme'
import { effectiveCores, effectiveOwner, lookup } from '../../map/mapOps'
import {
  LABEL_MODES,
  canvasMeasure,
  capitalLabels,
  drawLabels,
  layoutLabels,
  type LabelMode,
  type PlacedLabel
} from '../../map/labelLayout'
import { isPainted } from '../../map/colors'
import { countryLabel } from '../../map/brush'
import { DEMO_TAGS } from '../../../../shared/map/demo'

export type { LabelMode }
export { LABEL_MODES }

export interface StrokeEvent {
  shift: boolean
  /** Clic derecho: borrar */
  erase: boolean
}

export interface MapPointer {
  x: number
  y: number
  province: number
  stateId: number
}

export interface MapViewHandle {
  fit(): void
  zoomBy(f: number): void
  centerOn(stateId: number): void
}

interface Props {
  map: MapData
  project: Project
  game: GameCatalog | null
  /** Modo de vista, país activo, selección, lienzo en blanco, pendientes… */
  paletteOptions: PaletteOptions
  /** Etiquetas de los estados */
  labels: LabelMode
  /** Etiquetas de capital (nombre del país con ★) */
  capitals: boolean
  /** Fronteras de provincia (muy tenues) */
  provinceBorders: boolean
  cursor: string
  reference: { src: string; opacity: number; visible: boolean } | null
  /**
   * Trazo con el botón izquierdo (pintar) o derecho (`erase`: borrar, como el segundo color
   * de Paint): inicio, movimiento y fin, con el estado bajo el cursor.
   */
  onStroke: (phase: 'start' | 'move' | 'end', stateId: number, e: StrokeEvent) => void
  onHover: (p: MapPointer | null) => void
  onViewChange?: (v: View) => void
  onRendererKind?: (k: string) => void
}

const MIN_SCALE = 0.1
const MAX_SCALE = 24

export default forwardRef<MapViewHandle, Props>(function MapView(props, ref) {
  const { map, project, game, paletteOptions } = props
  const activeTag = paletteOptions.activeTag
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState<(MapPointer & { sx: number; sy: number }) | null>(null)
  const drag = useRef<{
    kind: 'pan' | 'paint'
    erase?: boolean
    sx: number
    sy: number
    vx: number
    vy: number
    last: number
  } | null>(null)
  const space = useRef(false)
  const byId = useMemo(() => lookup(map), [map])

  const palette = useMemo(
    () => buildPalette(map, project, game, paletteOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, project, game, ...Object.values(paletteOptions)]
  )

  const paletteRef = useRef(palette)
  paletteRef.current = palette

  // ---- Ajustar al mapa ----
  const fitView = (w = size.w, h = size.h): View => {
    const scale = Math.max(MIN_SCALE, Math.min(w / map.width, h / map.height) * 0.95)
    return { scale, x: (w - map.width * scale) / 2, y: (h - map.height * scale) / 2 }
  }
  const zoomAt = (factor: number, sx: number, sy: number): void =>
    setView((v) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor))
      const k = scale / v.scale
      return { scale, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k }
    })

  useImperativeHandle(ref, () => ({
    fit: () => setView(fitView()),
    zoomBy: (f) => zoomAt(f, size.w / 2, size.h / 2),
    centerOn: (id) => {
      const c = map.stateCenters[id]
      if (!c) return
      setView((v) => {
        const scale = Math.max(v.scale, 2)
        return { scale, x: size.w / 2 - c[0] * scale, y: size.h / 2 - c[1] * scale }
      })
    }
  }))

  // ---- Crear el renderizador (WebGL2 o respaldo) ----
  // Siempre en un canvas NUEVO: un canvas cuyo contexto ya se usó (o se perdió) no sirve.
  useEffect(() => {
    const fresh = (): HTMLCanvasElement => {
      const old = canvasRef.current!
      const c = document.createElement('canvas')
      c.className = old.className
      old.replaceWith(c)
      ;(canvasRef as { current: HTMLCanvasElement }).current = c
      return c
    }
    let r = createWebGLRenderer(fresh(), map)
    if (!r) r = createCanvasRenderer(fresh(), map)
    rendererRef.current = r
    // Paleta actual al renderizador nuevo (el efecto de la paleta ya pudo haber corrido)
    r?.setPalette(paletteRef.current)
    props.onRendererKind?.(r?.kind ?? 'ninguno')
    setView(fitView())
    return () => {
      r?.destroy()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // ---- Tamaño ----
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(1, Math.floor(e.contentRect.width))
      const h = Math.max(1, Math.floor(e.contentRect.height))
      setSize({ w, h })
    })
    ro.observe(boxRef.current!)
    return () => ro.disconnect()
  }, [])

  // ---- Paleta → renderizador; dibujar en el siguiente cuadro ----
  useEffect(() => {
    rendererRef.current?.setPalette(palette)
  }, [palette, map])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = canvasRef.current
      if (!c || !rendererRef.current) return
      // Canvas con la resolución real de la pantalla (devicePixelRatio): los trazos siguen
      // midiendo 1 px CSS aunque cada píxel CSS sean 2 o 3 del dispositivo
      const dpr = window.devicePixelRatio || 1
      const dw = Math.max(1, Math.round(size.w * dpr))
      const dh = Math.max(1, Math.round(size.h * dpr))
      if (c.width !== dw || c.height !== dh) {
        c.width = dw
        c.height = dh
      }
      rendererRef.current.render(view, dw, dh, {
        hoverStateId: hover?.stateId ?? 0,
        provinceBorders: props.provinceBorders,
        activeContour: !!activeTag,
        dpr
      })
      redrawOverlay()
    })
    props.onViewChange?.(view)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, size, palette, hover?.stateId, props.provinceBorders, props.labels, activeTag])

  // ---- Etiquetas ----
  // La colocación (qué texto, dónde, de qué tamaño) se calcula al terminar el zoom o el
  // desplazamiento, o cuando cambia una capital, el modo o los colores; mientras se mueve la
  // vista las etiquetas viajan con el mapa (coordenadas del mapa) sin recalcular.
  const measure = useMemo(() => canvasMeasure(), [])
  const labelsRef = useRef<PlacedLabel[]>([])
  const capitalEntries = useMemo(() => {
    const entries: { tag: string; name: string; stateId: number | null | undefined }[] = []
    for (const c of project.countries)
      entries.push({ tag: c.tag, name: c.names.name || c.tag, stateId: c.capital })
    for (const [tag, st] of Object.entries(game?.countryCapitals ?? {}))
      if (!project.countries.some((c) => c.tag === tag))
        entries.push({ tag, name: countryLabel(tag, project, game), stateId: st })
    if (map.source === 'demo')
      // Mapa de demostración: la capital de cada país ficticio es su estado más grande
      for (const tag of DEMO_TAGS) {
        let best: number | null = null
        let bestArea = -1
        map.states.forEach((s, i) => {
          const a = map.statePixelOffsets[i + 1] - map.statePixelOffsets[i]
          if (s.owner === tag && a > bestArea) [best, bestArea] = [s.id, a]
        })
        entries.push({ tag, name: countryLabel(tag, project, game), stateId: best })
      }
    return entries
  }, [project, game, map])

  const relayout = (v: View = viewRef.current): void => {
    const pal = paletteRef.current
    const capitals = props.capitals
      ? capitalLabels(
          capitalEntries,
          (id) => {
            const st = byId.get(id)
            return st ? effectiveOwner(st, project) : undefined
          },
          (id) => !paletteOptions.blankUnpainted || isPainted(id, project)
        )
      : null
    labelsRef.current = layoutLabels({
      map,
      view: v,
      width: size.w,
      height: size.h,
      mode: props.labels,
      capitals,
      colorOf: (slot) => [pal.rgba[slot * 4], pal.rgba[slot * 4 + 1], pal.rgba[slot * 4 + 2]],
      measure
    })
    redrawOverlay()
  }
  // Cambios que obligan a recolocar YA
  useEffect(() => {
    relayout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, palette, props.labels, props.capitals, capitalEntries, size])
  // Zoom / desplazamiento: recolocar al terminar (pequeña espera)
  useEffect(() => {
    const t = setTimeout(() => relayout(view), 140)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const redrawOverlay = (): void => {
    const o = overlayRef.current
    if (!o) return
    const dpr = window.devicePixelRatio || 1
    o.width = Math.max(1, Math.round(size.w * dpr))
    o.height = Math.max(1, Math.round(size.h * dpr))
    const ctx = o.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    drawLabels(ctx, labelsRef.current, viewRef.current, size.w, size.h)
  }

  // ---- Minimapa (se recalcula al cambiar la paleta) ----
  const miniSize = useMemo(() => {
    const w = 200
    return { w, h: Math.max(40, Math.round((w * map.height) / map.width)) }
  }, [map])
  useEffect(() => {
    const c = miniRef.current
    if (!c) return
    c.width = miniSize.w
    c.height = miniSize.h
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(miniSize.w, miniSize.h)
    const slotOf = new Map(map.states.map((s, i) => [s.id, i]))
    for (let y = 0; y < miniSize.h; y++)
      for (let x = 0; x < miniSize.w; x++) {
        const mx = Math.floor(((x + 0.5) / miniSize.w) * map.width)
        const my = Math.floor(((y + 0.5) / miniSize.h) * map.height)
        const st = map.provinceToState[map.provinceIndex[my * map.width + mx]]
        const o = (y * miniSize.w + x) * 4
        if (!st) img.data.set([...THEME_RGB.sea, 255], o)
        else {
          const s = slotOf.get(st)! * 4
          img.data.set([palette.rgba[s], palette.rgba[s + 1], palette.rgba[s + 2], 255], o)
        }
      }
    ctx.putImageData(img, 0, 0)
  }, [palette, map, miniSize])

  // ---- Coordenadas ----
  const toMap = (clientX: number, clientY: number): MapPointer & { sx: number; sy: number } => {
    const r = boxRef.current!.getBoundingClientRect()
    const sx = clientX - r.left
    const sy = clientY - r.top
    const x = Math.floor((sx - view.x) / view.scale)
    const y = Math.floor((sy - view.y) / view.scale)
    const inside = x >= 0 && y >= 0 && x < map.width && y < map.height
    const province = inside ? map.provinceIndex[y * map.width + x] : 0
    return { sx, sy, x, y, province, stateId: province ? map.provinceToState[province] : 0 }
  }

  // Espacio + arrastre = desplazar
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea'))
        space.current = true
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') space.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent): void => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toMap(e.clientX, e.clientY)
    if (e.button === 1 || (e.button === 0 && space.current)) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, last: 0 }
      return
    }
    if (e.button !== 0 && e.button !== 2) return
    const erase = e.button === 2
    drag.current = { kind: 'paint', erase, sx: 0, sy: 0, vx: 0, vy: 0, last: p.stateId }
    props.onStroke('start', p.stateId, { shift: e.shiftKey, erase })
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const p = toMap(e.clientX, e.clientY)
    const d = drag.current
    if (d?.kind === 'pan') {
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
      return
    }
    setHover(p.province ? p : null)
    props.onHover(p.province ? p : null)
    if (d?.kind === 'paint' && p.stateId !== d.last) {
      d.last = p.stateId
      props.onStroke('move', p.stateId, { shift: e.shiftKey, erase: !!d.erase })
    }
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    if (drag.current?.kind === 'paint')
      props.onStroke('end', 0, { shift: e.shiftKey, erase: !!drag.current.erase })
    drag.current = null
  }

  // Tooltip
  const tipState = hover?.stateId ? byId.get(hover.stateId) : undefined
  const tipVp = tipState?.victoryPoints.find(([p]) => p === hover?.province)

  // Rectángulo de la vista en el minimapa
  const k = miniSize.w / map.width
  const rect = {
    left: (-view.x / view.scale) * k,
    top: (-view.y / view.scale) * k,
    width: (size.w / view.scale) * k,
    height: (size.h / view.scale) * k
  }

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: props.cursor, background: MAP_THEME.sea }}
      onWheel={(e) => {
        const r = boxRef.current!.getBoundingClientRect()
        zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        setHover(null)
        props.onHover(null)
      }}
      onDoubleClick={(e) => {
        const r = boxRef.current!.getBoundingClientRect()
        zoomAt(2, e.clientX - r.left, e.clientY - r.top)
      }}
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {props.reference?.visible && (
        // Imagen de referencia: solo visual, alineada al tamaño del mapa
        <img
          src={props.reference.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: map.width,
            height: map.height,
            opacity: props.reference.opacity / 100,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            imageRendering: 'pixelated'
          }}
        />
      )}
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {hover && tipState && !drag.current && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-hoi-border bg-black/85 px-2 py-1 text-xs shadow"
          style={{
            left: Math.min(hover.sx + 14, size.w - 220),
            top: Math.min(hover.sy + 14, size.h - 90)
          }}
        >
          <div className="font-semibold">
            {tipState.name} <span className="font-mono text-hoi-muted">#{tipState.id}</span>
          </div>
          <div>Dueño: {effectiveOwner(tipState, project)}</div>
          <div>Cores: {effectiveCores(tipState, project).join(', ') || '—'}</div>
          <div className="text-hoi-muted">
            Provincia {hover.province}
            {tipVp ? ` · ${tipVp[1]} VP` : ''}
          </div>
        </div>
      )}

      {/* Minimapa: clic = mover la vista */}
      <div
        className="absolute bottom-3 right-3 z-10 overflow-hidden rounded border border-hoi-border bg-black shadow-lg"
        style={{ width: miniSize.w, height: miniSize.h }}
        onPointerDown={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          const mx = ((e.clientX - r.left) / miniSize.w) * map.width
          const my = ((e.clientY - r.top) / miniSize.h) * map.height
          setView((v) => ({ ...v, x: size.w / 2 - mx * v.scale, y: size.h / 2 - my * v.scale }))
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        <canvas ref={miniRef} className="block" />
        <div className="pointer-events-none absolute border-2 border-amber-400" style={rect} />
      </div>
    </div>
  )
})
