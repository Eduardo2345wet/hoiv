// Dibuja las fronteras vectoriales con trazos de Canvas 2D (respaldo sin WebGL y minimapa).
// El color y el ancho salen de segmentStyle: la misma regla que el shader.
import type { MapData } from '../../../shared/map/types'
import { rgbToHex } from '../../../shared/map/theme'
import type { Palette } from './colors'
import { segmentStyle, type BorderPass, type SegmentInfo } from './borderStyle'

/** Datos de una polilínea (estados que separa, dueños y banderas actuales) */
export function lineInfo(
  map: MapData,
  pal: Palette,
  slotOfState: Map<number, number>,
  li: number
): SegmentInfo {
  const sa = map.borders.a[li] ? (slotOfState.get(map.borders.a[li]) ?? 0) : 0
  const sb = slotOfState.get(map.borders.b[li]) ?? 0
  const owner = (slot: number): number => (slot ? pal.owners[slot - 1] : 0)
  const flags = (slot: number): number => (slot ? pal.rgba[(slot - 1) * 4 + 3] : 0)
  return {
    slotA: sa,
    slotB: sb,
    ownerA: owner(sa),
    ownerB: owner(sb),
    flagsA: flags(sa),
    flagsB: flags(sb)
  }
}

/**
 * @param unitsPerCssPx píxeles del mapa que mide 1 píxel CSS con la transformación actual
 *   (así el trazo mide siempre lo mismo en pantalla, a cualquier zoom y devicePixelRatio)
 * @param widthMul factor para líneas más finas (minimapa)
 */
export function strokeBorders(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  pal: Palette,
  slotOfState: Map<number, number>,
  pass: BorderPass,
  hoverSlot: number,
  unitsPerCssPx: number,
  widthMul = 1
): void {
  const { points, starts } = map.borders
  const groups = new Map<string, { path: Path2D; color: string; w: number }>()
  for (let li = 0; li < map.borders.a.length; li++) {
    const st = segmentStyle(pass, lineInfo(map, pal, slotOfState, li), hoverSlot)
    if (!st) continue
    const color = rgbToHex(st.color)
    const k = st.widthCss + color
    let g = groups.get(k)
    if (!g) groups.set(k, (g = { path: new Path2D(), color, w: st.widthCss }))
    for (let p = starts[li]; p < starts[li + 1]; p++) {
      if (p === starts[li]) g.path.moveTo(points[p * 2], points[p * 2 + 1])
      else g.path.lineTo(points[p * 2], points[p * 2 + 1])
    }
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const g of groups.values()) {
    ctx.strokeStyle = g.color
    ctx.lineWidth = g.w * widthMul * unitsPerCssPx
    ctx.stroke(g.path)
  }
}
