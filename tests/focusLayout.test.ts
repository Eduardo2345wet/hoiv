import { describe, expect, it } from 'vitest'
import type { Focus, Project } from '../src/renderer/src/types'
import {
  autoLayout,
  branchOf,
  dropFocus,
  dropInfo,
  repairTree
} from '../src/renderer/src/focus/layout'
import { createFocus, connectExclusive, connectPrerequisite } from '../src/renderer/src/ui/projectOps'
import { emptyProject } from './fixtures'

/** Árbol de prueba: crea focos con nombre en posiciones dadas */
function build(spec: Record<string, [number, number]>): { p: Project; id: Record<string, string> } {
  let p = emptyProject()
  const id: Record<string, string> = {}
  for (const [name, [x, y]] of Object.entries(spec)) {
    const r = createFocus(p, x, y, name)
    p = r.project
    id[name] = r.focus.uid
  }
  return { p, id }
}
const link = (p: Project, a: string, b: string): Project => {
  const r = connectPrerequisite(p, a, b)
  if (typeof r === 'string') throw new Error(r)
  return r
}
const get = (p: Project, uid: string): Focus => p.focuses.find((f) => f.uid === uid)!
const noOverlap = (p: Project): boolean => {
  const s = new Set(p.focuses.map((f) => `${f.treeId}:${f.x},${f.y}`))
  return s.size === p.focuses.length
}
const rowsOk = (p: Project): boolean =>
  p.focuses.every((f) => f.prerequisites.every((u) => get(p, u).y < f.y))

describe('soltar en la cuadrícula', () => {
  it('casilla ocupada: los dos focos intercambian lugar', () => {
    const { p, id } = build({ A: [0, 0], B: [3, 0], C: [5, 0] })
    const q = dropFocus(p, id.A, 3, 0)
    expect([get(q, id.A).x, get(q, id.B).x]).toEqual([3, 0])
    expect(noOverlap(q)).toBe(true)
  })
  it('no puede quedar en la fila de sus prerrequisitos ni arriba: baja a la primera válida', () => {
    let { p, id } = build({ A: [0, 2], B: [0, 3] })
    p = link(p, id.A, id.B)
    const info = dropInfo(p, id.B, 0, 1)
    expect(info.valid).toBe(false)
    expect(info.cell.y).toBe(3)
    const q = dropFocus(p, id.B, 2, 0)
    expect(get(q, id.B).y).toBe(3)
    expect(get(q, id.B).x).toBe(2)
    expect(rowsOk(q)).toBe(true)
  })
  it('arrastrar una raíz mueve su rama; con branch:false solo ese foco', () => {
    let { p, id } = build({ R: [0, 0], H: [0, 1], N: [0, 2], X: [4, 1] })
    p = link(link(p, id.R, id.H), id.H, id.N)
    p = link(p, id.R, id.X) // X depende solo de R también
    expect(branchOf(p, id.R).sort()).toEqual([id.R, id.H, id.N, id.X].sort())
    const q = dropFocus(p, id.R, 2, 0)
    expect(get(q, id.H).x).toBe(2)
    expect(get(q, id.N).x).toBe(2)
    expect(get(q, id.X).x).toBe(6)
    const q2 = dropFocus(p, id.R, 2, 0, { branch: false })
    expect(get(q2, id.R).x).toBe(2)
    expect(get(q2, id.H).x).toBe(0)
    expect(rowsOk(q2) && noOverlap(q2)).toBe(true)
  })
  it('un foco con dos padres no forma parte de la rama de uno solo', () => {
    let { p, id } = build({ A: [0, 0], B: [2, 0], C: [1, 1] })
    p = link(link(p, id.A, id.C), id.B, id.C)
    expect(branchOf(p, id.A)).toEqual([id.A])
  })
  it('repairTree: sin focos encimados y respetando las filas', () => {
    let { p, id } = build({ A: [0, 0], B: [0, 0], C: [0, 0] })
    p = link(p, id.A, id.C)
    const q = repairTree(p, p.focuses[0].treeId)
    expect(noOverlap(q) && rowsOk(q)).toBe(true)
  })
})

describe('Ordenar árbol', () => {
  it('Foco 1 → Foco 2 → Foco 3, con Foco 3 excluyente de Foco 4: cascada y 3 con 4 juntos', () => {
    let { p, id } = build({ 'Foco 1': [5, 5], 'Foco 2': [0, 0], 'Foco 3': [9, 1], 'Foco 4': [0, 7] })
    p = link(link(p, id['Foco 1'], id['Foco 2']), id['Foco 2'], id['Foco 3'])
    const e = connectExclusive(p, id['Foco 3'], id['Foco 4'])
    if (typeof e === 'string') throw new Error(e)
    const q = autoLayout(e, p.focuses[0].treeId)
    const [f1, f2, f3, f4] = ['Foco 1', 'Foco 2', 'Foco 3', 'Foco 4'].map((n) => get(q, id[n]))
    expect([f1.y, f2.y, f3.y]).toEqual([0, 1, 2])
    expect(f1.x).toBe(f2.x)
    expect(f2.x).toBe(f3.x)
    expect(f4.y).toBe(f3.y)
    expect(Math.abs(f4.x - f3.x)).toBe(1)
    expect(Math.min(...q.focuses.map((f) => f.x))).toBe(0)
    expect(Math.min(...q.focuses.map((f) => f.y))).toBe(0)
    expect(noOverlap(q) && rowsOk(q)).toBe(true)
    // todo entero
    expect(q.focuses.every((f) => Number.isInteger(f.x) && Number.isInteger(f.y))).toBe(true)
  })
  it('hijos centrados bajo su padre y ramas independientes con 2 columnas de por medio', () => {
    let { p, id } = build({ P: [9, 9], A: [0, 0], B: [0, 0], Q: [3, 3], C: [4, 4] })
    p = link(link(p, id.P, id.A), id.P, id.B)
    p = link(p, id.Q, id.C)
    const q = autoLayout(p, p.focuses[0].treeId)
    const P = get(q, id.P)
    const A = get(q, id.A)
    const B = get(q, id.B)
    expect(P.y).toBe(0)
    expect([A.y, B.y]).toEqual([1, 1])
    expect(Math.abs(A.x - B.x)).toBe(1)
    expect(P.x).toBeGreaterThanOrEqual(Math.min(A.x, B.x))
    expect(P.x).toBeLessThanOrEqual(Math.max(A.x, B.x))
    // segunda rama (Q → C) a la derecha, 2 columnas vacías de por medio
    const maxFirst = Math.max(P.x, A.x, B.x)
    const minSecond = Math.min(get(q, id.Q).x, get(q, id.C).x)
    expect(minSecond - maxFirst).toBe(3)
    expect(noOverlap(q)).toBe(true)
  })
  it('los fijados (pin) y los focos sueltos no se mueven', () => {
    let { p, id } = build({ A: [7, 0], B: [7, 5], Z: [20, 20] })
    p = link(p, id.A, id.B)
    p = { ...p, focuses: p.focuses.map((f) => (f.uid === id.A ? { ...f, pinned: true } : f)) }
    const q = autoLayout(p, p.focuses[0].treeId)
    expect([get(q, id.A).x, get(q, id.A).y]).toEqual([7, 0])
    expect([get(q, id.Z).x, get(q, id.Z).y]).toEqual([20, 20])
    expect(get(q, id.B).y).toBe(1)
  })
  it('ordenar dos veces da el mismo resultado', () => {
    let { p, id } = build({ A: [0, 0], B: [4, 0], C: [2, 2], D: [6, 6] })
    p = link(link(p, id.A, id.C), id.B, id.C)
    p = link(p, id.C, id.D)
    const t = p.focuses[0].treeId
    const q = autoLayout(p, t)
    expect(autoLayout(q, t).focuses.map((f) => [f.x, f.y])).toEqual(q.focuses.map((f) => [f.x, f.y]))
  })
})

import { generateFocusTree } from '../src/renderer/src/generator/focusTree'

describe('exportación de posiciones', () => {
  it('x e y son los enteros que se ven; con relative_position_id dan las mismas posiciones finales', () => {
    let { p, id } = build({ A: [3, 0], B: [5, 2], C: [1, 4] })
    p = link(link(p, id.A, id.B), id.B, id.C)
    const abs = generateFocusTree(p)
    for (const f of p.focuses) expect(abs).toContain(`x = ${f.x}\n`)
    expect(abs).not.toContain('relative_position_id')
    const rel = generateFocusTree({
      ...p,
      treeSettings: { autoArrange: true, relativePositions: true }
    })
    // Reconstruye posiciones finales: absoluta de la raíz + suma de relativos
    const blocks = rel.split('focus = {').slice(1)
    const parsed = new Map<string, { x: number; y: number; rel: string | null }>()
    for (const b of blocks) {
      const fid = /id = (\S+)/.exec(b)![1]
      parsed.set(fid, {
        x: Number(/\bx = (-?\d+)/.exec(b)![1]),
        y: Number(/\by = (-?\d+)/.exec(b)![1]),
        rel: /relative_position_id = (\S+)/.exec(b)?.[1] ?? null
      })
    }
    const final = (fid: string): { x: number; y: number } => {
      const n = parsed.get(fid)!
      if (!n.rel) return { x: n.x, y: n.y }
      const base = final(n.rel)
      return { x: n.x + base.x, y: n.y + base.y }
    }
    for (const f of p.focuses) expect(final(f.id)).toEqual({ x: f.x, y: f.y })
  })
})

import { routeEdge } from '../src/renderer/src/focus/routes'

describe('líneas en ángulo recto', () => {
  const g = { cellW: 120, cellH: 140, nodeH: 96 }
  it('hijo en la fila siguiente: baja, va en horizontal y baja', () => {
    const r = routeEdge({ x: 0, y: 0 }, { x: 2, y: 1 }, new Set(), g)
    expect(r).toHaveLength(4)
    expect(r[0][0]).toBe(60)
    expect(r[1][0]).toBe(60)
    expect(r[2][0]).toBe(300)
    expect(r[1][1]).toBe(r[2][1]) // el tramo horizontal queda a media fila
    for (let i = 1; i < r.length; i++) expect(r[i][0] === r[i - 1][0] || r[i][1] === r[i - 1][1]).toBe(true)
  })
  it('varias filas: la bajada larga evita las casillas ocupadas', () => {
    const occupied = new Set(['2,1', '0,1'])
    const r = routeEdge({ x: 0, y: 0 }, { x: 2, y: 2 }, occupied, g)
    const lane = r[2][0]
    expect(lane).not.toBe(60)
    expect(lane).not.toBe(300)
  })
})

import { parseFocusGrid } from '../src/main/game'

describe('cuadrícula del juego (nationalfocusview.gui)', () => {
  it('lee focus_spacing, link_offsets y link_spacing; null si falta', () => {
    const gui = `containerWindowType = {
	name = "focus_tree"
	focus_spacing = { x = 90 y = 130 }
	link_offsets = { x = 0 y = -12 }
	link_spacing = { x = 4 y = 6 }
}`
    expect(parseFocusGrid(gui)).toEqual({
      spacing: { x: 90, y: 130 },
      linkOffsets: { x: 0, y: -12 },
      linkSpacing: { x: 4, y: 6 }
    })
    expect(parseFocusGrid('nada = 1')).toBeNull()
  })
})
