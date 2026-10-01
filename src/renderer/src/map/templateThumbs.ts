// Miniaturas de las plantillas: se dibujan con el MISMO motor del mapa a partir de los datos
// reales (ninguna imagen externa) y se guardan en caché (memoria y localStorage).
import type { MapData } from '../../../shared/map/types'
import type { GameCatalog } from '../catalog/catalog'
import type { TemplateId } from '../types'
import { buildPalette, type PaletteOptions } from './colors'
import { renderToCanvas } from './exportImage'

const memo = new Map<string, string>()

export function thumbPaletteOptions(template: TemplateId): PaletteOptions {
  const base: PaletteOptions = {
    mode: 'politico',
    activeTag: null,
    selectedId: null,
    gameColors: false,
    blankUnpainted: true,
    highlightPending: false
  }
  if (template === 'blankNoNation') return { ...base, highlightPending: true }
  if (template === 'game' || template === 'mod')
    return { ...base, blankUnpainted: false, gameColors: true }
  return base
}

export function thumbKey(mapKey: string, template: TemplateId, w: number, h: number): string {
  return `hoi4ms.thumb.v1.${mapKey}.${template}.${w}x${h}`
}

/** Miniatura PNG (data URL) de una plantilla; sale de la caché si ya se dibujó */
export function templateThumb(
  map: MapData,
  mapKey: string,
  template: TemplateId,
  game: GameCatalog | null,
  w: number,
  h: number
): string {
  const key = thumbKey(mapKey, template, w, h)
  const cached = memo.get(key)
  if (cached) return cached
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      memo.set(key, stored)
      return stored
    }
  } catch {
    // sin localStorage: solo memoria
  }
  const palette = buildPalette(map, null, game, thumbPaletteOptions(template))
  const scale = Math.min(w / map.width, h / map.height)
  const r = renderToCanvas({
    map,
    palette,
    geometry: {
      width: w,
      height: h,
      dpr: 1,
      cssWidth: w,
      cssHeight: h,
      view: { scale, x: (w - map.width * scale) / 2, y: (h - map.height * scale) / 2 }
    },
    provinceBorders: false,
    labels: null
  })
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(r.canvas, 0, 0)
  r.dispose()
  const url = out.toDataURL('image/png')
  memo.set(key, url)
  try {
    localStorage.setItem(key, url)
  } catch {
    // caché llena: no pasa nada
  }
  return url
}
