// Dibuja con canvas la bandera y el retrato de relleno (solo en la interfaz).
import { EMOJI_FONT } from '../icons/canvasRender'
import { toHex, type RGB } from './color'

export const FLAG_SIZE = { w: 82, h: 52 }
export const PORTRAIT_SIZE = { w: 156, h: 210 }

const cache = new Map<string, string>()

export function drawFlagPlaceholder(tag: string, color: RGB): string {
  const key = `f|${tag}|${color.join(',')}`
  if (cache.has(key)) return cache.get(key)!
  const { w, h } = FLAG_SIZE
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  // Tres franjas horizontales: color, blanco, color más oscuro
  const dark = color.map((n) => Math.round(n * 0.6)) as RGB
  ctx.fillStyle = toHex(color)
  ctx.fillRect(0, 0, w, h / 3)
  ctx.fillStyle = '#f2f2f2'
  ctx.fillRect(0, h / 3, w, h / 3)
  ctx.fillStyle = toHex(dark)
  ctx.fillRect(0, (2 * h) / 3, w, h / 3 + 1)
  // Inicial del tag en un círculo
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = toHex(color)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(h * 0.36)}px "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((tag[0] ?? '?').toUpperCase(), w / 2, h / 2 + 1)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}

export function drawPortraitPlaceholder(name: string): string {
  const key = `p|${name}`
  if (cache.has(key)) return cache.get(key)!
  const { w, h } = PORTRAIT_SIZE
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#4a4f58')
  g.addColorStop(1, '#23262c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Silueta: cabeza y hombros
  ctx.fillStyle = '#15171b'
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.36, w * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.92, w * 0.42, h * 0.3, 0, Math.PI, 0)
  ctx.fill()
  // Iniciales
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  ctx.fillStyle = '#e8e8e8'
  ctx.font = `bold 34px "Segoe UI", ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials || '?', w / 2, h * 0.8)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/** Bandera lisa de un color (país técnico "Sin nación") */
export function drawPlainFlag(color: RGB): string {
  const key = `l|${color.join(',')}`
  if (cache.has(key)) return cache.get(key)!
  const c = document.createElement('canvas')
  c.width = FLAG_SIZE.w
  c.height = FLAG_SIZE.h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = toHex(color)
  ctx.fillRect(0, 0, c.width, c.height)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}
