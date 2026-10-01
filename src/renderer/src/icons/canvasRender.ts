// Dibuja un emoji sobre un fondo (escudo para focos, marco para espíritus)
// en un canvas del tamaño final y devuelve un PNG en base64.
// Solo funciona en la interfaz (necesita el navegador de Electron).
import type { EmojiRecipe, IconTarget } from '../types'
import { ICON_COLORS, ICON_SIZES } from './sizes'

/** Fuente de emojis del sistema (Windows) con respaldo */
export const EMOJI_FONT = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif'

function shieldPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Placa/escudo: arriba recto con esquinas, abajo en punta suave
  const m = 6
  ctx.beginPath()
  ctx.moveTo(m + 6, m)
  ctx.lineTo(w - m - 6, m)
  ctx.quadraticCurveTo(w - m, m, w - m, m + 6)
  ctx.lineTo(w - m, h * 0.55)
  ctx.quadraticCurveTo(w - m, h * 0.78, w / 2, h - m)
  ctx.quadraticCurveTo(m, h * 0.78, m, h * 0.55)
  ctx.lineTo(m, m + 6)
  ctx.quadraticCurveTo(m, m, m + 6, m)
  ctx.closePath()
}

function framePath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const m = 3
  const r = 4
  ctx.beginPath()
  ctx.roundRect(m, m, w - 2 * m, h - 2 * m, r)
  ctx.closePath()
}

export function drawEmojiIcon(recipe: EmojiRecipe, target: IconTarget): HTMLCanvasElement {
  const { w, h } = ICON_SIZES[target]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const col = ICON_COLORS[recipe.color] ?? ICON_COLORS.acero
  const path = target === 'focus' ? shieldPath : framePath

  // Fondo con sombra suave
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2
  path(ctx, w, h)
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, col.light)
  grad.addColorStop(0.18, col.fill)
  grad.addColorStop(1, col.fill)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  // Borde claro
  path(ctx, w, h)
  ctx.lineWidth = 2
  ctx.strokeStyle = col.light
  ctx.stroke()

  // Emoji centrado
  const size = Math.round(Math.min(w, h) * (target === 'focus' ? 0.52 : 0.6))
  ctx.font = `${size}px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 3
  ctx.fillText(recipe.emoji, w / 2, target === 'focus' ? h * 0.46 : h / 2 + 1)
  return c
}

export function renderEmojiToPng(recipe: EmojiRecipe, target: IconTarget): string {
  return drawEmojiIcon(recipe, target).toDataURL('image/png')
}

/**
 * ¿Se puede dibujar este emoji con las fuentes del sistema?
 * Lo comparamos con un carácter que seguro no existe (sale como cuadro vacío).
 */
const drawableCache = new Map<string, boolean>()
export function canDrawEmoji(emoji: string): boolean {
  if (drawableCache.has(emoji)) return drawableCache.get(emoji)!
  const px = (text: string): Uint8ClampedArray => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.font = `24px ${EMOJI_FONT}`
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 2, 16)
    return ctx.getImageData(0, 0, 32, 32).data
  }
  const a = px(emoji)
  const tofu = px('\u{10FFFD}')
  let same = true
  let painted = false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== tofu[i]) same = false
    if (i % 4 === 3 && a[i] > 0) painted = true
  }
  const ok = painted && !same
  drawableCache.set(emoji, ok)
  return ok
}
