// Rectángulos para las etiquetas: por cada estado y cada proporción (ancho/alto) del texto, el
// rectángulo MÁS GRANDE de esa proporción que cabe entero dentro del estado. Se calculan UNA vez
// (al cargar el mapa) y se guardan en la caché; al hacer zoom solo se comparan con el tamaño del
// texto en pantalla.

/** Proporciones ancho/alto de los rectángulos (los números son anchos; los nombres, muy anchos) */
export const LABEL_ASPECTS = [1, 1.6, 2.5, 4, 6, 9, 14] as const
/** Por cada (estado, proporción): centro x, centro y, medio ancho y medio alto (píxeles del mapa) */
export const BOX_FIELDS = 4

/**
 * @param width ancho del mapa en píxeles
 * @param pixelIndex píxeles de cada estado (CSR), ver MapData.statePixelIndex
 * @param offsets MapData.statePixelOffsets
 * @returns arreglo [estado][proporción][cx, cy, hw, hh] (hw = hh = 0 si no cabe nada)
 */
export function computeLabelBoxes(
  width: number,
  pixelIndex: Uint32Array,
  offsets: Uint32Array
): Float32Array {
  const states = offsets.length - 1
  const K = LABEL_ASPECTS.length
  const out = new Float32Array(states * K * BOX_FIELDS)

  // Cuadro envolvente de cada estado y tamaño máximo de la máscara
  const bbox = new Int32Array(states * 4)
  let maxArea = 0
  for (let s = 0; s < states; s++) {
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1
    let y1 = -1
    for (let k = offsets[s]; k < offsets[s + 1]; k++) {
      const i = pixelIndex[k]
      const y = Math.floor(i / width)
      const x = i - y * width
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    bbox.set([x0, y0, x1, y1], s * 4)
    if (x1 >= 0) maxArea = Math.max(maxArea, (x1 - x0 + 2) * (y1 - y0 + 2))
  }
  const sum = new Int32Array(maxArea) // imagen integral (bw+1)×(bh+1)
  const inside = new Uint8Array(maxArea)

  for (let s = 0; s < states; s++) {
    const x0 = bbox[s * 4]
    const y0 = bbox[s * 4 + 1]
    const x1 = bbox[s * 4 + 2]
    const y1 = bbox[s * 4 + 3]
    if (x1 < 0) continue
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const sw = bw + 1
    inside.fill(0, 0, bw * bh)
    for (let k = offsets[s]; k < offsets[s + 1]; k++) {
      const i = pixelIndex[k]
      const y = Math.floor(i / width)
      inside[(y - y0) * bw + (i - y * width - x0)] = 1
    }
    sum.fill(0, 0, sw * (bh + 1))
    for (let y = 0; y < bh; y++) {
      let row = 0
      for (let x = 0; x < bw; x++) {
        row += inside[y * bw + x]
        sum[(y + 1) * sw + x + 1] = sum[y * sw + x + 1] + row
      }
    }
    /** ¿El rectángulo de píxeles [xa, xb] × [ya, yb] está entero dentro del estado? */
    const full = (xa: number, ya: number, xb: number, yb: number): boolean => {
      if (xa < 0 || ya < 0 || xb >= bw || yb >= bh) return false
      const n =
        sum[(yb + 1) * sw + xb + 1] -
        sum[ya * sw + xb + 1] -
        sum[(yb + 1) * sw + xa] +
        sum[ya * sw + xa]
      return n === (xb - xa + 1) * (yb - ya + 1)
    }
    const halfW = (rho: number, b: number): number => Math.max(0, Math.round(rho * (b + 0.5) - 0.5))
    /** Mayor b (alto 2b+1) que cabe centrado en el píxel (cx, cy); -1 si ni el píxel */
    const best = (cx: number, cy: number, rho: number, top: number): number => {
      if (!inside[cy * bw + cx]) return -1
      let lo = 0
      let hi = top
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        const a = halfW(rho, mid)
        if (full(cx - a, cy - mid, cx + a, cy + mid)) lo = mid
        else hi = mid - 1
      }
      return lo
    }

    const stride = Math.max(1, Math.floor(Math.sqrt((bw * bh) / 1200)))
    for (let k = 0; k < K; k++) {
      const rho = LABEL_ASPECTS[k]
      const top = Math.max(
        0,
        Math.min(Math.floor((bh - 1) / 2), Math.floor((bw - 1) / 2 / rho) + 1)
      )
      let bb = -1
      let bx = 0
      let by = 0
      for (let cy = 0; cy < bh; cy += stride)
        for (let cx = 0; cx < bw; cx += stride) {
          const b = best(cx, cy, rho, top)
          if (b > bb) {
            bb = b
            bx = cx
            by = cy
          }
        }
      // Afinar alrededor del mejor candidato
      if (stride > 1) {
        const cx0 = bx
        const cy0 = by
        for (let cy = Math.max(0, cy0 - stride); cy <= Math.min(bh - 1, cy0 + stride); cy++)
          for (let cx = Math.max(0, cx0 - stride); cx <= Math.min(bw - 1, cx0 + stride); cx++) {
            const b = best(cx, cy, rho, top)
            if (b > bb) {
              bb = b
              bx = cx
              by = cy
            }
          }
      }
      if (bb < 0) continue
      // Si ni siquiera cabe un píxel con esa proporción, el rectángulo mínimo es el píxel central
      const o = (s * K + k) * BOX_FIELDS
      out[o] = x0 + bx + 0.5
      out[o + 1] = y0 + by + 0.5
      out[o + 2] = halfW(rho, bb) + 0.5
      out[o + 3] = bb + 0.5
    }
  }
  return out
}

/**
 * Elige el mejor rectángulo del estado `slot` para un texto de `w × h` píxeles del mapa.
 * Devuelve el centro donde poner el texto, o null si no cabe en ningún rectángulo.
 */
export function fitLabelBox(
  boxes: Float32Array,
  slot: number,
  w: number,
  h: number
): { x: number; y: number; slack: number } | null {
  const K = LABEL_ASPECTS.length
  let best: { x: number; y: number; slack: number } | null = null
  for (let k = 0; k < K; k++) {
    const o = (slot * K + k) * BOX_FIELDS
    const hw = boxes[o + 2]
    const hh = boxes[o + 3]
    if (hw <= 0 || hh <= 0) continue
    const slack = Math.min((2 * hw) / w, (2 * hh) / h)
    if (slack >= 1 && (!best || slack > best.slack)) best = { x: boxes[o], y: boxes[o + 1], slack }
  }
  return best
}
