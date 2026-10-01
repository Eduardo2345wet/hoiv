// Minimapa en el mismo estilo que el mapa: mar azul, tierra blanca o del color del país, y
// fronteras finas (gris claro entre estados, gris oscuro entre países).
import type { MapData } from '../../../shared/map/types'
import { THEME_RGB } from '../../../shared/map/theme'
import type { Palette } from './colors'
import { strokeBorders } from './borderStroke'

export function minimapSize(map: MapData, cssW = 200): { w: number; h: number } {
  return { w: cssW, h: Math.max(40, Math.round((cssW * map.height) / map.width)) }
}

export function drawMinimap(
  canvas: HTMLCanvasElement,
  map: MapData,
  pal: Palette,
  cssW: number,
  cssH: number,
  dpr: number
): void {
  const W = Math.max(1, Math.round(cssW * dpr))
  const H = Math.max(1, Math.round(cssH * dpr))
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const slotOf = new Map(map.states.map((s, i) => [s.id, i]))
  const slotById = new Int32Array(map.states.reduce((m, s) => Math.max(m, s.id), 0) + 1).fill(-1)
  for (const [id, i] of slotOf) slotById[id] = i
  // 2×2 muestras por píxel: costas suaves aunque se reduzca mucho
  const sub = [0.25, 0.75]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (const sy of sub)
        for (const sx of sub) {
          const mx = Math.min(map.width - 1, Math.floor(((x + sx) / W) * map.width))
          const my = Math.min(map.height - 1, Math.floor(((y + sy) / H) * map.height))
          const st = map.provinceToState[map.provinceIndex[my * map.width + mx]]
          const slot = st ? slotById[st] : -1
          if (slot < 0) {
            r += THEME_RGB.sea[0]
            g += THEME_RGB.sea[1]
            b += THEME_RGB.sea[2]
          } else {
            r += pal.rgba[slot * 4]
            g += pal.rgba[slot * 4 + 1]
            b += pal.rgba[slot * 4 + 2]
          }
        }
      img.data.set([r / 4, g / 4, b / 4, 255], (y * W + x) * 4)
    }
  ctx.putImageData(img, 0, 0)
  // Fronteras: 1 píxel del mapa de la miniatura = map.width / cssW píxeles del mapa
  const k = (cssW / map.width) * dpr
  ctx.setTransform(k, 0, 0, k, 0, 0)
  const slotOfState = new Map(map.states.map((s, i) => [s.id, i + 1]))
  strokeBorders(ctx, map, pal, slotOfState, 'normal', 0, map.width / cssW / dpr, 0.6)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
