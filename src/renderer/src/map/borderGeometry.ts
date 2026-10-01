// Fronteras → buffer de segmentos para la GPU. Se arma UNA vez por mapa (no por cuadro y no al
// pintar). Los segmentos van ordenados por "baldosa" para dibujar solo los de la vista.
import type { BorderSet } from '../../../shared/map/vector'
import { segmentCount } from '../../../shared/map/vector'

/** Bytes por segmento: x0 y0 x1 y1 (float32) + posición de estado A y B (uint16) */
export const SEG_STRIDE = 20

export interface Tile {
  /** Primer segmento y cantidad */
  start: number
  count: number
  /** Cuadro envolvente de sus segmentos (píxeles del mapa) */
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface SegmentBuffer {
  data: ArrayBuffer
  count: number
  tiles: Tile[]
}

export const TILE_SIZE = 256

export function buildSegmentBuffer(
  borders: BorderSet,
  slotOfState: Map<number, number>,
  mapW: number,
  mapH: number,
  tileSize = TILE_SIZE
): SegmentBuffer {
  const n = segmentCount(borders)
  const cols = Math.max(1, Math.ceil(mapW / tileSize))
  const rows = Math.max(1, Math.ceil(mapH / tileSize))
  const nTiles = cols * rows
  const pts = borders.points
  const tileOf = new Uint32Array(n)
  const counts = new Uint32Array(nTiles + 1)
  let s = 0
  for (let li = 0; li < borders.a.length; li++)
    for (let p = borders.starts[li]; p < borders.starts[li + 1] - 1; p++) {
      const mx = (pts[p * 2] + pts[p * 2 + 2]) / 2
      const my = (pts[p * 2 + 1] + pts[p * 2 + 3]) / 2
      const c = Math.min(cols - 1, Math.max(0, Math.floor(mx / tileSize)))
      const r = Math.min(rows - 1, Math.max(0, Math.floor(my / tileSize)))
      tileOf[s++] = r * cols + c
      counts[r * cols + c + 1]++
    }
  for (let t = 0; t < nTiles; t++) counts[t + 1] += counts[t]
  const cursor = counts.slice(0, nTiles)
  const data = new ArrayBuffer(n * SEG_STRIDE)
  const f32 = new Float32Array(data)
  const u16 = new Uint16Array(data)
  const tiles: Tile[] = Array.from({ length: nTiles }, (_, t) => ({
    start: counts[t],
    count: counts[t + 1] - counts[t],
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity
  }))
  s = 0
  for (let li = 0; li < borders.a.length; li++) {
    const sa = borders.a[li] ? (slotOfState.get(borders.a[li]) ?? 0) : 0
    const sb = slotOfState.get(borders.b[li]) ?? 0
    for (let p = borders.starts[li]; p < borders.starts[li + 1] - 1; p++) {
      const t = tileOf[s++]
      const j = cursor[t]++
      const x0 = pts[p * 2]
      const y0 = pts[p * 2 + 1]
      const x1 = pts[p * 2 + 2]
      const y1 = pts[p * 2 + 3]
      f32.set([x0, y0, x1, y1], j * 5)
      u16[j * 10 + 8] = sa
      u16[j * 10 + 9] = sb
      const tl = tiles[t]
      tl.x0 = Math.min(tl.x0, x0, x1)
      tl.y0 = Math.min(tl.y0, y0, y1)
      tl.x1 = Math.max(tl.x1, x0, x1)
      tl.y1 = Math.max(tl.y1, y0, y1)
    }
  }
  return { data, count: n, tiles: tiles.filter((t) => t.count > 0) }
}

/** Baldosas que tocan el rectángulo visible (píxeles del mapa), con un margen */
export function visibleTiles(
  tiles: Tile[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  margin: number
): Tile[] {
  return tiles.filter(
    (t) => t.x1 >= x0 - margin && t.x0 <= x1 + margin && t.y1 >= y0 - margin && t.y0 <= y1 + margin
  )
}
