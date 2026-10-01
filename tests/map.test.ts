// Pruebas del mapa: BMP, definition.csv, mapa de demostración, herramientas, parche de
// estados, exportación, validador y migración
import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Jomini } from 'jomini'
import { parseBmp24, writeBmp24 } from '../src/shared/map/bmp'
import { colorKey, parseDefinitionCsv } from '../src/shared/map/definition'
import { generateDemoMap } from '../src/shared/map/demo'
import { PROVINCE_TYPE, type MapData } from '../src/shared/map/types'
import { patchStateText } from '../src/shared/map/statePatch'
import { serializeMap, deserializeMap } from '../src/shared/map/serialize'
import { planStatePatches } from '../src/main/statesExport'
import { store } from '../src/renderer/src/store/appStore'
import { handleStroke, type ToolId } from '../src/renderer/src/map/tools'
import {
  connectedSameOwner,
  countryStates,
  effectiveCores,
  effectiveOwner
} from '../src/renderer/src/map/mapOps'
import { stateRequests } from '../src/renderer/src/export/statesExport'
import { validateProject } from '../src/renderer/src/export/validator'
import { addCountry, newCountry, updateCountry } from '../src/renderer/src/countries/countryOps'
import { migrateProject } from '../src/renderer/src/migrate'
import type { Project } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

const demo = generateDemoMap()

describe('lector de provinces.bmp', () => {
  it('24 bits, filas de abajo hacia arriba y relleno de fila', () => {
    // 3×2: cada fila ocupa 9 bytes y se rellena a 12
    const w = 3
    const h = 2
    const header = new Uint8Array(54)
    const v = new DataView(header.buffer)
    header[0] = 0x42
    header[1] = 0x4d
    v.setUint32(10, 54, true)
    v.setUint32(14, 40, true)
    v.setInt32(18, w, true)
    v.setInt32(22, h, true)
    v.setUint16(26, 1, true)
    v.setUint16(28, 24, true)
    // Fila de ABAJO primero (y=1), en BGR, con 3 bytes de relleno
    const bottom = [0, 0, 255, 0, 255, 0, 255, 0, 0, 9, 9, 9] // rojo, verde, azul
    const top = [1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9]
    const bmp = new Uint8Array([...header, ...bottom, ...top])
    const r = parseBmp24(bmp)
    expect([r.width, r.height]).toEqual([3, 2])
    // fila 0 = arriba: (3,2,1), (6,5,4), (9,8,7)
    expect([...r.rgb.slice(0, 9)]).toEqual([3, 2, 1, 6, 5, 4, 9, 8, 7])
    // fila 1 = abajo: rojo, verde, azul
    expect([...r.rgb.slice(9, 18)]).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255])
  })
  it('ida y vuelta con el escritor y altura negativa (de arriba hacia abajo)', () => {
    const rgb = new Uint8Array([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18,
      19, 21, 22, 23
    ])
    expect([...parseBmp24(writeBmp24(5, 2, rgb)).rgb]).toEqual([...rgb])
    const td = writeBmp24(1, 2, new Uint8Array([1, 1, 1, 2, 2, 2]))
    new DataView(td.buffer).setInt32(22, -2, true)
    // altura negativa: la primera fila del archivo es la de arriba
    expect([...parseBmp24(td).rgb]).toEqual([2, 2, 2, 1, 1, 1])
  })
  it('errores claros si el formato no es el esperado', () => {
    const b = writeBmp24(1, 1, new Uint8Array(3))
    new DataView(b.buffer).setUint16(28, 32, true)
    expect(() => parseBmp24(b)).toThrow(/32 bits/)
    expect(() => parseBmp24(new Uint8Array(10))).toThrow(/corto/)
  })
})

describe('definition.csv', () => {
  it('filas válidas, tipos y clave de color', () => {
    const rows = parseDefinitionCsv(
      '0;0;0;0;land;false;unknown;0\r\n1;255;0;10;land;true;plains;1\n2;0;0;128;sea;false;ocean;0\n3;10;20;30;lake;false;lakes;2\nbasura\n4;1;2;x;land;false;plains;1\n'
    )
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
    expect(rows.map((r) => r.type)).toEqual([
      PROVINCE_TYPE.land,
      PROVINCE_TYPE.sea,
      PROVINCE_TYPE.lake
    ])
    expect(rows[0]).toMatchObject({
      r: 255,
      g: 0,
      b: 10,
      coastal: true,
      terrain: 'plains',
      continent: 1
    })
    expect(colorKey(255, 0, 10)).toBe(0xff000a)
  })
})

describe('mapa de demostración', () => {
  it('determinista, con índice provincia→estado y adyacencia coherentes', () => {
    const again = generateDemoMap()
    expect(again.provinceIndex).toEqual(demo.provinceIndex)
    expect(demo.width * demo.height).toBe(1200 * 600)
    expect(demo.provinceType.length - 1).toBe(300)
    expect(demo.states).toHaveLength(40)
    expect(new Set(demo.states.map((s) => s.owner))).toEqual(new Set(['DMA', 'DMB', 'DMC', 'DMD']))
    for (const s of demo.states)
      for (const p of s.provinces) expect(demo.provinceToState[p]).toBe(s.id)
    // El mar no tiene estado
    for (let p = 1; p < demo.provinceType.length; p++)
      if (demo.provinceType[p] !== PROVINCE_TYPE.land) expect(demo.provinceToState[p]).toBe(0)
    // Adyacencia simétrica y verificada por píxeles
    for (const [a, list] of Object.entries(demo.stateAdjacency))
      for (const b of list) expect(demo.stateAdjacency[b]).toContain(Number(a))
    // Píxeles por estado: todos los del estado 1 pertenecen al estado 1
    const slot = demo.states.findIndex((s) => s.id === 1)
    for (let k = demo.statePixelOffsets[slot]; k < demo.statePixelOffsets[slot + 1]; k++)
      expect(demo.provinceToState[demo.provinceIndex[demo.statePixelIndex[k]]]).toBe(1)
  })
  it('se guarda y lee de la caché igual', () => {
    const back = deserializeMap(serializeMap(demo))!
    expect(back.provinceIndex).toEqual(demo.provinceIndex)
    expect(back.statePixelOffsets).toEqual(demo.statePixelOffsets)
    expect(back.states).toEqual(demo.states)
  })
})

// ---------------- Herramientas ----------------
const p = (): Project => store.get().project!
const say: string[] = []
const brush = { giveCore: true, removePreviousCores: false }
const ctx = { toast: (m: string) => void say.push(m), brush }
function click(tool: ToolId, stateId: number, shift = false, erase = false): void {
  handleStroke(tool, 'start', stateId, { shift, erase }, ctx)
  handleStroke(tool, 'end', 0, { shift, erase }, ctx)
}

function projectWithNVG(): Project {
  const c = {
    ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
    focusTreeId: null
  }
  return addCountry(emptyProject(), c)
}

describe('herramientas sobre el mapa de demostración', () => {
  beforeEach(() => {
    store.openProject(projectWithNVG(), null)
    store.set({ map: demo, activeTag: null })
    say.length = 0
  })

  it('sin país activo avisa y no pinta', () => {
    click('brush', 1)
    expect(say.pop()).toMatch(/Primero elige un color en la Paleta/)
    expect(p().stateEdits).toEqual({})
  })

  it('pincel: una pincelada sobre varios estados = 1 paso de deshacer', () => {
    store.set({ activeTag: 'NVG' })
    handleStroke('brush', 'start', 1, { shift: false }, ctx)
    handleStroke('brush', 'move', 2, { shift: false }, ctx)
    handleStroke('brush', 'move', 3, { shift: false }, ctx)
    handleStroke('brush', 'move', 0, { shift: false }, ctx) // mar: nada
    handleStroke('brush', 'end', 0, { shift: false }, ctx)
    expect(countryStates(p(), demo, 'NVG')).toEqual([1, 2, 3])
    const s1 = demo.states.find((s) => s.id === 1)!
    expect(effectiveCores(s1, p())).toContain('NVG') // "dar core al pintar"
    expect(store.get().past).toHaveLength(1)
    store.undo()
    expect(countryStates(p(), demo, 'NVG')).toEqual([])
    store.redo()
    expect(countryStates(p(), demo, 'NVG')).toEqual([1, 2, 3])
  })

  it('cubeta: pinta los estados conectados con el mismo dueño', () => {
    store.set({ activeTag: 'NVG' })
    const owner = demo.states.find((s) => s.id === 5)!.owner
    const expected = connectedSameOwner(p(), demo, 5)
    expect(expected.length).toBeGreaterThan(1)
    click('bucket', 5)
    expect(countryStates(p(), demo, 'NVG')).toEqual(expected)
    // Todos los conectados eran del mismo dueño y ninguno de otro país
    for (const id of expected) expect(demo.states.find((s) => s.id === id)!.owner).toBe(owner)
    expect(store.get().past).toHaveLength(1)
  })

  it('capital: solo en un estado del país activo', () => {
    store.set({ activeTag: 'NVG' })
    click('capital', 7)
    expect(say.pop()).toMatch(/no es de tu país/)
    expect(p().countries.find((c) => c.tag === 'NVG')!.capital).toBeNull()
    click('brush', 7)
    click('capital', 7)
    expect(p().countries.find((c) => c.tag === 'NVG')!.capital).toBe(7)
    store.undo()
    expect(p().countries.find((c) => c.tag === 'NVG')!.capital).toBeNull()
  })

  it('cores: agregar y quitar (Shift); borrador vuelve al original', () => {
    store.set({ activeTag: 'NVG' })
    const s = demo.states.find((x) => x.id === 9)!
    click('core', 9)
    expect(effectiveCores(s, p())).toContain('NVG')
    expect(effectiveOwner(s, p())).toBe(s.owner)
    click('core', 9, true)
    expect(effectiveCores(s, p())).not.toContain('NVG')
    expect(p().stateEdits[9]).toBeUndefined() // igual al original = sin cambio guardado
    click('brush', 9)
    expect(p().stateEdits[9]).toEqual({ owner: 'NVG', addCores: ['NVG'] })
    click('eraser', 9)
    expect(p().stateEdits[9]).toBeUndefined()
    store.undo()
    expect(p().stateEdits[9]).toEqual({ owner: 'NVG', addCores: ['NVG'] })
  })

  it('cuentagotas: toma el dueño sin preguntar nada (solo un aviso)', () => {
    const owner = demo.states.find((x) => x.id === 3)!.owner
    click('eyedropper', 3)
    expect(store.get().activeTag).toBe(owner)
    expect(say.pop()).toMatch(new RegExp(`^Pincel: .*\\(${owner}\\)$`))
    // No se agrega a la pestaña Países
    expect(p().countries.some((c) => c.tag === owner)).toBe(false)
  })

  it('quitar cores del dueño anterior (opción del pincel)', () => {
    store.set({ activeTag: 'NVG' })
    const s = demo.states.find((x) => x.id === 12)!
    handleStroke(
      'brush',
      'start',
      12,
      { shift: false },
      { say: () => {}, brush: { giveCore: false, removePreviousCores: true } }
    )
    handleStroke('brush', 'end', 0, { shift: false }, { say: () => {}, brush })
    expect(effectiveCores(s, p())).not.toContain(s.owner)
    expect(effectiveCores(s, p())).not.toContain('NVG')
  })
})

// ---------------- Parche de estados ----------------
const SAMPLE =
  '# Estado de ejemplo - Mühlviertel\r\n' +
  'state={\r\n' +
  '\tid=64\r\n' +
  '\tname="STATE_64" # comentario con { llaves } y owner = XXX\r\n' +
  '\r\n' +
  '\thistory={\r\n' +
  '\t\towner = GER\r\n' +
  '\t\tvictory_points = {\r\n\t\t\t3838 1 \r\n\t\t}\r\n' +
  '\t\tbuildings = {\r\n\t\t\tinfrastructure = 2\r\n\t\t}\r\n' +
  '\t\tadd_core_of = GER\r\n' +
  '\t\tadd_core_of = AUS\r\n' +
  '\t\tif = {\r\n\t\t\tlimit = { has_dlc = "La Resistance" }\r\n\t\t\tadd_core_of = ITA\r\n\t\t}\r\n' +
  '\t\t1939.1.1 = {\r\n\t\t\towner = FRA\r\n\t\t\tadd_core_of = FRA\r\n\t\t}\r\n' +
  '\t}\r\n' +
  '\tprovinces={\r\n\t\t3838 \r\n\t}\r\n' +
  '\tmanpower=100\r\n' +
  '\tstate_category = town\r\n' +
  '}\r\n'

describe('parche de estados', () => {
  it('cambia solo owner y cores del bloque de nivel superior; el resto idéntico byte a byte', () => {
    const latin1 = Buffer.from(SAMPLE, 'latin1').toString('latin1')
    const r = patchStateText(latin1, [{ id: 64, owner: 'NVG', cores: ['GER', 'NVG'] }])
    expect(r.errors).toEqual([])
    const expected = SAMPLE.replace('\t\towner = GER\r\n', '\t\towner = NVG\r\n')
      .replace('\t\tadd_core_of = AUS\r\n', '')
      .replace('\t\tadd_core_of = GER\r\n', '\t\tadd_core_of = GER\r\n\t\tadd_core_of = NVG\r\n')
    expect(r.text).toBe(expected)
    // Bloque con fecha, if/limit y comentario intactos
    expect(r.text).toContain(
      '\t\t1939.1.1 = {\r\n\t\t\towner = FRA\r\n\t\t\tadd_core_of = FRA\r\n\t\t}'
    )
    expect(r.text).toContain('add_core_of = ITA')
    expect(r.text).toContain('owner = XXX')
    // Aplicarlo dos veces da lo mismo
    expect(patchStateText(r.text, [{ id: 64, owner: 'NVG', cores: ['GER', 'NVG'] }]).text).toBe(
      r.text
    )
    // Sin cambios pedidos = archivo idéntico
    expect(patchStateText(SAMPLE, [{ id: 64, owner: 'GER', cores: ['AUS', 'GER'] }]).text).toBe(
      SAMPLE
    )
  })

  it('agrega owner si no existe y edita solo el estado pedido en archivos con varios', () => {
    const two =
      'state = {\n\tid = 1\n\thistory = {\n\t\tadd_core_of = A\n\t}\n}\nstate = {\n\tid = 2\n\thistory = {\n\t\towner = B\n\t}\n}\n'
    const r = patchStateText(two, [{ id: 1, owner: 'NVG', cores: ['A'] }])
    expect(r.text).toBe(
      two.replace(
        '\thistory = {\n\t\tadd_core_of = A',
        '\thistory = {\n\t\towner = NVG\n\t\tadd_core_of = A'
      )
    )
  })

  it('si no puede ubicar el bloque con seguridad, da error y no cambia nada', () => {
    expect(
      patchStateText('state = { id = 1 }', [{ id: 1, owner: 'X', cores: [] }]).errors
    ).toHaveLength(1)
    expect(
      patchStateText('state = { id = 1 history = { owner = A owner = B } }', [
        { id: 1, owner: 'X', cores: [] }
      ]).errors
    ).toHaveLength(1)
    expect(
      patchStateText('state = { id = 1 history = { owner = A }', [{ id: 1, owner: 'X', cores: [] }])
        .errors
    ).toHaveLength(1)
    expect(
      patchStateText('state = { id = 2 history = { owner = A } }', [
        { id: 1, owner: 'X', cores: [] }
      ]).errors[0].message
    ).toMatch(/No se encontró/)
  })
})

describe('exportación de estados', () => {
  it('solo los archivos modificados, con el mismo nombre, en history/states/', async () => {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-states-'))
    fs.mkdirSync(path.join(game, 'history', 'states'), { recursive: true })
    fs.writeFileSync(
      path.join(game, 'history/states/64-Oberdonau.txt'),
      Buffer.from(SAMPLE, 'latin1')
    )
    fs.writeFileSync(
      path.join(game, 'history/states/65-Otro.txt'),
      'state = { id = 65 history = { owner = GER } }'
    )
    const map: MapData = {
      ...demo,
      source: 'real',
      states: [
        {
          ...demo.states[0],
          id: 64,
          file: '64-Oberdonau.txt',
          owner: 'GER',
          cores: ['AUS', 'GER']
        },
        { ...demo.states[1], id: 65, file: '65-Otro.txt', owner: 'GER', cores: [] }
      ]
    }
    let proj: Project = {
      ...projectWithNVG(),
      stateEdits: { 64: { owner: 'NVG', addCores: ['NVG'], removeCores: ['AUS'] } }
    }
    const reqs = stateRequests(proj, map)
    expect(reqs).toEqual([
      { file: '64-Oberdonau.txt', targets: [{ id: 64, owner: 'NVG', cores: ['GER', 'NVG'] }] }
    ])
    const jomini = await Jomini.initialize()
    const res = await planStatePatches(game, reqs, jomini)
    expect(res.errors.map((e) => e.message)).toEqual([])
    expect(res.files.map((f) => f.path)).toEqual(['history/states/64-Oberdonau.txt'])
    const text = Buffer.from(res.files[0].data).toString('latin1')
    expect(text).toContain('Mühlviertel') // bytes no ASCII intactos
    expect(text).toContain('owner = NVG\r\n')
    // Un cambio que vuelve al original no se exporta
    proj = { ...proj, stateEdits: { 65: { owner: 'GER' } } }
    expect(stateRequests(proj, map)).toEqual([])
  })
})

// ---------------- Validador ----------------
describe('validador del mapa', () => {
  const msgs = (proj: Project, ctx: Parameters<typeof validateProject>[2]) =>
    validateProject(proj, null, ctx).map((i) => `${i.severity}: ${i.message}`)
  const realMap: MapData = { ...demo, source: 'real' }

  it('errores', () => {
    let proj = projectWithNVG()
    proj = { ...proj, stateEdits: { 1: { owner: 'NVG' } } }
    // Cambios en el mapa de demostración / sin carpeta del juego
    expect(
      msgs(proj, { map: demo, gamePath: '/juego' }).some(
        (m) => m.startsWith('error') && m.includes('MAPA DE DEMOSTRACIÓN')
      )
    ).toBe(true)
    expect(
      msgs(proj, { map: realMap, gamePath: null }).some(
        (m) => m.startsWith('error') && m.includes('no hay carpeta del juego')
      )
    ).toBe(true)
    // Parche imposible
    expect(
      msgs(proj, {
        map: realMap,
        gamePath: '/juego',
        patchErrors: [{ file: 'x.txt', id: 1, message: 'roto' }]
      }).some((m) => m.startsWith('error') && m.includes('history/states/x.txt'))
    ).toBe(true)
    // Estado modificado sin dueño
    const noOwner: MapData = {
      ...realMap,
      states: realMap.states.map((s) => (s.id === 2 ? { ...s, owner: '' } : s))
    }
    expect(
      msgs(
        { ...proj, stateEdits: { 2: { addCores: ['NVG'] } } },
        { map: noOwner, gamePath: '/j' }
      ).some((m) => m.includes('quedó sin dueño'))
    ).toBe(true)
    // Capital de un país del mod en un estado que no es suyo
    const nvg = proj.countries.find((c) => c.tag === 'NVG')!
    const bad = updateCountry(proj, nvg.uid, { capital: 5 })
    expect(
      msgs(bad, { map: realMap, gamePath: '/j' }).some(
        (m) => m.startsWith('error') && m.includes('no suya')
      )
    ).toBe(true)
  })

  it('avisos', () => {
    let proj = projectWithNVG()
    // País nuevo sin estados
    expect(
      msgs(proj, { map: realMap, gamePath: '/j' }).some(
        (m) => m.startsWith('aviso') && m.includes('no aparecerá en la partida')
      )
    ).toBe(true)
    // País del juego que se queda sin estados
    const dmaStates = realMap.states.filter((s) => s.owner === 'DMA').map((s) => s.id)
    const edits = Object.fromEntries(dmaStates.map((id) => [id, { owner: 'NVG' }]))
    expect(
      msgs({ ...proj, stateEdits: edits }, { map: realMap, gamePath: '/j' }).some((m) =>
        m.includes('DMA se queda sin estados')
      )
    ).toBe(true)
    // A un país del juego le quité su capital
    const mex = proj.countries.find((c) => c.tag === 'MEX')!
    const dmb = realMap.states.find((s) => s.owner === 'DMB')!
    proj = updateCountry(proj, mex.uid, { tag: 'DMB', capital: dmb.id })
    const issues = validateProject({ ...proj, stateEdits: { [dmb.id]: { owner: 'NVG' } } }, null, {
      map: realMap,
      gamePath: '/j'
    })
    const cap = issues.find((i) => i.message.includes('le quitaste el estado de su capital'))!
    expect(cap.severity).toBe('aviso')
    expect(cap.stateId).toBe(dmb.id)
    // Cambios con fecha
    const dated = realMap.states.find((s) => s.hasDatedChanges)!
    expect(
      msgs(
        { ...proj, stateEdits: { [dated.id]: { owner: 'NVG' } } },
        { map: realMap, gamePath: '/j' }
      ).some((m) => m.includes('cambios con fecha'))
    ).toBe(true)
    // Capital sin victory points
    const noVp: MapData = {
      ...realMap,
      states: realMap.states.map((s) => (s.id === dmb.id ? { ...s, victoryPoints: [] } : s))
    }
    expect(
      msgs(proj, { map: noVp, gamePath: '/j' }).some((m) => m.includes('no tiene victory points'))
    ).toBe(true)
    // Colores desconocidos
    expect(
      msgs(proj, { map: { ...realMap, unknownColorPixels: 12 }, gamePath: '/j' }).some((m) =>
        m.includes('12 píxel')
      )
    ).toBe(true)
  })
})

describe('migración v3 → v4', () => {
  it('agrega stateEdits vacío sin romper nada', () => {
    const v3 = { ...emptyProject(), version: 3 } as Record<string, unknown>
    delete v3.stateEdits
    const m = migrateProject(v3)
    expect(m.version).toBe(6)
    expect(m.stateEdits).toEqual({})
    expect(m.countries).toHaveLength(1)
  })
})
