// Fronteras vectoriales: del mapa de estados por píxel a polilíneas suaves.
//
// 1. Cada borde de píxel entre dos estados distintos es un segmento unitario de la rejilla de
//    vértices (marching squares sobre la rejilla de estados). Se unen en polilíneas por PAR de
//    estados vecinos y por COSTA (estado ↔ mar/lago, par (0, estado)); cortan en los cruces.
//    Las esquinas de la escalera se cortan a 0.5 px (contorno de marching squares).
// 2. Douglas-Peucker con tolerancia 0.5 px del mapa (ningún punto del contorno se aleja más).
// 3. Un paso de Chaikin con recorte máximo `chaikinCap`, sin mover los extremos.
// 4. Revisión: si la simplificación o el suavizado hace cruzar dos líneas, esa polilínea vuelve a
//    su forma sin simplificar (que nunca cruza a otra). Así la topología no cambia.
//
// Se calcula UNA vez (al cargar el mapa) y se guarda en la caché; pintar no toca la geometría.
import type { MapData } from './types'

export interface BorderSet {
  /** x, y de todos los puntos (píxeles del mapa, entre píxeles), polilínea tras polilínea */
  points: Float32Array
  /** Índice de PUNTO donde empieza cada polilínea (largo = polilíneas + 1) */
  starts: Uint32Array
  /** Estados que separa cada polilínea: a < b; a = 0 significa COSTA de b */
  a: Uint16Array
  b: Uint16Array
}

export interface BorderStats {
  ms: number
  /** Puntos antes de simplificar (sin los colineales) */
  rawPoints: number
  points: number
  polylines: number
  coastPolylines: number
  /** Polilíneas que volvieron a su forma original para no cruzarse */
  reverted: number
}

export interface VectorOptions {
  /** Tolerancia de Douglas-Peucker en píxeles del mapa */
  tolerance?: number
  /** Recorte máximo de cada esquina en el paso de Chaikin (0 = sin suavizar) */
  chaikinCap?: number
}

export const VECTOR_DEFAULTS = { tolerance: 0.5, chaikinCap: 0.5 } as const

type VectorInput = Pick<MapData, 'width' | 'height' | 'provinceIndex' | 'provinceToState'>

const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

interface Line {
  lo: number
  hi: number
  closed: boolean
  raw: Float64Array
  smooth: Float64Array
  useRaw: boolean
}

export function vectorizeBorders(
  map: VectorInput,
  opts: VectorOptions = {}
): { borders: BorderSet; stats: BorderStats } {
  const t0 = performance.now()
  const tol = opts.tolerance ?? VECTOR_DEFAULTS.tolerance
  const cap = opts.chaikinCap ?? VECTOR_DEFAULTS.chaikinCap
  const { width: W, height: H } = map
  const g = new Uint16Array(W * H)
  for (let i = 0; i < g.length; i++) g[i] = map.provinceToState[map.provinceIndex[i]]

  const key = (p: number, q: number): number => (p < q ? p * 65536 + q : q * 65536 + p)
  /** Etiqueta (par de estados) del borde que sale del vértice (vx, vy) en la dirección dir */
  const edgeKey = (vx: number, vy: number, dir: number): number => {
    if (dir === 0) {
      if (vy < 1 || vy >= H || vx >= W) return 0
      const p = g[(vy - 1) * W + vx]
      const q = g[vy * W + vx]
      return p === q ? 0 : key(p, q)
    }
    if (dir === 1) {
      if (vx < 1 || vx >= W || vy >= H) return 0
      const p = g[vy * W + vx - 1]
      const q = g[vy * W + vx]
      return p === q ? 0 : key(p, q)
    }
    if (dir === 2) return vx < 1 ? 0 : edgeKey(vx - 1, vy, 0)
    return vy < 1 ? 0 : edgeKey(vx, vy - 1, 1)
  }

  const VW = W + 1
  const visited = new Uint8Array(VW * (H + 1))
  const isVisited = (vx: number, vy: number, dir: number): boolean => {
    if (dir === 0) return (visited[vy * VW + vx] & 1) !== 0
    if (dir === 1) return (visited[vy * VW + vx] & 2) !== 0
    if (dir === 2) return (visited[vy * VW + vx - 1] & 1) !== 0
    return (visited[(vy - 1) * VW + vx] & 2) !== 0
  }
  const mark = (vx: number, vy: number, dir: number): void => {
    if (dir === 0) visited[vy * VW + vx] |= 1
    else if (dir === 1) visited[vy * VW + vx] |= 2
    else if (dir === 2) visited[vy * VW + vx - 1] |= 1
    else visited[(vy - 1) * VW + vx] |= 2
  }

  // ---- 1. Unir bordes unitarios en polilíneas ----
  const lines: Line[] = []
  let rawPoints = 0
  let buf = new Int32Array(1 << 14)
  const trace = (sx: number, sy: number, d0: number, label: number, loop: boolean): void => {
    let n = 0
    const push = (x: number, y: number): void => {
      if (n * 2 + 2 > buf.length) {
        const nb = new Int32Array(buf.length * 2)
        nb.set(buf)
        buf = nb
      }
      buf[n * 2] = x
      buf[n * 2 + 1] = y
      n++
    }
    let cx = sx
    let cy = sy
    let dir = d0
    let last = -1
    push(cx, cy)
    for (;;) {
      mark(cx, cy, dir)
      const nx = cx + DX[dir]
      const ny = cy + DY[dir]
      if (dir === last) {
        buf[(n - 1) * 2] = nx
        buf[(n - 1) * 2 + 1] = ny
      } else push(nx, ny)
      last = dir
      if (loop && nx === sx && ny === sy) break
      let next = -1
      let cnt = 0
      for (let dd = 0; dd < 4; dd++)
        if (edgeKey(nx, ny, dd) === label) {
          cnt++
          if (dd !== ((dir + 2) & 3)) next = dd
        }
      if (cnt !== 2 || next < 0) break
      cx = nx
      cy = ny
      dir = next
    }
    const raw = new Float64Array(n * 2)
    for (let i = 0; i < n * 2; i++) raw[i] = buf[i]
    rawPoints += n
    lines.push({
      lo: Math.floor(label / 65536),
      hi: label % 65536,
      closed: loop,
      raw,
      smooth: raw,
      useRaw: false
    })
  }

  const k = [0, 0, 0, 0]
  // Pasada 1: desde los extremos (cruces, bordes del mapa). Pasada 2: lazos cerrados.
  for (let pass = 0; pass < 2; pass++)
    for (let vy = 0; vy <= H; vy++)
      for (let vx = 0; vx <= W; vx++) {
        if (vx > 0 && vx < W && vy > 0 && vy < H) {
          const i = vy * W + vx
          const p = g[i - W - 1]
          if (p === g[i - W] && p === g[i - 1] && p === g[i]) continue
        }
        for (let d = 0; d < 4; d++) k[d] = edgeKey(vx, vy, d)
        for (let d = 0; d < 4; d++) {
          const L = k[d]
          if (L === 0 || isVisited(vx, vy, d)) continue
          const cnt =
            (k[0] === L ? 1 : 0) +
            (k[1] === L ? 1 : 0) +
            (k[2] === L ? 1 : 0) +
            (k[3] === L ? 1 : 0)
          if (pass === 0 ? cnt !== 2 : cnt === 2) trace(vx, vy, d, L, pass === 1)
        }
      }

  // ---- 2 y 3. Simplificar y suavizar ----
  for (const ln of lines) ln.smooth = smoothLine(ln.raw, ln.closed, tol, cap)

  // ---- 4. Sin cruces: las polilíneas que se cruzan vuelven a su forma original ----
  let reverted = 0
  for (let guard = 0; guard < 8; guard++) {
    const bad = crossingLines(
      lines.map((l) => (l.useRaw ? l.raw : l.smooth)),
      W,
      H
    )
    if (!bad.size) break
    let changed = false
    for (const i of bad)
      if (!lines[i].useRaw) {
        lines[i].useRaw = true
        reverted++
        changed = true
      }
    if (!changed) break
  }
  if (
    crossingLines(
      lines.map((l) => (l.useRaw ? l.raw : l.smooth)),
      W,
      H
    ).size
  )
    for (const ln of lines) ln.useRaw = true

  // ---- Empaquetar ----
  let total = 0
  for (const ln of lines) total += (ln.useRaw ? ln.raw : ln.smooth).length / 2
  const points = new Float32Array(total * 2)
  const starts = new Uint32Array(lines.length + 1)
  const A = new Uint16Array(lines.length)
  const B = new Uint16Array(lines.length)
  let pos = 0
  let coast = 0
  lines.forEach((ln, i) => {
    const src = ln.useRaw ? ln.raw : ln.smooth
    starts[i] = pos
    for (let j = 0; j < src.length; j++) points[pos * 2 + j] = src[j]
    pos += src.length / 2
    A[i] = ln.lo
    B[i] = ln.hi
    if (ln.lo === 0) coast++
  })
  starts[lines.length] = pos
  return {
    borders: { points, starts, a: A, b: B },
    stats: {
      ms: performance.now() - t0,
      rawPoints,
      points: total,
      polylines: lines.length,
      coastPolylines: coast,
      reverted
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Simplificación y suavizado
// ---------------------------------------------------------------------------------------------

/** Distancia de (px, py) al segmento (ax, ay)-(bx, by) */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Douglas-Peucker sobre los puntos [from, to] (inclusive); marca los que se conservan */
function dp(xy: Float64Array, from: number, to: number, tol: number, keep: Uint8Array): void {
  const stack: number[] = [from, to]
  while (stack.length) {
    const j = stack.pop()!
    const i = stack.pop()!
    let worst = -1
    let wd = tol
    for (let m = i + 1; m < j; m++) {
      const d = distToSegment(
        xy[m * 2],
        xy[m * 2 + 1],
        xy[i * 2],
        xy[i * 2 + 1],
        xy[j * 2],
        xy[j * 2 + 1]
      )
      if (d > wd) {
        wd = d
        worst = m
      }
    }
    if (worst >= 0) {
      keep[worst] = 1
      stack.push(i, worst, worst, j)
    }
  }
}

/** Douglas-Peucker de una polilínea abierta o cerrada (cerrada: último punto = primero) */
export function simplifyLine(xy: Float64Array, closed: boolean, tol: number): Float64Array {
  const n = xy.length / 2
  if (n <= 2) return xy
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  if (closed) {
    // Dividir en el punto más lejano del inicio y simplificar las dos mitades
    let far = 1
    let fd = -1
    for (let m = 1; m < n - 1; m++) {
      const d = Math.hypot(xy[m * 2] - xy[0], xy[m * 2 + 1] - xy[1])
      if (d > fd) {
        fd = d
        far = m
      }
    }
    keep[far] = 1
    dp(xy, 0, far, tol, keep)
    dp(xy, far, n - 1, tol, keep)
  } else dp(xy, 0, n - 1, tol, keep)
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(xy[i * 2], xy[i * 2 + 1])
  if (closed && out.length / 2 < 4) return xy
  return Float64Array.from(out)
}

/**
 * Un paso de Chaikin (corta cada esquina a 1/4 de los lados) con un recorte máximo `cap`, para
 * que una esquina nunca se mueva más de `cap` píxeles. Los extremos de una línea abierta no se
 * mueven (los cruces entre fronteras siguen coincidiendo).
 */
export function chaikin(xy: Float64Array, closed: boolean, cap: number): Float64Array {
  const n = xy.length / 2
  if (cap <= 0 || n < 3) return xy
  const out: number[] = []
  const ux = (i: number, j: number): [number, number, number] => {
    const dx = xy[j * 2] - xy[i * 2]
    const dy = xy[j * 2 + 1] - xy[i * 2 + 1]
    const l = Math.hypot(dx, dy)
    return l ? [dx / l, dy / l, l] : [0, 0, 0]
  }
  const m = closed ? n - 1 : n // en lazos cerrados el último punto repite al primero
  if (!closed) out.push(xy[0], xy[1])
  const first = closed ? 0 : 1
  const last = closed ? m - 1 : n - 2
  for (let i = first; i <= last; i++) {
    const prev = closed ? (i - 1 + m) % m : i - 1
    const next = closed ? (i + 1) % m : i + 1
    const [ax, ay, la] = ux(prev, i)
    const [bx, by, lb] = ux(i, next)
    const da = Math.min(la / 4, cap)
    const db = Math.min(lb / 4, cap)
    // Esquina casi recta: cortarla no se ve y duplicaría el punto
    const turn = Math.abs(ax * by - ay * bx)
    if (Math.min(da, db) * turn < 0.03) {
      out.push(xy[i * 2], xy[i * 2 + 1])
      continue
    }
    out.push(xy[i * 2] - ax * da, xy[i * 2 + 1] - ay * da)
    out.push(xy[i * 2] + bx * db, xy[i * 2 + 1] + by * db)
  }
  if (!closed) out.push(xy[(n - 1) * 2], xy[(n - 1) * 2 + 1])
  else out.push(out[0], out[1])
  return Float64Array.from(out)
}

/**
 * Contorno de marching squares: la escalera de bordes de píxel pasa por los puntos medios de
 * cada borde unitario, o sea cada esquina se corta a 0.5 px (se aleja ≤ 0.354 px de la escalera).
 * Los extremos de una línea abierta (los cruces) no se mueven.
 */
export function marchingSquares(raw: Float64Array, closed: boolean): Float64Array {
  const n = raw.length / 2
  if (n < 3) return raw
  const out: number[] = []
  const m = closed ? n - 1 : n
  if (!closed) out.push(raw[0], raw[1])
  for (let i = closed ? 0 : 1; i < (closed ? m : n - 1); i++) {
    const p = closed ? (i - 1 + m) % m : i - 1
    const q = closed ? (i + 1) % m : i + 1
    const ax = Math.sign(raw[i * 2] - raw[p * 2])
    const ay = Math.sign(raw[i * 2 + 1] - raw[p * 2 + 1])
    const bx = Math.sign(raw[q * 2] - raw[i * 2])
    const by = Math.sign(raw[q * 2 + 1] - raw[i * 2 + 1])
    if (ax === bx && ay === by) {
      out.push(raw[i * 2], raw[i * 2 + 1])
      continue
    }
    out.push(raw[i * 2] - ax * 0.5, raw[i * 2 + 1] - ay * 0.5)
    out.push(raw[i * 2] + bx * 0.5, raw[i * 2 + 1] + by * 0.5)
  }
  if (!closed) out.push(raw[(n - 1) * 2], raw[(n - 1) * 2 + 1])
  else out.push(out[0], out[1])
  return Float64Array.from(out)
}

function smoothLine(raw: Float64Array, closed: boolean, tol: number, cap: number): Float64Array {
  return chaikin(simplifyLine(marchingSquares(raw, closed), closed, tol), closed, cap)
}

// ---------------------------------------------------------------------------------------------
// Cruces entre segmentos
// ---------------------------------------------------------------------------------------------

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number =>
  (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

/** ¿Se cruzan de verdad (en un punto interior de los dos) los segmentos AB y CD? */
export function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  // Si comparten un extremo exacto no es un cruce (cruces de fronteras / puntos consecutivos)
  if ((ax === cx && ay === cy) || (ax === dx && ay === dy)) return false
  if ((bx === cx && by === cy) || (bx === dx && by === dy)) return false
  const eps = 1e-9
  const o1 = orient(ax, ay, bx, by, cx, cy)
  const o2 = orient(ax, ay, bx, by, dx, dy)
  const o3 = orient(cx, cy, dx, dy, ax, ay)
  const o4 = orient(cx, cy, dx, dy, bx, by)
  return (
    ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
    ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))
  )
}

/** Índices de las polilíneas que se cruzan con otra o consigo mismas */
export function crossingLines(
  lines: ArrayLike<number>[],
  width: number,
  height: number,
  cell = 16
): Set<number> {
  const cols = Math.ceil(width / cell) + 1
  const rows = Math.ceil(height / cell) + 1
  // Segmento s → (línea, posición)
  const segLine: number[] = []
  const segPos: number[] = []
  const counts = new Uint32Array(cols * rows + 1)
  const cellsOf = (
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): [number, number, number, number] => [
    Math.max(0, Math.floor(Math.min(x0, x1) / cell)),
    Math.max(0, Math.floor(Math.min(y0, y1) / cell)),
    Math.min(cols - 1, Math.floor(Math.max(x0, x1) / cell)),
    Math.min(rows - 1, Math.floor(Math.max(y0, y1) / cell))
  ]
  lines.forEach((xy, li) => {
    for (let i = 0; i + 3 < xy.length; i += 2) {
      segLine.push(li)
      segPos.push(i)
      const [c0, r0, c1, r1] = cellsOf(xy[i], xy[i + 1], xy[i + 2], xy[i + 3])
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) counts[r * cols + c + 1]++
    }
  })
  for (let i = 0; i < cols * rows; i++) counts[i + 1] += counts[i]
  const fill = counts.slice(0, cols * rows)
  const items = new Uint32Array(counts[cols * rows])
  segLine.forEach((li, s) => {
    const xy = lines[li]
    const i = segPos[s]
    const [c0, r0, c1, r1] = cellsOf(xy[i], xy[i + 1], xy[i + 2], xy[i + 3])
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) items[fill[r * cols + c]++] = s
  })
  const bad = new Set<number>()
  for (let c = 0; c < cols * rows; c++)
    for (let p = counts[c]; p < counts[c + 1]; p++)
      for (let q = p + 1; q < counts[c + 1]; q++) {
        const s1 = items[p]
        const s2 = items[q]
        const l1 = segLine[s1]
        const l2 = segLine[s2]
        if (l1 === l2 && bad.has(l1)) continue
        if (l1 !== l2 && bad.has(l1) && bad.has(l2)) continue
        const A = lines[l1]
        const B = lines[l2]
        const i = segPos[s1]
        const j = segPos[s2]
        if (segmentsCross(A[i], A[i + 1], A[i + 2], A[i + 3], B[j], B[j + 1], B[j + 2], B[j + 3])) {
          bad.add(l1)
          bad.add(l2)
        }
      }
  return bad
}

// ---------------------------------------------------------------------------------------------
// Utilidades para quien consume el resultado
// ---------------------------------------------------------------------------------------------

/** Cantidad de segmentos (pares de puntos consecutivos) de todas las polilíneas */
export function segmentCount(b: BorderSet): number {
  return b.points.length / 2 - b.a.length
}

/** Una polilínea como lista de [x, y] (para pruebas) */
export function lineXY(b: BorderSet, i: number): number[] {
  return Array.from(b.points.subarray(b.starts[i] * 2, b.starts[i + 1] * 2))
}
