// Punto de enganche para DIBUJAR íconos con emoji. La app registra el dibujante
// real con canvas (canvasRender.ts); en las pruebas se usa uno falso.
import type { EmojiRecipe, IconTarget } from '../types'

export type IconRenderer = (recipe: EmojiRecipe, target: IconTarget) => string

let renderer: IconRenderer = () => ''

export function setIconRenderer(r: IconRenderer): void {
  renderer = r
}
export function renderEmojiIcon(recipe: EmojiRecipe, target: IconTarget): string {
  return renderer(recipe, target)
}

// ---- Imágenes de relleno de países (bandera y retrato) ----
export interface PlaceholderRenderers {
  /** Bandera 82×52 con franjas del color del país + inicial del tag */
  flag: (tag: string, color: [number, number, number]) => string
  /** Retrato 156×210: silueta + iniciales */
  portrait: (name: string) => string
  /** Bandera lisa de un solo color (país técnico "Sin nación") */
  plain?: (color: [number, number, number]) => string
}

let placeholders: PlaceholderRenderers = { flag: () => '', portrait: () => '' }

export function setPlaceholderRenderers(r: PlaceholderRenderers): void {
  placeholders = r
}
export const renderFlagPlaceholder = (tag: string, color: [number, number, number]): string =>
  placeholders.flag(tag, color)
export const renderPlainFlag = (color: [number, number, number]): string =>
  placeholders.plain ? placeholders.plain(color) : placeholders.flag('', color)
export const renderPortraitPlaceholder = (name: string): string => placeholders.portrait(name)
