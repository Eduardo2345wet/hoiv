// Interfaz común de los renderizadores del mapa (WebGL2 o Canvas 2D de respaldo)
import type { MapData } from '../../../shared/map/types'
import type { Palette } from './colors'

export interface View {
  /** Píxeles de pantalla por píxel del mapa */
  scale: number
  /** Posición en pantalla (px) de la esquina superior izquierda del mapa */
  x: number
  y: number
}

export interface RenderOptions {
  /** Estado bajo el cursor (contorno resaltado) */
  hoverStateId: number
  /** Fronteras de provincia muy tenues */
  provinceBorders: boolean
}

export interface MapRenderer {
  readonly kind: 'webgl2' | 'canvas2d'
  setPalette(p: Palette): void
  render(view: View, width: number, height: number, opts: RenderOptions): void
  destroy(): void
}

export type RendererFactory = (canvas: HTMLCanvasElement, map: MapData) => MapRenderer | null
