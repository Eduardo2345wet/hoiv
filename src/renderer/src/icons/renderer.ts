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
