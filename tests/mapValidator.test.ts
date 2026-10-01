import { describe, it, expect } from 'vitest'
import { validateProject } from '../src/renderer/src/export/validator'
import { generateDemoMap } from '../src/renderer/src/map/demoMap'
import { emptyProject } from './fixtures'

describe('Map Validator Rules', () => {
  const mapData = generateDemoMap()

  it('detects ERROR when map edits are present on demo map or without game folder', () => {
    let p = emptyProject()
    p = {
      ...p,
      stateEdits: {
        1: { owner: 'MEX' }
      }
    }

    const issues = validateProject(p, null, mapData)
    const err = issues.find((i) => i.message.includes('demostración') || i.message.includes('carpeta del juego'))
    expect(err).toBeDefined()
    expect(err?.severity).toBe('error')
  })

  it('detects ERROR when a modified state is left without owner', () => {
    let p = emptyProject()
    p = {
      ...p,
      stateEdits: {
        1: { owner: '' }
      }
    }

    const realMapData = { ...mapData, isDemoMap: false }
    const issues = validateProject(p, null, realMapData)
    const err = issues.find((i) => i.message.includes('no tiene dueño'))
    expect(err).toBeDefined()
    expect(err?.severity).toBe('error')
    expect(err?.stateId).toBe(1)
  })

  it('detects ERROR when country capital is in a state not owned by the country', () => {
    let p = emptyProject()
    // Capital set to state 10, but state 10 is not owned by MEX
    p.countries[0].capital = 10
    p = {
      ...p,
      stateEdits: {
        10: { owner: 'USA' }
      }
    }

    const realMapData = { ...mapData, isDemoMap: false }
    const issues = validateProject(p, null, realMapData)
    const err = issues.find((i) => i.message.includes('no le pertenece'))
    expect(err).toBeDefined()
    expect(err?.severity).toBe('error')
  })

  it('detects AVISO when country is left without states or capital lacks victory points', () => {
    let p = emptyProject()
    // Capital in state 1 without victory points
    const realMapData = {
      ...mapData,
      isDemoMap: false,
      states: {
        ...mapData.states,
        1: { ...mapData.states[1], victoryPoints: [] }
      }
    }
    p.countries[0].capital = 1

    const issues = validateProject(p, null, realMapData)
    const warnVp = issues.find((i) => i.message.includes('puntos de victoria'))
    expect(warnVp).toBeDefined()
    expect(warnVp?.severity).toBe('aviso')
  })
})
