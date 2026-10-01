// Respaldo sin WebGL2: una imagen del mapa en memoria que se repinta SOLO en los píxeles
// de los estados cuyo color cambió (con la lista de píxeles por estado).
import type { MapData } from '../../../shared/map/types'
import { MAP_THEME, THEME_RGB } from '../../../shared/map/theme'
import type { Palette } from './colors'
import type { MapRenderer, View } from './renderer'

export function createCanvasRenderer(canvas: HTMLCanvasElement, map: MapData): MapRenderer | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const off = document.createElement('canvas')
  off.width = map.width
  off.height = map.height
  const offCtx = off.getContext('2d')!
  const img = offCtx.createImageData(map.width, map.height)
  const px = img.data
  // Mar y lagos una sola vez
  for (let i = 0; i < map.provinceIndex.length; i++) {
    const prov = map.provinceIndex[i]
    if (map.provinceToState[prov]) continue
    px.set([...THEME_RGB.sea, 255], i * 4) // mar y lagos (tema)
  }
  // Píxeles de frontera de estado (se oscurecen)
  const border = new Uint8Array(map.provinceIndex.length)
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x
      const s = map.provinceToState[map.provinceIndex[i]]
      if (!s) continue
      const r = x + 1 < map.width ? map.provinceToState[map.provinceIndex[i + 1]] : s
      const d = y + 1 < map.height ? map.provinceToState[map.provinceIndex[i + map.width]] : s
      // Frontera solo entre estados de tierra (sin línea en la costa)
      if ((r && r !== s) || (d && d !== s)) border[i] = 1
    }
  let prev: Uint8Array | null = null

  return {
    kind: 'canvas2d',
    setPalette(p: Palette) {
      for (let slot = 0; slot < map.states.length; slot++) {
        const o = slot * 4
        if (
          prev &&
          prev[o] === p.rgba[o] &&
          prev[o + 1] === p.rgba[o + 1] &&
          prev[o + 2] === p.rgba[o + 2] &&
          prev[o + 3] === p.rgba[o + 3]
        )
          continue
        const flags = p.rgba[o + 3]
        let [r, g, b] = [p.rgba[o], p.rgba[o + 1], p.rgba[o + 2]]
        if (flags & 16) [r, g, b] = [r * 0.45 + 140, g * 0.45 + 115, b * 0.45 + 42]
        if (flags & 32) [r, g, b] = [r * 0.9, g * 0.9, b * 0.9]
        if (flags & 4)
          [r, g, b] = [r + (255 - r) * 0.35, g + (255 - g) * 0.35, b + (255 - b) * 0.35]
        for (let k = map.statePixelOffsets[slot]; k < map.statePixelOffsets[slot + 1]; k++) {
          const i = map.statePixelIndex[k]
          const bo = border[i]
          // Frontera de estado: gris claro
          px[i * 4] = bo ? THEME_RGB.stateBorder[0] : r
          px[i * 4 + 1] = bo ? THEME_RGB.stateBorder[1] : g
          px[i * 4 + 2] = bo ? THEME_RGB.stateBorder[2] : b
          px[i * 4 + 3] = 255
        }
      }
      prev = p.rgba.slice()
      offCtx.putImageData(img, 0, 0)
    },
    render(view: View, width: number, height: number) {
      // (el respaldo no dibuja el contorno al pasar el mouse ni las provincias)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = MAP_THEME.sea
      ctx.fillRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = view.scale < 1
      ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y)
      ctx.drawImage(off, 0, 0)
    },
    destroy() {}
  }
}
