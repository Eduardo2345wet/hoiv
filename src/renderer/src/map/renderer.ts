// Interfaz común de los renderizadores del mapa (WebGL2 o Canvas 2D de respaldo)
import type { MapData } from '../../../shared/map/types'
import type { Palette } from './colors'

export interface View {
  /** Píxeles CSS de pantalla por píxel del mapa */
  scale: number
  /** Posición en pantalla (px CSS) de la esquina superior izquierda del mapa */
  x: number
  y: number
}

export interface RenderOptions {
  /** Estado bajo el cursor (contorno resaltado) */
  hoverStateId: number
  /** Fronteras de provincia muy tenues */
  provinceBorders: boolean
  /** Contorno ámbar del país activo */
  activeContour: boolean
  /** Píxeles del dispositivo por píxel CSS (la vista y los anchos van en píxeles CSS) */
  dpr: number
}

export interface RendererOptions {
  /** Conservar la imagen tras dibujar (exportar a PNG) */
  preserveDrawingBuffer?: boolean
  /** Modo ligero: texturas a la mitad de resolución */
  light?: boolean
}

/** Datos del último cuadro (overlay F3) */
export interface RenderStats {
  /** Segmentos de frontera enviados a dibujar (solo las baldosas visibles) y el total */
  segmentsDrawn: number
  segmentsTotal: number
}

export interface MapRenderer {
  readonly kind: 'webgl2' | 'canvas2d'
  readonly stats: RenderStats
  /** Bytes de las texturas grandes en la GPU (0 si están liberadas) */
  readonly textureBytes: number
  /** Libera las texturas grandes (el mapa no se ve) */
  release(): void
  /** Vuelve a subirlas desde el MapData en memoria */
  restore(): void
  setPalette(p: Palette): void
  /** `width` y `height` en píxeles del DISPOSITIVO (tamaño real del canvas) */
  render(view: View, width: number, height: number, opts: RenderOptions): void
  destroy(): void
}

export type RendererFactory = (
  canvas: HTMLCanvasElement,
  map: MapData,
  opts?: RendererOptions
) => MapRenderer | null
