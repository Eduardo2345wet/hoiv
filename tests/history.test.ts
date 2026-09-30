// Pruebas del historial de deshacer / rehacer del store
import { beforeEach, describe, expect, it } from 'vitest'
import { store, HISTORY_LIMIT } from '../src/renderer/src/store/appStore'
import {
  createFocus,
  deleteFocus,
  renameFocusId,
  updateFocus
} from '../src/renderer/src/ui/projectOps'
import type { Project } from '../src/renderer/src/types'
import { emptyProject, withRefs } from './fixtures'

const p = (): Project => store.get().project!

beforeEach(() => store.openProject(withRefs(), null))

describe('deshacer / rehacer', () => {
  it('mover (agrupado), borrar y renombrar vuelven atrás, incluidas las referencias', () => {
    const [a, b] = p().focuses
    const original = p()
    // Arrastre: muchos movimientos = 1 paso
    for (let x = 1; x <= 5; x++)
      store.updateProject((pr) => updateFocus(pr, a.uid, { x }), { group: `drag:${a.uid}` })
    store.endGroup()
    expect(store.get().past).toHaveLength(1)
    store.updateProject((pr) => renameFocusId(pr, a.uid, 'MEX_otro'))
    expect(JSON.stringify(p().focuses[1].blocks)).toContain('MEX_otro')
    store.updateProject((pr) => deleteFocus(pr, a.uid))
    expect(p().focuses).toHaveLength(1)

    store.undo() // borrar
    expect(p().focuses.map((f) => f.uid)).toEqual([a.uid, b.uid])
    expect(p().focuses[1].prerequisites).toEqual(original.focuses[1].prerequisites)
    store.undo() // renombrar
    expect(p().focuses[0].id).toBe(a.id)
    expect(JSON.stringify(p().focuses[1].blocks)).toContain(`"FOCUS":"${a.id}"`)
    expect(p().focuses[1].scripts.available).toContain(a.id)
    store.undo() // mover
    expect(p().focuses[0].x).toBe(0)
    expect(store.canUndo()).toBe(false)

    store.redo()
    expect(p().focuses[0].x).toBe(5)
    store.redo()
    expect(p().focuses[0].id).toBe('MEX_otro')
  })

  it('escribir en un campo = 1 paso; endGroup lo cierra', () => {
    const uid = p().focuses[0].uid
    for (const n of ['I', 'In', 'Ind'])
      store.updateProject((pr) => updateFocus(pr, uid, { name: n }), { group: `field:${uid}:name` })
    expect(store.get().past).toHaveLength(1)
    store.endGroup()
    store.updateProject((pr) => updateFocus(pr, uid, { name: 'Indu' }), {
      group: `field:${uid}:name`
    })
    expect(store.get().past).toHaveLength(2)
  })

  it('un cambio nuevo borra el rehacer y el límite es de ~100 pasos', () => {
    store.openProject(emptyProject(), null)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++)
      store.updateProject((pr) => createFocus(pr, i, 0).project)
    expect(store.get().past).toHaveLength(HISTORY_LIMIT)
    store.undo()
    expect(store.canRedo()).toBe(true)
    store.updateProject((pr) => createFocus(pr, 999, 0).project)
    expect(store.canRedo()).toBe(false)
  })

  it('los cambios de Blockly no entran al historial y deshacer otra cosa no los pierde', () => {
    const [a, b] = p().focuses
    store.updateProject((pr) => updateFocus(pr, a.uid, { x: 3 }))
    const newBlocks = { blocks: { blocks: [] } }
    store.updateBlocks(b.uid, {
      blocks: newBlocks,
      scripts: { available: '', bypass: '', reward: '\tadd_stability = 0.1\n' }
    })
    expect(store.get().past).toHaveLength(1)
    store.undo()
    expect(p().focuses[0].x).toBe(0)
    expect(p().focuses[1].blocks).toBe(newBlocks)
  })

  it('la selección no entra al historial', () => {
    store.set({ selectedUid: p().focuses[1].uid })
    expect(store.canUndo()).toBe(false)
  })
})
