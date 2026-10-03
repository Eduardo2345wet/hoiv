// Parche mínimo de estados: población, categoría, recursos, edificios y puntos de victoria (S6)
import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { patchStateText, type StateProps } from '../src/shared/map/statePatch'
import { statesFromParsed } from '../src/shared/map/stateFile'

// Fixtures propios con comentarios, bloques con fecha y construcciones por provincia
const FILE = `# Estado de prueba
state = {
\tid = 7
\tname = "STATE_7" # nombre
\tmanpower = 1000
\tstate_category = rural
\tresources = {
\t\toil = 5
\t}
\tprovinces = { 10 11 12 }
\thistory = {
\t\towner = AAA
\t\tadd_core_of = AAA
\t\tvictory_points = { 10 3 }
\t\tbuildings = {
\t\t\tinfrastructure = 2
\t\t\tindustrial_complex = 1
\t\t\t11 = {
\t\t\t\tnaval_base = 1
\t\t\t}
\t\t}
\t\t1939.1.1 = {
\t\t\tcontroller = BBB
\t\t}
\t}
}
`
const MIN = `state = {
\tid = 8
\tname = "STATE_8"
\tprovinces = { 20 21 }
\thistory = {
\t\towner = AAA
\t}
}
`
const run = (text: string, id: number, props: StateProps, owner = 'AAA'): string => {
  const r = patchStateText(text, [{ id, owner, cores: owner === 'AAA' ? ['AAA'] : [], props }])
  expect(r.errors).toEqual([])
  return r.text
}
const parse = async (t: string): Promise<ReturnType<typeof statesFromParsed>> => {
  const j = await Jomini.initialize()
  return statesFromParsed(j.parseText(t), 'x.txt')
}
const lines = (t: string): string[] => t.split('\n')

describe('parche de estados: otros datos (S6)', () => {
  it('sin props no cambia nada (byte a byte)', () => {
    const r = patchStateText(FILE, [{ id: 7, owner: 'AAA', cores: ['AAA'] }])
    expect(r.text).toBe(FILE)
  })

  it('cambia solo las líneas tocadas y deja el resto idéntico', async () => {
    const out = run(FILE, 7, {
      manpower: 5000,
      category: 'town',
      resources: { oil: 9, steel: 4 },
      buildings: { infrastructure: 4, arms_factory: 2 },
      provinceBuildings: { 11: { naval_base: 3, bunker: 1 } },
      victoryPoints: { 10: 8, 12: 2 }
    })
    const [s] = await parse(out)
    expect(s.manpower).toBe(5000)
    expect(s.category).toBe('town')
    expect(s.resources).toEqual({ oil: 9, steel: 4 })
    expect(s.buildings).toMatchObject({ infrastructure: 4, industrial_complex: 1, arms_factory: 2 })
    expect(s.provinceBuildings?.[11]).toEqual({ naval_base: 3, bunker: 1 })
    expect(s.victoryPoints.sort()).toEqual([
      [10, 8],
      [12, 2]
    ])
    // los comentarios, el bloque con fecha y el nombre siguen igual
    expect(out).toContain('# Estado de prueba')
    expect(out).toContain('name = "STATE_7" # nombre')
    expect(out).toContain('1939.1.1 = {\n\t\t\tcontroller = BBB\n\t\t}')
    // solo difieren las líneas esperadas
    const before = new Set(lines(FILE))
    const changed = lines(out).filter((l) => !before.has(l))
    expect(changed.length).toBeLessThanOrEqual(10)
  })

  it('es idempotente', () => {
    const props: StateProps = {
      manpower: 5000,
      resources: { steel: 4 },
      buildings: { arms_factory: 2 },
      provinceBuildings: { 12: { coastal_bunker: 2 } },
      victoryPoints: { 12: 2 }
    }
    const once = run(FILE, 7, props)
    expect(run(once, 7, props)).toBe(once)
    const m = run(MIN, 8, props)
    expect(run(m, 8, props)).toBe(m)
  })

  it('agrega lo que falta en un estado mínimo y se lee de nuevo', async () => {
    const out = run(MIN, 8, {
      manpower: 300,
      category: 'pastoral',
      resources: { aluminium: 2 },
      buildings: { infrastructure: 3 },
      provinceBuildings: { 20: { naval_base: 2 } },
      victoryPoints: { 21: 5 }
    })
    const [s] = await parse(out)
    expect(s).toMatchObject({ manpower: 300, category: 'pastoral', owner: 'AAA' })
    expect(s.resources).toEqual({ aluminium: 2 })
    expect(s.buildings.infrastructure).toBe(3)
    expect(s.provinceBuildings?.[20]).toEqual({ naval_base: 2 })
    expect(s.victoryPoints).toEqual([[21, 5]])
  })

  it('0 quita la línea (edificio, recurso y punto de victoria)', async () => {
    const out = run(FILE, 7, {
      resources: { oil: 0 },
      buildings: { industrial_complex: 0 },
      provinceBuildings: { 11: { naval_base: 0 } },
      victoryPoints: { 10: 0 }
    })
    const [s] = await parse(out)
    expect(s.resources).toEqual({})
    expect(s.buildings.industrial_complex).toBeUndefined()
    expect(s.provinceBuildings?.[11]).toEqual({})
    expect(s.victoryPoints).toEqual([])
  })

  it('respeta CRLF', () => {
    const crlf = FILE.replace(/\n/g, '\r\n')
    const out = run(crlf, 7, {
      manpower: 1,
      victoryPoints: { 12: 4 },
      buildings: { arms_factory: 1 }
    })
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\r')
    expect(out).toContain('manpower = 1\r\n')
  })

  it('un bloque con fecha no se toca ni se confunde con el de nivel superior', () => {
    const f = `state = {\n\tid = 9\n\tprovinces = { 1 }\n\thistory = {\n\t\towner = AAA\n\t\t1939.1.1 = {\n\t\t\tbuildings = { infrastructure = 5 }\n\t\t}\n\t}\n}\n`
    const out = run(f, 9, { buildings: { infrastructure: 1 } })
    expect(out).toContain('1939.1.1 = {\n\t\t\tbuildings = { infrastructure = 5 }')
    expect(out).toContain('buildings = { infrastructure = 1 }')
  })
})

// ---------- Modelo, solicitudes de exportación y validador ----------
import { generateDemoMap } from '../src/shared/map/demo'
import { emptyProject } from './fixtures'
import {
  setStateProps,
  propsOf,
  manpowerOf,
  victoryPointsOf
} from '../src/renderer/src/map/stateProps'
import { stateRequests } from '../src/renderer/src/export/statesExport'
import { validateStateData } from '../src/renderer/src/map/validateStateData'
import { eraseStates } from '../src/renderer/src/map/mapOps'
import { parseBuildings, parseStateCategories } from '../src/shared/gameBuildings'

describe('datos de estado en el proyecto (S6)', () => {
  const map = generateDemoMap()
  const s = map.states[0]
  const coastal = s.provinces.find((p) => map.provinceCoastal[p])
  const inland = s.provinces.find((p) => !map.provinceCoastal[p])

  it('un cambio de población genera una solicitud con props aunque no cambie el dueño', () => {
    let p = emptyProject()
    p = setStateProps(p, s.id, { manpower: 12345 })
    const r = stateRequests(p, { ...map, source: 'real' })
    expect(r).toHaveLength(1)
    expect(r[0].targets[0].props).toMatchObject({ manpower: 12345 })
    expect(r[0].targets[0].owner).toBe(s.owner)
    expect(manpowerOf(s, p)).toBe(12345)
  })

  it('un edit vacío se borra y el borrador conserva los datos del estado', () => {
    let p = emptyProject()
    p = setStateProps(p, s.id, { manpower: 5 })
    p = { ...p, stateEdits: { ...p.stateEdits, [s.id]: { ...p.stateEdits[s.id], owner: 'DMB' } } }
    p = eraseStates(p, [s.id])
    expect(p.stateEdits[s.id]).toEqual({ manpower: 5 })
    p = setStateProps(p, s.id, { manpower: undefined })
    expect(p.stateEdits[s.id]).toBeUndefined()
    expect(propsOf(p.stateEdits[s.id])).toBeUndefined()
  })

  it('puntos de victoria: lo original más lo editado (0 quita)', () => {
    let p = emptyProject()
    const prov = s.provinces[0]
    p = setStateProps(p, s.id, { victoryPoints: { [prov]: 7 } })
    expect(victoryPointsOf(s, p).find((v) => v[0] === prov)?.[1]).toBe(7)
    p = setStateProps(p, s.id, { victoryPoints: { [prov]: 0 } })
    expect(victoryPointsOf(s, p).some((v) => v[0] === prov)).toBe(false)
  })

  it('validador: cada regla', () => {
    expect(coastal).toBeDefined()
    expect(inland).toBeDefined()
    const check = (edit: object, game = null): string[] =>
      validateStateData(setStateProps(emptyProject(), s.id, edit), map, game).map((i) => i.message)
    expect(check({ manpower: 0 }).some((m) => /mayor que 0/.test(m))).toBe(true)
    expect(check({ category: 'zzz' }).some((m) => /categoría zzz/.test(m))).toBe(true)
    expect(check({ category: 'town' })).toEqual([])
    expect(
      check({ buildings: { infrastructure: 9 } }).some((m) => /pasa el máximo \(5\)/.test(m))
    ).toBe(true)
    expect(
      check({ buildings: { naval_base: 2 } }).some((m) => /edificio por provincia/.test(m))
    ).toBe(true)
    expect(
      check({ provinceBuildings: { [inland!]: { naval_base: 1 } } }).some((m) => /costera/.test(m))
    ).toBe(true)
    expect(check({ provinceBuildings: { [coastal!]: { naval_base: 1 } } })).toEqual([])
    expect(check({ provinceBuildings: { [coastal!]: { coastal_bunker: 1 } } })).toEqual([])
    expect(
      check({ victoryPoints: { 999999: 3 } }).some((m) => /no pertenece a este estado/.test(m))
    ).toBe(true)
    expect(check({ resources: { oil: -1 } }).some((m) => /negativo/.test(m))).toBe(true)
  })

  it('lee edificios y categorías del juego', () => {
    const b = parseBuildings(`buildings = {
  infrastructure = { max_level = 5 base_cost = 1 }
  naval_base = { province_based = yes max_level = 10 modifier = { max_level = 99 } }
}`)
    expect(b).toEqual([
      { id: 'infrastructure', max: 5, provincial: false },
      { id: 'naval_base', max: 10, provincial: true }
    ])
    expect(
      parseStateCategories(`state_categories = {
  rural = { local_building_slots = 2 }
  town = { local_building_slots = 5 } # c
}`)
    ).toEqual(['rural', 'town'])
  })
})

describe('exportación con datos de estado (S6)', () => {
  it('planStatePatches aplica y verifica los datos, y solo reescribe lo tocado', async () => {
    const fs = await import('fs')
    const os = await import('os')
    const path = await import('path')
    const { planStatePatches } = await import('../src/main/statesExport')
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-s6-'))
    fs.mkdirSync(path.join(game, 'history', 'states'), { recursive: true })
    fs.writeFileSync(path.join(game, 'history/states/7-Prueba.txt'), FILE.replace(/\n/g, '\r\n'))
    const jomini = await Jomini.initialize()
    const res = await planStatePatches(
      game,
      [
        {
          file: '7-Prueba.txt',
          targets: [
            {
              id: 7,
              owner: 'AAA',
              cores: ['AAA'],
              props: { manpower: 42, buildings: { arms_factory: 2 }, victoryPoints: { 12: 3 } }
            }
          ]
        }
      ],
      jomini
    )
    expect(res.errors).toEqual([])
    const out = Buffer.from(res.files[0].data).toString('latin1')
    expect(out).toContain('manpower = 42\r\n')
    expect(out).toContain('# Estado de prueba\r\n')
    expect(out).toContain('1939.1.1 = {\r\n\t\t\tcontroller = BBB\r\n\t\t}')
  })
})
