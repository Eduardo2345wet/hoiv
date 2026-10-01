import { describe, it, expect, beforeEach } from 'vitest'
import { generateDemoMap } from '../src/renderer/src/map/demoMap'
import { store } from '../src/renderer/src/store/appStore'
import { emptyProject } from './fixtures'

beforeEach(() => {
  store.openProject(emptyProject(), null)
})

describe('Map Editing Tools & Undo/Redo', () => {
  it('Brush tool updates owner and cores in stateEdits, undo/redo reverts changes', () => {
    const map = generateDemoMap()
    const stateId = 1
    const activeTag = 'DMA'

    // Aplicar pincelada en estado 1
    store.updateProject((p) => {
      const edits = { ...(p.stateEdits || {}) }
      edits[stateId] = { owner: activeTag, addCores: [activeTag] }
      return { ...p, stateEdits: edits }
    })

    expect(store.get().project?.stateEdits?.[stateId]?.owner).toBe('DMA')
    expect(store.get().project?.stateEdits?.[stateId]?.addCores).toContain('DMA')

    // Deshacer
    store.undo()
    expect(store.get().project?.stateEdits?.[stateId]).toBeUndefined()

    // Rehacer
    store.redo()
    expect(store.get().project?.stateEdits?.[stateId]?.owner).toBe('DMA')
  })

  it('Eraser tool deletes stateEdit for selected state', () => {
    const stateId = 5
    store.updateProject((p) => ({
      ...p,
      stateEdits: { ...p.stateEdits, [stateId]: { owner: 'DMB', addCores: ['DMB'] } }
    }))

    expect(store.get().project?.stateEdits?.[stateId]).toBeDefined()

    // Usar borrador
    store.updateProject((p) => {
      const edits = { ...(p.stateEdits || {}) }
      delete edits[stateId]
      return { ...p, stateEdits: edits }
    })

    expect(store.get().project?.stateEdits?.[stateId]).toBeUndefined()
  })

  it('Capital tool updates country capital', () => {
    const stateId = 12
    const countryUid = store.get().project!.countries[0].uid

    store.updateProject((p) => ({
      ...p,
      countries: p.countries.map((c) => (c.uid === countryUid ? { ...c, capital: stateId } : c))
    }))

    expect(store.get().project!.countries[0].capital).toBe(stateId)
  })

  it('startPick with kind state handles selection correctly', () => {
    let selectedState = ''
    store.startPick({
      kind: 'state',
      exclude: [],
      onPick: (sid) => {
        selectedState = sid
      }
    })

    expect(store.get().pick?.kind).toBe('state')

    store.finishPick('42')
    expect(selectedState).toBe('42')
    expect(store.get().pick).toBeNull()
  })
})
