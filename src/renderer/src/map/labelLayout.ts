// Colocación de las etiquetas del mapa (ID, nombre, capitales). Es lógica pura, sin canvas:
//  - cada texto se prueba en tamaños de mayor a menor; debe caber en el rectángulo del estado
//    precalculado (labelBoxes) y no chocar con una etiqueta ya colocada (índice espacial);
//  - prioridad: capitales > estados más grandes > el resto; la que pierde se oculta.
// Se vuelve a calcular SOLO cuando termina el zoom o el desplazamiento (o cambia una capital, el
// modo o los colores); mientras tanto las etiquetas se mueven con el mapa (posición en
// coordenadas del mapa) sin recalcular.
import type { MapData } from '../../../shared/map/types'
import { BOX_FIELDS, LABEL_ASPECTS, fitLabelBox } from '../../../shared/map/labelBoxes'
import { MAP_THEME, contrastRatio, textIsWhite, type RGB3 } from '../../../shared/map/theme'
import type { View } from './renderer'

export type LabelMode = 'ninguna' | 'id' | 'nombre' | 'ambos'
export const LABEL_MODES: [LabelMode, string][] = [
  ['ninguna', 'Ninguna'],
  ['id', 'ID'],
  ['nombre', 'Nombre'],
  ['ambos', 'ID + nombre']
]

export interface CapitalInfo {
  tag: string
  name: string
  /** Estado donde está la capital */
  stateId: number
}

export interface PlacedLabel {
  kind: 'state' | 'capital'
  stateId: number
  /** Texto que se ve (vacío = solo la estrella) */
  text: string
  star: boolean
  bold: boolean
  /** Tamaño de la letra en píxeles CSS */
  size: number
  /** Centro del texto en coordenadas del MAPA (se mueve con él) */
  mx: number
  my: number
  /** Tamaño del rectángulo del texto en píxeles CSS */
  w: number
  h: number
  /** Letra blanca (fondo oscuro) o negra */
  white: boolean
  /** Contorno fino del color contrario, solo si el contraste es bajo */
  halo: boolean
}

export interface LayoutInput {
  map: MapData
  /** Vista y tamaño de la pantalla, en píxeles CSS */
  view: View
  width: number
  height: number
  mode: LabelMode
  /** Capitales con su nombre; null = sin etiquetas de capital */
  capitals: CapitalInfo[] | null
  /** Color de relleno del estado en esa posición (para elegir letra negra o blanca) */
  colorOf: (slot: number) => RGB3
  /** Ancho del texto a tamaño 1 */
  measure: (text: string, bold: boolean) => number
}

const PAD = 1.5 // aire alrededor del texto dentro del estado (px)
const GAP = 2 // separación mínima entre etiquetas (px)
const LINE = 1.05 // alto del texto respecto al tamaño de la letra
const CELL = 64 // celda del índice espacial (px)

/** Índice espacial en rejilla para detectar choques entre rectángulos de pantalla */
class RectGrid {
  private cells = new Map<number, number[]>()
  private rects: [number, number, number, number][] = []
  private key(cx: number, cy: number): number {
    return cx * 100003 + cy
  }
  private range(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = []
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
        out.push(this.key(cx, cy))
    return out
  }
  hits(x0: number, y0: number, x1: number, y1: number): boolean {
    for (const k of this.range(x0 - GAP, y0 - GAP, x1 + GAP, y1 + GAP))
      for (const i of this.cells.get(k) ?? []) {
        const r = this.rects[i]
        if (x0 - GAP < r[2] && x1 + GAP > r[0] && y0 - GAP < r[3] && y1 + GAP > r[1]) return true
      }
    return false
  }
  add(x0: number, y0: number, x1: number, y1: number): void {
    const id = this.rects.push([x0, y0, x1, y1]) - 1
    for (const k of this.range(x0, y0, x1, y1)) {
      const list = this.cells.get(k)
      if (list) list.push(id)
      else this.cells.set(k, [id])
    }
  }
}

interface Option {
  text: string
  star: boolean
  bold: boolean
  min: number
  max: number
}

/** Ancho de la estrella (y su separación) para una letra de tamaño `size` */
export const starWidth = (size: number): number => size * 0.95 + size * 0.3

export function layoutLabels(inp: LayoutInput): PlacedLabel[] {
  const { map, view, width, height } = inp
  const scale = view.scale
  const K = map.labelBoxes
  const slotOf = new Map(map.states.map((s, i) => [s.id, i]))
  const placed: PlacedLabel[] = []
  const grid = new RectGrid()
  const states = map.states
  const area = (slot: number): number =>
    map.statePixelOffsets[slot + 1] - map.statePixelOffsets[slot]

  /** ¿Está el estado (al menos su rectángulo mayor) cerca de la pantalla? */
  const visible = (slot: number): boolean => {
    const o = slot * LABEL_ASPECTS.length * BOX_FIELDS
    const hw = K[o + 2]
    if (hw <= 0) return false
    const R = (hw + 2) * scale + 40
    const sx = view.x + K[o] * scale
    const sy = view.y + K[o + 1] * scale
    return sx >= -R && sy >= -R && sx <= width + R && sy <= height + R
  }

  const tryPlace = (
    slot: number,
    kind: PlacedLabel['kind'],
    opts: Option[],
    ideal: number
  ): boolean => {
    for (const op of opts) {
      const top = Math.min(op.max, Math.max(op.min, Math.round(ideal)))
      for (let size = top; size >= op.min; size--) {
        const w = inp.measure(op.text, op.bold) * size + (op.star ? starWidth(size) : 0)
        const h = size * LINE
        const fit = fitLabelBox(K, slot, (w + PAD * 2) / scale, (h + PAD * 2) / scale)
        if (!fit) continue
        const sx = view.x + fit.x * scale
        const sy = view.y + fit.y * scale
        const x0 = sx - w / 2
        const y0 = sy - h / 2
        if (x0 > width || y0 > height || x0 + w < 0 || y0 + h < 0) return false
        if (grid.hits(x0, y0, x0 + w, y0 + h)) continue
        grid.add(x0, y0, x0 + w, y0 + h)
        const bg = inp.colorOf(slot)
        const white = textIsWhite(bg)
        const fg: RGB3 = white ? [255, 255, 255] : [0, 0, 0]
        placed.push({
          kind,
          stateId: states[slot].id,
          text: op.text,
          star: op.star,
          bold: op.bold,
          size,
          mx: fit.x,
          my: fit.y,
          w,
          h,
          white,
          halo: contrastRatio(fg, bg) < 4.5
        })
        return true
      }
    }
    return false
  }

  // 1. Capitales (prioridad máxima): nombre del país en negrita con ★; si no cabe, el tag; si
  //    tampoco, solo ★. Entre capitales gana la del estado más grande.
  const taken = new Set<number>()
  if (inp.capitals) {
    const caps = inp.capitals
      .map((c) => ({ c, slot: slotOf.get(c.stateId) }))
      .filter((x): x is { c: CapitalInfo; slot: number } => x.slot !== undefined && visible(x.slot))
      .sort((a, b) => area(b.slot) - area(a.slot))
    for (const { c, slot } of caps) {
      const screenSize = Math.sqrt(area(slot)) * scale
      const ideal = Math.max(MAP_THEME.font.capitalMin, screenSize * 0.15)
      const { capitalMin: min, capitalMax: max } = MAP_THEME.font
      const opts: Option[] = [
        { text: c.name, star: true, bold: true, min, max },
        { text: c.tag, star: true, bold: true, min, max },
        { text: '', star: true, bold: true, min, max }
      ]
      if (tryPlace(slot, 'capital', opts, ideal)) taken.add(slot)
    }
  }

  // 2. Etiquetas de estado, de mayor a menor
  if (inp.mode !== 'ninguna') {
    const order = states
      .map((_, slot) => slot)
      .filter((slot) => !taken.has(slot) && visible(slot))
      .sort((a, b) => area(b) - area(a))
    const { stateMin: min, stateMax: max } = MAP_THEME.font
    for (const slot of order) {
      const s = states[slot]
      const screenSize = Math.sqrt(area(slot)) * scale
      if (screenSize < 8) continue
      const ideal = Math.max(min, screenSize * 0.12) // proporcional al tamaño en pantalla
      const id = String(s.id)
      const opts: Option[] =
        inp.mode === 'id'
          ? [{ text: id, star: false, bold: false, min, max }]
          : inp.mode === 'nombre'
            ? [{ text: s.name, star: false, bold: false, min, max }]
            : [
                { text: `${id} ${s.name}`, star: false, bold: false, min, max },
                { text: id, star: false, bold: false, min, max }
              ]
      tryPlace(slot, 'state', opts, ideal)
    }
  }
  return placed
}

/** Dibuja las etiquetas colocadas siguiendo la vista ACTUAL (sin recalcular la colocación) */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: PlacedLabel[],
  view: View,
  width: number,
  height: number
): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const l of labels) {
    const sx = view.x + l.mx * view.scale
    const sy = view.y + l.my * view.scale
    if (sx < -l.w || sy < -l.h || sx > width + l.w || sy > height + l.h) continue
    const fg = l.white ? '#FFFFFF' : MAP_THEME.label
    const halo = l.white ? '#000000' : '#FFFFFF'
    let x = sx - l.w / 2
    if (l.star) {
      const r = l.size * 0.48
      drawStar(ctx, x + r, sy, r, fg, l.halo ? halo : null)
      x += starWidth(l.size)
    }
    if (l.text) {
      ctx.font = `${l.bold ? 700 : 500} ${l.size}px ${LABEL_FONT}`
      if (l.halo) {
        ctx.lineWidth = Math.max(1.5, l.size * 0.18)
        ctx.strokeStyle = halo
        ctx.strokeText(l.text, x, sy + 0.5)
      }
      ctx.fillStyle = fg
      ctx.fillText(l.text, x, sy + 0.5)
    }
  }
}

/** Fuente sans-serif del sistema */
export const LABEL_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  halo: string | null
): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  if (halo) {
    ctx.lineWidth = Math.max(1.5, r * 0.4)
    ctx.strokeStyle = halo
    ctx.stroke()
  }
  ctx.fillStyle = fill
  ctx.fill()
}

/** Medidor de texto con canvas (el ancho a tamaño 1 se guarda por texto) */
export function canvasMeasure(): (text: string, bold: boolean) => number {
  const c = document.createElement('canvas').getContext('2d')!
  const cache = new Map<string, number>()
  return (text, bold) => {
    const k = (bold ? 'b' : 'n') + text
    let v = cache.get(k)
    if (v === undefined) {
      c.font = `${bold ? 700 : 500} 100px ${LABEL_FONT}`
      v = c.measureText(text).width / 100
      cache.set(k, v)
    }
    return v
  }
}

/** Capitales que se muestran: país, nombre y estado, solo si el estado es SUYO ahora mismo */
export function capitalLabels(
  entries: { tag: string; name: string; stateId: number | null | undefined }[],
  ownerOfState: (stateId: number) => string | undefined,
  isShown: (stateId: number) => boolean
): CapitalInfo[] {
  const out: CapitalInfo[] = []
  const seen = new Set<number>()
  for (const e of entries) {
    if (!e.stateId || seen.has(e.stateId)) continue
    if (ownerOfState(e.stateId) !== e.tag || !isShown(e.stateId)) continue
    seen.add(e.stateId)
    out.push({ tag: e.tag, name: e.name, stateId: e.stateId })
  }
  return out
}
