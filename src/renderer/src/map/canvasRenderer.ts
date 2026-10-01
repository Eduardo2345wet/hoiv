// Respaldo sin WebGL2: una imagen del mapa en memoria que se repinta SOLO en los píxeles de los
// estados cuyo color cambió, más las mismas fronteras vectoriales dibujadas con trazos de ancho
// constante en pantalla. (No dibuja rayas, fronteras de provincia ni el aclarado del cursor.)
import type { MapData } from '../../../shared/map/types'
import { MAP_THEME, THEME_RGB } from '../../../shared/map/theme'
import type { Palette } from './colors'
import { FLAG } from './colors'
import { strokeBorders } from './borderStroke'
import type { MapRenderer, RenderOptions, RendererOptions, View } from './renderer'

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  map: MapData,
  _options: RendererOptions = {}
): MapRenderer | null {
  void _options
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
    px.set([...THEME_RGB.sea, 255], i * 4)
  }
  const slotOfState = new Map(map.states.map((s, i) => [s.id, i + 1]))
  let prev: Uint8Array | null = null
  let pal: Palette | null = null

  const total = map.borders.points.length / 2 - map.borders.a.length
  return {
    kind: 'canvas2d',
    stats: { segmentsDrawn: total, segmentsTotal: total },
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
        if (flags & FLAG.highlight) [r, g, b] = [r * 0.45 + 140, g * 0.45 + 115, b * 0.45 + 42]
        if (flags & FLAG.striped) [r, g, b] = [r * 0.9, g * 0.9, b * 0.9]
        if (flags & FLAG.selected)
          [r, g, b] = [r + (255 - r) * 0.35, g + (255 - g) * 0.35, b + (255 - b) * 0.35]
        for (let k = map.statePixelOffsets[slot]; k < map.statePixelOffsets[slot + 1]; k++) {
          const i = map.statePixelIndex[k]
          px[i * 4] = r
          px[i * 4 + 1] = g
          px[i * 4 + 2] = b
          px[i * 4 + 3] = 255
        }
      }
      prev = p.rgba.slice()
      pal = p
      offCtx.putImageData(img, 0, 0)
    },
    render(view: View, width: number, height: number, opts: RenderOptions) {
      const dpr = opts.dpr || 1
      const k = view.scale * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = MAP_THEME.sea
      ctx.fillRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = k < 1
      ctx.setTransform(k, 0, 0, k, view.x * dpr, view.y * dpr)
      ctx.drawImage(off, 0, 0)
      if (!pal) return
      // 1 px CSS = 1 / view.scale píxeles del mapa (el trazo no depende del zoom ni del DPR)
      const unit = 1 / view.scale
      strokeBorders(ctx, map, pal, slotOfState, 'normal', 0, unit)
      if (opts.activeContour) strokeBorders(ctx, map, pal, slotOfState, 'active', 0, unit)
      const hover = opts.hoverStateId ? (slotOfState.get(opts.hoverStateId) ?? 0) : 0
      if (hover) strokeBorders(ctx, map, pal, slotOfState, 'hover', hover, unit)
    },
    destroy() {}
  }
}
