// "Centro visual" de cada estado: el píxel del estado más alejado de su borde
// (polo de inaccesibilidad sobre el ráster). Así la etiqueta cae siempre DENTRO del estado,
// aunque tenga forma de C o de U. Se calcula una vez al cargar el mapa (y queda en la caché).

/**
 * Transformada de distancia chamfer 3-4 (aproxima la distancia euclídea × 3).
 * Distancia 0 = píxel de borde (su vecino es de otro estado, mar o el filo del mapa).
 * Devuelve por id de estado: [x, y, radio en píxeles del mapa].
 */
export function computeStateLabels(
  width: number,
  height: number,
  provinceIndex: Uint16Array,
  provinceToState: Uint16Array
): Record<number, [number, number, number]> {
  const n = width * height
  const st = new Uint16Array(n)
  for (let i = 0; i < n; i++) st[i] = provinceToState[provinceIndex[i]]
  const INF = 0xffff
  const d = new Uint16Array(n)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const s = st[i]
      if (!s) continue
      const edge =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        st[i - 1] !== s ||
        st[i + 1] !== s ||
        st[i - width] !== s ||
        st[i + width] !== s
      d[i] = edge ? 0 : INF
    }
  const relax = (i: number, j: number, cost: number): void => {
    const v = d[j] + cost
    if (v < d[i]) d[i] = v
  }
  // Pasada hacia adelante (arriba-izquierda) y hacia atrás (abajo-derecha).
  // Solo se propaga dentro del mismo estado.
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (!st[i] || d[i] === 0) continue
      const s = st[i]
      if (st[i - 1] === s) relax(i, i - 1, 3)
      if (st[i - width] === s) relax(i, i - width, 3)
      if (st[i - width - 1] === s) relax(i, i - width - 1, 4)
      if (st[i - width + 1] === s) relax(i, i - width + 1, 4)
    }
  for (let y = height - 2; y >= 1; y--)
    for (let x = width - 2; x >= 1; x--) {
      const i = y * width + x
      if (!st[i] || d[i] === 0) continue
      const s = st[i]
      if (st[i + 1] === s) relax(i, i + 1, 3)
      if (st[i + width] === s) relax(i, i + width, 3)
      if (st[i + width + 1] === s) relax(i, i + width + 1, 4)
      if (st[i + width - 1] === s) relax(i, i + width - 1, 4)
    }
  // El píxel con mayor distancia de cada estado
  const best = new Map<number, [number, number, number]>()
  for (let i = 0; i < n; i++) {
    const s = st[i]
    if (!s) continue
    const cur = best.get(s)
    if (!cur || d[i] > cur[2]) best.set(s, [i % width, Math.floor(i / width), d[i]])
  }
  const out: Record<number, [number, number, number]> = {}
  for (const [s, [x, y, dist]] of best) out[s] = [x, y, dist / 3 + 0.5]
  return out
}
