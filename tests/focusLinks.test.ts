import { describe, expect, it } from 'vitest'
import {
  connectExclusive,
  connectPrerequisite,
  createFocus,
  createFocusBelow
} from '../src/renderer/src/ui/projectOps'
import { emptyProject } from './fixtures'

function three() {
  let p = createFocus(emptyProject(), 0, 0, 'A').project
  p = createFocus(p, 0, 1, 'B').project
  p = createFocus(p, 0, 2, 'C').project
  const [a, b, c] = p.focuses.map((f) => f.uid)
  return { p, a, b, c }
}

describe('conexiones válidas', () => {
  it('crea padre → hijo; rechaza sí mismo, repetida y ciclo con un mensaje', () => {
    const { p, a, b, c } = three()
    const p1 = connectPrerequisite(p, a, b)
    expect(typeof p1).toBe('object')
    if (typeof p1 === 'string') return
    expect(p1.focuses.find((f) => f.uid === b)!.prerequisites).toEqual([a])
    expect(connectPrerequisite(p1, a, a)).toMatch(/sí mismo/)
    expect(connectPrerequisite(p1, a, b)).toMatch(/ya es prerrequisito/)
    const p2 = connectPrerequisite(p1, b, c) as typeof p
    expect(connectPrerequisite(p2, c, a)).toMatch(/ciclo/)
    // un borde que no crea ciclo sigue siendo válido
    expect(typeof connectPrerequisite(p2, a, c)).toBe('object')
  })
  it('la exclusión se crea en ambos sentidos; sí mismo y repetida se rechazan', () => {
    const { p, a, b } = three()
    const q = connectExclusive(p, a, b)
    if (typeof q === 'string') throw new Error(q)
    expect(q.focuses.find((f) => f.uid === a)!.mutuallyExclusive).toEqual([b])
    expect(q.focuses.find((f) => f.uid === b)!.mutuallyExclusive).toEqual([a])
    expect(connectExclusive(q, a, b)).toMatch(/ya son/)
    expect(connectExclusive(q, b, a)).toMatch(/ya son/)
    expect(connectExclusive(q, a, a)).toMatch(/sí mismo/)
  })
  it('"Añadir hijo" crea el foco debajo de su padre', () => {
    const { p, a } = three()
    const r = createFocusBelow(p, a)
    expect(r.focus.y).toBe(1)
  })
})
