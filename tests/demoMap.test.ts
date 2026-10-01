import { describe, it, expect } from 'vitest'
import { generateDemoMap } from '../src/renderer/src/map/demoMap'
import { migrateProject } from '../src/renderer/src/migrate'

describe('Demo Map & Project Migration v4', () => {
  it('generates deterministic demo map data', () => {
    const map1 = generateDemoMap()
    const map2 = generateDemoMap()

    expect(map1.width).toBe(1200)
    expect(map1.height).toBe(600)
    expect(map1.isDemoMap).toBe(true)

    // Comprobar determinismo
    expect(map1.provinceIndex.length).toBe(1200 * 600)
    expect(map1.provinceIndex[0]).toBe(map2.provinceIndex[0])
    expect(map1.provinceIndex[50000]).toBe(map2.provinceIndex[50000])

    const stateKeys = Object.keys(map1.states)
    expect(stateKeys.length).toBeGreaterThanOrEqual(35)
    expect(stateKeys.length).toBeLessThanOrEqual(45)

    const provKeys = Object.keys(map1.provinces)
    expect(provKeys.length).toBe(300)

    // Adyacencia
    const firstStateId = Number(stateKeys[0])
    expect(map1.stateAdjacency[firstStateId]).toBeDefined()
    expect(Array.isArray(map1.stateAdjacency[firstStateId])).toBe(true)

    // Índices de píxeles
    expect(map1.statePixelIndices[firstStateId]).toBeDefined()
    expect(map1.statePixelIndices[firstStateId] instanceof Uint32Array).toBe(true)
    expect(map1.statePixelIndices[firstStateId].length).toBeGreaterThan(0)
  })

  it('migrates project v3 to v4 correctly', () => {
    const rawV3 = {
      version: 3,
      modName: 'Test Mod',
      tag: 'MEX',
      focusTrees: [{ id: 'arbol_1', name: 'Árbol MEX' }],
      focuses: [],
      ideas: [],
      icons: [],
      countries: [
        {
          uid: 'c1',
          mode: 'nuevo',
          tag: 'MEX',
          names: { name: 'México', def: 'México', adj: 'Mexicano' },
          ideologyNames: {},
          color: [0, 100, 0],
          graphicalCulture: 'western_european_gfx',
          graphicalCulture2d: 'western_european_2d',
          politics: {
            ruling: 'democratic',
            popularities: { democratic: 100, fascism: 0, communism: 0, neutrality: 0 },
            electionsAllowed: true,
            electionFrequency: 4,
            lastElection: '1936.1.1',
            parties: {}
          },
          capital: 1,
          flags: { main: null, byIdeology: {} },
          leaders: [],
          focusTreeId: 'arbol_1',
          existing: { renameInGame: false, historyFile: null, historyText: null, historyEdited: false }
        }
      ]
    }

    const migrated = migrateProject(rawV3)
    expect(migrated.version).toBe(4)
    expect(migrated.stateEdits).toBeDefined()
    expect(migrated.stateEdits).toEqual({})
  })
})
