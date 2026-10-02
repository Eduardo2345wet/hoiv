// Rutas de las líneas de prerrequisito, en ángulo recto como en el juego: bajan hasta media fila,
// van en horizontal y bajan al hijo. Si el hijo está varias filas más abajo, la bajada larga busca
// una columna libre para no pasar por encima de otros focos.
export interface Geom {
  cellW: number
  cellH: number
  nodeH: number
}

/** Puntos (px) de la línea padre → hijo. `occupied` = casillas "x,y" con un foco */
export function routeEdge(
  parent: { x: number; y: number },
  child: { x: number; y: number },
  occupied: Set<string>,
  g: Geom
): [number, number][] {
  const px = parent.x * g.cellW + g.cellW / 2
  const cxp = child.x * g.cellW + g.cellW / 2
  const y1 = parent.y * g.cellH + g.cellH / 2 + g.nodeH / 2
  const y2 = child.y * g.cellH + g.cellH / 2 - g.nodeH / 2
  if (child.y <= parent.y)
    return [
      [px, y1],
      [px, (y1 + y2) / 2],
      [cxp, (y1 + y2) / 2],
      [cxp, y2]
    ]
  if (child.y - parent.y === 1) {
    const mid = (y1 + y2) / 2
    return [
      [px, y1],
      [px, mid],
      [cxp, mid],
      [cxp, y2]
    ]
  }
  // Varias filas: columna libre (la del hijo, la del padre o la más cercana libre)
  const free = (col: number): boolean => {
    for (let r = parent.y + 1; r < child.y; r++) if (occupied.has(`${col},${r}`)) return false
    return true
  }
  const cands = [child.x, parent.x]
  for (let d = 1; d <= 6; d++) cands.push(child.x - d, child.x + d)
  const lane = cands.find((c) => c >= 0 && free(c)) ?? child.x
  const lx = lane * g.cellW + g.cellW / 2
  const ya = (parent.y + 1) * g.cellH + (g.cellH - g.nodeH) / 4 // hueco justo debajo del padre
  const yb = child.y * g.cellH - (g.cellH - g.nodeH) / 4 // hueco justo encima del hijo
  if (lane === parent.x && parent.x === child.x)
    return [
      [px, y1],
      [cxp, y2]
    ]
  return [
    [px, y1],
    [px, ya],
    [lx, ya],
    [lx, yb],
    [cxp, yb],
    [cxp, y2]
  ]
}
