// Exportar el mapa a una imagen PNG con el MISMO motor de la pantalla (WebGL2; Canvas 2D si no
// hay), en un canvas fuera de pantalla. Tamaños: 1× = 5632×2048, 2× = 11264×4096 o la vista
// actual. Con o sin etiquetas y con o sin fronteras de provincia.
import type { MapData } from '../../../shared/map/types'
import { FLAG, type Palette } from './colors'
import { createWebGLRenderer } from './webglRenderer'
import { createCanvasRenderer } from './canvasRenderer'
import { drawLabels, layoutLabels, type LayoutInput, type PlacedLabel } from './labelLayout'
import type { MapRenderer, View } from './renderer'

/** Tamaño del mapa real de HOI4: la imagen 1× mide esto */
export const EXPORT_BASE = { w: 5632, h: 2048 } as const
/** Límite de seguridad: píxeles de la imagen (≈ 8192×8192) */
export const EXPORT_MAX_PIXELS = 8192 * 8192 * 1.5

export type ExportSize = '1x' | '2x' | 'view'

export interface ExportOptions {
  size: ExportSize
  labels: boolean
  provinceBorders: boolean
}

/** Cómo se ve la pantalla ahora (para el modo "vista actual") */
export interface CurrentView {
  /** Tamaño de la pantalla en píxeles CSS */
  width: number
  height: number
  view: View
  dpr: number
}

export interface ExportGeometry {
  /** Píxeles de la imagen */
  width: number
  height: number
  /** Píxeles del dispositivo por píxel CSS (los trazos y la letra se agrandan igual) */
  dpr: number
  /** Tamaño y vista en píxeles CSS */
  cssWidth: number
  cssHeight: number
  view: View
}

/**
 * 1× y 2×: el mapa ajustado y centrado en 5632×2048 (el mapa real queda 1:1; el de demostración
 * se amplía). 2× usa el doble de píxeles con la misma composición. "view": lo que se ve ahora.
 */
export function exportGeometry(
  size: ExportSize,
  map: Pick<MapData, 'width' | 'height'>,
  current: CurrentView
): ExportGeometry {
  if (size === 'view') {
    return {
      width: Math.max(1, Math.round(current.width * current.dpr)),
      height: Math.max(1, Math.round(current.height * current.dpr)),
      dpr: current.dpr,
      cssWidth: current.width,
      cssHeight: current.height,
      view: current.view
    }
  }
  const k = size === '2x' ? 2 : 1
  const scale = Math.min(EXPORT_BASE.w / map.width, EXPORT_BASE.h / map.height)
  return {
    width: EXPORT_BASE.w * k,
    height: EXPORT_BASE.h * k,
    dpr: k,
    cssWidth: EXPORT_BASE.w,
    cssHeight: EXPORT_BASE.h,
    view: {
      scale,
      x: (EXPORT_BASE.w - map.width * scale) / 2,
      y: (EXPORT_BASE.h - map.height * scale) / 2
    }
  }
}

export interface RenderJob {
  map: MapData
  palette: Palette
  geometry: ExportGeometry
  provinceBorders: boolean
  /** Etiquetas ya colocadas para esta vista (null = sin etiquetas) */
  labels: PlacedLabel[] | null
  /** Contorno del país activo / estado bajo el cursor: la imagen exportada no los lleva */
  activeContour?: boolean
}

export interface RenderedCanvas {
  canvas: HTMLCanvasElement
  engine: string
  /** Libera la memoria de la GPU; llamar cuando ya se leyó o guardó la imagen */
  dispose(): void
}

/** Dibuja el mapa en un canvas nuevo (con el motor WebGL2, o Canvas 2D de respaldo) */
export function renderToCanvas(job: RenderJob): RenderedCanvas {
  const { geometry: g } = job
  if (g.width * g.height > EXPORT_MAX_PIXELS)
    throw new Error('La imagen es demasiado grande para esta computadora; elige un tamaño menor.')
  const gl = document.createElement('canvas')
  gl.width = g.width
  gl.height = g.height
  let r: MapRenderer | null = createWebGLRenderer(gl, job.map, { preserveDrawingBuffer: true })
  let target = gl
  if (!r) {
    target = document.createElement('canvas')
    target.width = g.width
    target.height = g.height
    r = createCanvasRenderer(target, job.map)
  }
  if (!r) throw new Error('No se pudo crear el dibujo de la imagen.')
  const renderer = r
  renderer.setPalette(job.palette)
  renderer.render(g.view, g.width, g.height, {
    hoverStateId: 0,
    provinceBorders: job.provinceBorders,
    activeContour: !!job.activeContour,
    dpr: g.dpr
  })
  const engine = renderer.kind
  if (!job.labels) {
    // La imagen vive en el canvas WebGL: no se destruye el contexto hasta terminar de usarla
    return { canvas: target, engine, dispose: () => renderer.destroy() }
  }
  const out = document.createElement('canvas')
  out.width = g.width
  out.height = g.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(target, 0, 0)
  renderer.destroy()
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0)
  drawLabels(ctx, job.labels, g.view, g.cssWidth, g.cssHeight)
  return { canvas: out, engine, dispose: () => {} }
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('El navegador no pudo crear el PNG.'))),
      'image/png'
    )
  )
}

export interface ExportContext {
  map: MapData
  palette: Palette
  current: CurrentView
  /** Todo lo de la colocación de etiquetas, menos la vista y el tamaño */
  labelInput: Omit<LayoutInput, 'view' | 'width' | 'height'>
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  engine: string
}

/** La imagen no lleva la selección del editor (el tinte del estado seleccionado) */
export function withoutSelection(p: Palette): Palette {
  const rgba = p.rgba.slice()
  for (let i = 3; i < rgba.length; i += 4) rgba[i] &= ~FLAG.selected
  return { rgba, owners: p.owners }
}

/** Genera el PNG con las opciones elegidas */
export async function exportMapImage(
  opts: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  const geometry = exportGeometry(opts.size, ctx.map, ctx.current)
  const labels = opts.labels
    ? layoutLabels({
        ...ctx.labelInput,
        view: geometry.view,
        width: geometry.cssWidth,
        height: geometry.cssHeight
      })
    : null
  const { canvas, engine, dispose } = renderToCanvas({
    map: ctx.map,
    palette: withoutSelection(ctx.palette),
    geometry,
    provinceBorders: opts.provinceBorders,
    labels
  })
  const blob = await canvasToPng(canvas)
  dispose()
  canvas.width = canvas.height = 1 // suelta la memoria
  return { blob, width: geometry.width, height: geometry.height, engine }
}

/** Nombre sugerido: mapa-<mod>-<tamaño>.png */
export function exportFileName(modName: string, size: ExportSize): string {
  const base =
    modName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'mapa'
  return `mapa-${base}-${size === 'view' ? 'vista' : size}.png`
}
