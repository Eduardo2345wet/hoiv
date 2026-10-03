// Exportar el mapa a una imagen PNG con el MISMO motor de la pantalla (WebGL2; Canvas 2D si no
// hay), en un canvas fuera de pantalla. Tamaños: 1× = 5632×2048, 2× = 11264×4096 o la vista
// actual. Con o sin etiquetas y con o sin fronteras de provincia.
//
// Si la imagen es más grande que lo que aguanta la tarjeta gráfica (muchas GPU solo dibujan hasta
// 8192 px por lado), se dibuja por pedazos (mosaico) y se une en un canvas normal. Si ni así cabe,
// se avisa con `ExportSizeError`, que trae el mayor tamaño posible para ofrecerlo.
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
/** Límite de seguridad: lado más largo de la imagen */
export const EXPORT_MAX_SIDE = 16384
/** Lado de cada pedazo del mosaico (cabe en cualquier GPU de 4096 o más) */
const TILE_SIDE = 4096
/** Hasta este lado toda GPU con WebGL2 dibuja de una vez: no hace falta preguntarle su límite */
const ALWAYS_FITS_SIDE = 2048

export type ExportSize = '1x' | '2x' | 'view'

export interface ExportOptions {
  size: ExportSize
  labels: boolean
  provinceBorders: boolean
  /** Reduce el tamaño a esta fracción (0–1], p. ej. el "mayor tamaño posible" que ofreció el aviso */
  factor?: number
}

/** Límites de esta computadora (las pruebas los bajan para probar los avisos y el mosaico) */
export interface ExportLimits {
  maxPixels: number
  maxSide: number
  /** Lado máximo que dibuja la GPU de una vez; sin dato se le pregunta a la GPU */
  gpuSide?: number
}

/** Un tamaño de imagen y cuánto se redujo respecto al pedido (1 = igual) */
export interface ExportFit {
  factor: number
  width: number
  height: number
}

/** La imagen pedida no cabe en esta computadora; `fit` es el mayor tamaño posible (o null) */
export class ExportSizeError extends Error {
  constructor(
    readonly requested: { width: number; height: number },
    readonly fit: ExportFit | null
  ) {
    super(
      fit
        ? `Esta computadora no puede crear una imagen de ${requested.width}×${requested.height}. ` +
            `El mayor tamaño posible es ${fit.width}×${fit.height}.`
        : 'La imagen es demasiado grande para esta computadora; elige un tamaño menor.'
    )
    this.name = 'ExportSizeError'
  }
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

/**
 * La misma composición con `factor` veces los píxeles. La vista va en píxeles CSS, así que no
 * cambia: solo crecen el tamaño de la imagen y los píxeles del dispositivo por píxel CSS.
 */
export function scaleGeometry(g: ExportGeometry, factor: number): ExportGeometry {
  if (factor === 1) return g
  return {
    ...g,
    width: Math.max(1, Math.round(g.width * factor)),
    height: Math.max(1, Math.round(g.height * factor)),
    dpr: g.dpr * factor
  }
}

/**
 * Mayor tamaño (misma composición, ≤ el pedido) que cumple los límites fijos y que `fits` acepta.
 * Prueba reduciendo un 15 % cada vez; null si ni así hay uno razonable.
 */
export function largestFit(
  g: Pick<ExportGeometry, 'width' | 'height'>,
  fits: (width: number, height: number) => boolean,
  limits: Pick<ExportLimits, 'maxPixels' | 'maxSide'> = {
    maxPixels: EXPORT_MAX_PIXELS,
    maxSide: EXPORT_MAX_SIDE
  }
): ExportFit | null {
  let factor = Math.min(
    1,
    limits.maxSide / Math.max(g.width, g.height),
    Math.sqrt(limits.maxPixels / (g.width * g.height))
  )
  for (let i = 0; i < 12; i++) {
    // Abajo a 3 decimales: así el tamaño redondeado nunca pasa del límite
    const f = Math.floor(factor * 1000) / 1000
    const width = Math.max(1, Math.round(g.width * f))
    const height = Math.max(1, Math.round(g.height * f))
    if (f > 0 && fits(width, height)) return { factor: f, width, height }
    factor *= 0.85
  }
  return null
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
  /** Límites de esta computadora; sin dato, los de verdad (pruebas: más bajos) */
  limits?: Partial<ExportLimits>
}

export interface RenderedCanvas {
  canvas: HTMLCanvasElement
  engine: string
  /** Pedazos en que se dibujó (1 = de una sola vez) */
  tiles: number
  /** Libera la memoria de la GPU; llamar cuando ya se leyó o guardó la imagen */
  dispose(): void
}

let gpuSide: number | null | undefined

/**
 * Lado máximo (en píxeles) que la tarjeta gráfica dibuja de una vez: el menor entre textura,
 * búfer de dibujo y área de dibujo. Null si no hay WebGL2. Se consulta una sola vez.
 */
export function gpuMaxSide(): number | null {
  if (gpuSide !== undefined) return gpuSide
  gpuSide = null
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (gl) {
      const view = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as ArrayLike<number>
      gpuSide = Math.min(
        gl.getParameter(gl.MAX_TEXTURE_SIZE),
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
        view[0],
        view[1]
      )
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    // sin WebGL2: se usa Canvas 2D
  }
  return gpuSide
}

/**
 * ¿El canvas existe de verdad? Cuando piden más de lo que se puede, los navegadores no avisan:
 * dan un canvas vacío. Se pinta el último píxel y se lee de vuelta.
 */
function canvasUsable(c: HTMLCanvasElement): boolean {
  try {
    const ctx = c.getContext('2d')
    if (!ctx) return false
    const x = c.width - 1
    const y = c.height - 1
    ctx.fillStyle = '#010203'
    ctx.fillRect(x, y, 1, 1)
    const ok = ctx.getImageData(x, y, 1, 1).data[3] === 255
    ctx.clearRect(x, y, 1, 1)
    return ok
  } catch {
    return false
  }
}

/** ¿Se puede crear un canvas de este tamaño ahora mismo? (prueba real; se suelta enseguida) */
function canvasFits(width: number, height: number): boolean {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ok = canvasUsable(c)
  c.width = c.height = 1
  return ok
}

/** El aviso de "no cabe", con el mayor tamaño que sí cabe en esta computadora */
function sizeError(g: ExportGeometry, limits: ExportLimits): ExportSizeError {
  const fit = largestFit(g, canvasFits, limits)
  // Si el tamaño pedido sí cabe, el problema no fue el tamaño: no se ofrece nada
  return new ExportSizeError(
    { width: g.width, height: g.height },
    fit && fit.factor < 1 ? fit : null
  )
}

const drawOptions = (job: RenderJob): Parameters<MapRenderer['render']>[3] => ({
  hoverStateId: 0,
  provinceBorders: job.provinceBorders,
  activeContour: !!job.activeContour,
  dpr: job.geometry.dpr
})

/** Dibuja el mapa en un canvas nuevo (con el motor WebGL2, o Canvas 2D de respaldo) */
export function renderToCanvas(job: RenderJob): RenderedCanvas {
  const g = job.geometry
  const limits: ExportLimits = {
    maxPixels: EXPORT_MAX_PIXELS,
    maxSide: EXPORT_MAX_SIDE,
    ...job.limits
  }
  if (g.width * g.height > limits.maxPixels || Math.max(g.width, g.height) > limits.maxSide)
    throw sizeError(g, limits)
  // Las imágenes chicas (miniaturas, vista de pantalla) no le preguntan nada a la GPU
  const side =
    limits.gpuSide ?? (Math.max(g.width, g.height) > ALWAYS_FITS_SIDE ? gpuMaxSide() : null)
  const tiled = side !== null && (g.width > side || g.height > side)
  const rendered = tiled ? renderTiled(job, limits, side) : renderWhole(job, limits)
  if (job.labels) {
    // Con etiquetas el resultado siempre es un canvas 2D (donde se escribe el texto)
    const ctx = rendered.canvas.getContext('2d')!
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0)
    drawLabels(ctx, job.labels, g.view, g.cssWidth, g.cssHeight)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  return rendered
}

/** De una sola vez: la imagen cabe en la GPU (o no hay GPU y todo va en Canvas 2D) */
function renderWhole(job: RenderJob, limits: ExportLimits): RenderedCanvas {
  const g = job.geometry
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
    if (!r) throw sizeError(g, limits) // lo más probable: el canvas es demasiado grande
  }
  const renderer = r
  renderer.setPalette(job.palette)
  renderer.render(g.view, g.width, g.height, drawOptions(job))
  const engine = renderer.kind
  if (!job.labels) {
    // La imagen vive en el canvas WebGL: no se destruye el contexto hasta terminar de usarla
    return { canvas: target, engine, tiles: 1, dispose: () => renderer.destroy() }
  }
  // Con etiquetas la imagen se pasa a un canvas 2D, donde se escribe el texto
  const out = document.createElement('canvas')
  out.width = g.width
  out.height = g.height
  if (!canvasUsable(out)) {
    renderer.destroy()
    throw sizeError(g, limits)
  }
  out.getContext('2d')!.drawImage(target, 0, 0)
  renderer.destroy()
  return { canvas: out, engine, tiles: 1, dispose: () => {} }
}

/**
 * Por pedazos: la GPU dibuja un cuadro de `side` px a la vez, con la vista corrida para que cada
 * cuadro caiga en su lugar, y cada uno se copia al canvas 2D final. El resultado es el mismo que
 * dibujar todo de una vez (la vista y el tamaño del trazo no cambian, solo se recorta distinto).
 */
function renderTiled(job: RenderJob, limits: ExportLimits, side: number): RenderedCanvas {
  const g = job.geometry
  const out = document.createElement('canvas')
  out.width = g.width
  out.height = g.height
  if (!canvasUsable(out)) throw sizeError(g, limits)
  const ctx = out.getContext('2d')!
  const tile = Math.max(1, Math.min(side, TILE_SIDE))
  const tw = Math.min(tile, g.width)
  const th = Math.min(tile, g.height)
  const gl = document.createElement('canvas')
  gl.width = tw
  gl.height = th
  let src = gl
  let r: MapRenderer | null = createWebGLRenderer(gl, job.map, { preserveDrawingBuffer: true })
  if (!r) {
    src = document.createElement('canvas')
    src.width = tw
    src.height = th
    r = createCanvasRenderer(src, job.map)
  }
  if (!r) {
    out.width = out.height = 1
    throw new Error('No se pudo crear el dibujo de la imagen.')
  }
  r.setPalette(job.palette)
  const opts = drawOptions(job)
  let tiles = 0
  for (let oy = 0; oy < g.height; oy += th) {
    for (let ox = 0; ox < g.width; ox += tw) {
      const w = Math.min(tw, g.width - ox)
      const h = Math.min(th, g.height - oy)
      // El cuadro empieza en (ox, oy) píxeles de la imagen: la vista se corre ese tanto (en CSS)
      const view = { scale: g.view.scale, x: g.view.x - ox / g.dpr, y: g.view.y - oy / g.dpr }
      r.render(view, tw, th, opts)
      ctx.drawImage(src, 0, 0, w, h, ox, oy, w, h)
      tiles++
    }
  }
  const engine = r.kind
  r.destroy()
  gl.width = gl.height = src.width = src.height = 1 // suelta la memoria de la GPU
  return { canvas: out, engine, tiles, dispose: () => {} }
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
  /** Límites de esta computadora; sin dato, los de verdad (pruebas: más bajos) */
  limits?: Partial<ExportLimits>
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  engine: string
  /** Pedazos en que se dibujó (1 = de una sola vez) */
  tiles: number
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
  const requested = exportGeometry(opts.size, ctx.map, ctx.current)
  const factor = opts.factor ?? 1
  const geometry = scaleGeometry(requested, factor)
  const labels = opts.labels
    ? layoutLabels({
        ...ctx.labelInput,
        view: geometry.view,
        width: geometry.cssWidth,
        height: geometry.cssHeight
      })
    : null
  let rendered: RenderedCanvas
  try {
    rendered = renderToCanvas({
      map: ctx.map,
      palette: withoutSelection(ctx.palette),
      geometry,
      provinceBorders: opts.provinceBorders,
      labels,
      limits: ctx.limits
    })
  } catch (e) {
    // Si el aviso llega al reintentar con un tamaño reducido, que siga hablando del pedido original
    if (e instanceof ExportSizeError && factor !== 1) {
      const f = e.fit ? e.fit.factor * factor : 0
      throw new ExportSizeError(
        { width: requested.width, height: requested.height },
        e.fit && {
          factor: f,
          width: Math.max(1, Math.round(requested.width * f)),
          height: Math.max(1, Math.round(requested.height * f))
        }
      )
    }
    throw e
  }
  const { canvas, engine, tiles, dispose } = rendered
  const blob = await canvasToPng(canvas)
  dispose()
  canvas.width = canvas.height = 1 // suelta la memoria
  return { blob, width: geometry.width, height: geometry.height, engine, tiles }
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
