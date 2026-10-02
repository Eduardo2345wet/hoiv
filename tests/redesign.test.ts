// Pruebas del rediseño del mapa: etiquetas, base de mod, lienzo en blanco, Sin nación,
// paleta (sin ventanas), clic derecho, teclas 1–9, país rápido y migración
import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Jomini } from 'jomini'
import { generateDemoMap } from '../src/shared/map/demo'
import { buildMapData } from '../src/shared/map/build'
import { PROVINCE_TYPE, type MapData } from '../src/shared/map/types'
import { patchStateText } from '../src/shared/map/statePatch'
import { writeBmp24 } from '../src/shared/map/bmp'
import { listGameDir, parseDescriptor, resolveGameFile, type ModLayer } from '../src/main/mods'
import { loadRealMap } from '../src/main/mapLoader'
import { planStatePatches } from '../src/main/statesExport'
import { handleExportMod } from '../src/main/export'
import { store } from '../src/renderer/src/store/appStore'
import { handleStroke, type ToolId } from '../src/renderer/src/map/tools'
import { brushForKey, NO_NATION, setBrush } from '../src/renderer/src/map/brush'
import { createQuickCountry } from '../src/renderer/src/map/quickCountry'
import {
  exportCores,
  exportOwner,
  nextPendingIndex,
  pendingStates,
  syncNoNation,
  technicalCountry
} from '../src/renderer/src/map/noNation'
import { stateRequests } from '../src/renderer/src/export/statesExport'
import { validateProject } from '../src/renderer/src/export/validator'
import { buildPalette, isPainted } from '../src/renderer/src/map/colors'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import { migrateProject } from '../src/renderer/src/migrate'
import type { MapSettings, Project } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

const demo = generateDemoMap()
const p = (): Project => store.get().project!

/** Proyecto con lienzo en blanco; `unpainted` = modo de los no pintados */
function blankProject(unpainted: MapSettings['unpainted'] = 'keep'): Project {
  let pr = emptyProject()
  pr = addCountry(pr, {
    ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
    focusTreeId: null
  })
  pr = { ...pr, mapSettings: { ...pr.mapSettings, base: 'blank', unpainted } }
  return syncNoNation(pr, null, demo)
}

const toasts: string[] = []
const ctx = {
  toast: (m: string) => void toasts.push(m),
  brush: { giveCore: true, removePreviousCores: false }
}
function click(tool: ToolId, id: number, erase = false): void {
  handleStroke(tool, 'start', id, { shift: false, erase }, ctx)
  handleStroke(tool, 'end', 0, { shift: false, erase }, ctx)
}

describe('etiquetas en el centro visual', () => {
  it('la etiqueta de cada estado del mapa de demostración cae dentro del estado', () => {
    for (const s of demo.states) {
      const [x, y, r] = demo.stateLabels[s.id]
      expect(demo.provinceToState[demo.provinceIndex[y * demo.width + x]]).toBe(s.id)
      expect(r).toBeGreaterThan(1)
    }
  })

  it('en un estado con forma de C la etiqueta cae dentro (el centroide no)', () => {
    // 40×30: provincia 1 = una C gruesa; provincia 2 = el hueco de la C; resto = mar
    const w = 40
    const h = 30
    const idx = new Uint16Array(w * h).fill(3)
    for (let y = 2; y < 28; y++)
      for (let x = 2; x < 38; x++) {
        const inC = x < 12 || y < 10 || y >= 20
        idx[y * w + x] = inC ? 1 : 2
      }
    const type = new Uint8Array([0, PROVINCE_TYPE.land, PROVINCE_TYPE.land, PROVINCE_TYPE.sea])
    const map = buildMapData({
      source: 'demo',
      width: w,
      height: h,
      provinceIndex: idx,
      provinceType: type,
      provinceCoastal: new Uint8Array(4),
      provinceColor: new Uint32Array(4),
      states: [1, 2].map((id) => ({
        id,
        nameKey: '',
        name: `S${id}`,
        file: '',
        provinces: [id],
        owner: 'A',
        cores: [],
        victoryPoints: [],
        category: '',
        hasDatedChanges: false
      })),
      unknownColorPixels: 0
    })
    const [lx, ly] = map.stateLabels[1]
    expect(map.provinceToState[map.provinceIndex[ly * w + lx]]).toBe(1)
    // El centroide de la C cae en el hueco (estado 2): por eso no sirve para la etiqueta
    const [cx, cy] = map.stateCenters[1]
    expect(map.provinceToState[map.provinceIndex[cy * w + cx]]).toBe(2)
  })
})

// ---------------- Base de un mod ----------------
function fakeGameAndMod(): { game: string; mod: ModLayer; modReplaced: ModLayer } {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-juego-'))
  const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-mod-'))
  const w = (root: string, rel: string, data: string | Uint8Array): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), data)
  }
  // Juego: 2 provincias, 2 estados
  const rgb = new Uint8Array(4 * 2 * 3)
  for (let i = 0; i < 8; i++) rgb.set(i % 4 < 2 ? [10, 0, 0] : [20, 0, 0], i * 3)
  w(game, 'map/provinces.bmp', writeBmp24(4, 2, rgb))
  w(
    game,
    'map/definition.csv',
    '0;0;0;0;land;false;unknown;0\n1;10;0;0;land;false;plains;1\n2;20;0;0;land;false;plains;1\n'
  )
  w(
    game,
    'history/states/1-A.txt',
    'state = { id = 1 provinces = { 1 } history = { owner = GER add_core_of = GER } }\n'
  )
  w(
    game,
    'history/states/2-B.txt',
    'state = { id = 2 provinces = { 2 } history = { owner = FRA } }\n'
  )
  // Mod: sustituye el estado 1 (mismo archivo) y trae un archivo nuevo
  w(modDir, 'descriptor.mod', 'name="Mod Base"\nreplace_path="common/ideas"\n')
  w(
    modDir,
    'history/states/1-A.txt',
    'state = { id = 1 provinces = { 1 } history = { owner = ITA add_core_of = ITA } }\n'
  )
  w(modDir, 'common/ideas/x.txt', 'ideas = {}')
  w(game, 'common/ideas/y.txt', 'ideas = {}')
  const d = parseDescriptor(fs.readFileSync(path.join(modDir, 'descriptor.mod'), 'utf-8'))
  const mod: ModLayer = { path: modDir, name: d.name, replacePaths: d.replacePaths }
  return { game, mod, modReplaced: { ...mod, replacePaths: ['history/states'] } }
}

describe('base "mapa de un mod"', () => {
  it('un archivo con la misma ruta sustituye al del juego y replace_path sustituye la carpeta', () => {
    const { game, mod, modReplaced } = fakeGameAndMod()
    expect(resolveGameFile(game, mod, 'history/states/1-A.txt')).toBe(
      path.join(mod.path, 'history', 'states', '1-A.txt')
    )
    expect(resolveGameFile(game, mod, 'history/states/2-B.txt')).toBe(
      path.join(game, 'history', 'states', '2-B.txt')
    )
    const states = listGameDir(game, mod, 'history/states')
    expect(states.map((f) => [f.name, f.fromMod])).toEqual([
      ['1-A.txt', true],
      ['2-B.txt', false]
    ])
    // replace_path = "common/ideas": solo quedan los del mod
    expect(listGameDir(game, mod, 'common/ideas').map((f) => f.name)).toEqual(['x.txt'])
    // replace_path = "history/states": el 2-B del juego desaparece
    expect(listGameDir(game, modReplaced, 'history/states').map((f) => f.name)).toEqual(['1-A.txt'])
    expect(resolveGameFile(game, modReplaced, 'history/states/2-B.txt')).toBeNull()
  })

  it('el mapa usa los estados del mod', async () => {
    const { game, mod } = fakeGameAndMod()
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'))
    const m = await loadRealMap(game, cache, () => {}, mod)
    expect(m.states.map((s) => [s.id, s.owner])).toEqual([
      [1, 'ITA'],
      [2, 'FRA']
    ])
  })

  it('exportar agrega dependencies y parcha a partir de los archivos del mod', async () => {
    const { game, mod } = fakeGameAndMod()
    const jomini = await Jomini.initialize()
    const res = await planStatePatches(
      game,
      [{ file: '1-A.txt', targets: [{ id: 1, owner: 'NVG', cores: ['ITA', 'NVG'] }] }],
      jomini,
      mod
    )
    expect(res.errors).toEqual([])
    const text = Buffer.from(res.files[0].data).toString('latin1')
    expect(text).toBe(
      'state = { id = 1 provinces = { 1 } history = { owner = NVG add_core_of = ITA\nadd_core_of = NVG } }\n'
    )
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-export-'))
    const r = await handleExportMod({
      exportPath: out,
      modName: 'Mi Mod',
      tag: 'NVG',
      focusTreeScript: '',
      locYaml: 'l_english:\n',
      dependencies: ['Mod Base']
    })
    expect(r.success).toBe(true)
    const desc = fs.readFileSync(path.join(out, 'mi_mod', 'descriptor.mod'), 'utf-8')
    expect(desc).toContain('dependencies={\n\t"Mod Base"\n}')
    expect(fs.readFileSync(path.join(out, 'mi_mod.mod'), 'utf-8')).toContain('"Mod Base"')
  })
})

// ---------------- Lienzo en blanco ----------------
describe('lienzo en blanco', () => {
  beforeEach(() => {
    toasts.length = 0
  })

  it('(a) conservan su dueño: exportar solo cambia los estados pintados', () => {
    store.openProject(blankProject('keep'), null)
    store.set({ map: { ...demo, source: 'real' }, activeTag: 'NVG' })
    click('brush', 3)
    click('brush', 4)
    const reqs = stateRequests(p(), store.get().map!)
    expect(reqs.flatMap((r) => r.targets.map((t) => t.id)).sort()).toEqual([3, 4])
    expect(reqs.every((r) => r.targets.every((t) => t.owner === 'NVG' && !t.stripDated))).toBe(true)
    expect(technicalCountry(p())).toBeUndefined()
  })

  it('pintar con el dueño original también cuenta como pintado', () => {
    store.openProject(blankProject('keep'), null)
    const s = demo.states[0]
    store.set({ map: demo, activeTag: s.owner })
    click('brush', s.id)
    expect(isPainted(s.id, p())).toBe(true)
    const pal = buildPalette(demo, p(), null, {
      mode: 'politico',
      activeTag: null,
      selectedId: null,
      gameColors: false,
      blankUnpainted: true,
      highlightPending: false
    })
    // El pintado tiene color; otro sin pintar es blanco
    expect([...pal.rgba.slice(0, 3)]).not.toEqual([255, 255, 255])
    expect([...pal.rgba.slice(4, 7)]).toEqual([255, 255, 255])
  })

  describe('(b) Sin nación', () => {
    it('crea el país técnico con un tag libre y neutral', () => {
      const pr = blankProject('noNation')
      const t = technicalCountry(pr)!
      expect(t).toMatchObject({ technical: true, mode: 'nuevo', focusTreeId: null })
      expect(t.tag).toMatch(/^[A-Z][A-Z0-9]{2}$/)
      expect(['NVG', 'MEX', 'DMA', 'DMB', 'DMC', 'DMD']).not.toContain(t.tag)
      expect(t.politics.popularities.neutrality).toBe(100)
      expect(t.politics.electionsAllowed).toBe(false)
      expect(t.leaders[0].name).toBe('Sin gobierno')
      expect(pr.mapSettings.noNation.tag).toBe(t.tag)
      // Al volver a "conservan su dueño" desaparece
      const back = syncNoNation(
        { ...pr, mapSettings: { ...pr.mapSettings, unpainted: 'keep' } },
        null,
        demo
      )
      expect(technicalCountry(back)).toBeUndefined()
    })

    it('todos los no pintados quedan para Sin nación y los pintados conservan mi país', () => {
      store.openProject(blankProject('noNation'), null)
      const map: MapData = { ...demo, source: 'real' }
      store.set({ map, activeTag: 'NVG' })
      click('brush', 5)
      const tech = technicalCountry(p())!.tag
      const reqs = stateRequests(p(), map)
      const targets = reqs.flatMap((r) => r.targets)
      expect(targets).toHaveLength(demo.states.length)
      for (const t of targets) {
        if (t.id === 5) {
          expect(t.owner).toBe('NVG')
          expect(t.stripDated).toBeUndefined()
        } else {
          expect(t.owner).toBe(tech)
          expect(t.stripDated).toEqual(['owner', 'controller', 'add_core_of', 'transfer_state'])
          // Sin cores del juego
          expect(t.cores).toEqual([])
        }
      }
    })

    it('se quitan los cores del juego salvo con la opción; los de mis países se respetan', () => {
      let pr = blankProject('noNation')
      const s = demo.states[10] // tiene cores de dos países del juego
      pr = { ...pr, stateEdits: { [s.id]: { addCores: ['NVG'] } } }
      expect(exportOwner(s, pr)).toBe(technicalCountry(pr)!.tag)
      expect(exportCores(s, pr)).toEqual(['NVG'])
      const keep = {
        ...pr,
        mapSettings: {
          ...pr.mapSettings,
          noNation: { ...pr.mapSettings.noNation, keepGameCores: true }
        }
      }
      expect(exportCores(s, keep)).toEqual([...new Set([...s.cores, 'NVG'])].sort())
    })

    it('en los bloques con fecha se quitan owner, controller, add_core_of y transfer_state', () => {
      const src =
        'state={\n\tid=7\n\thistory={\n\t\towner = GER\n\t\tadd_core_of = GER\n\t\t1939.1.1 = {\n\t\t\towner = POL\n\t\t\tcontroller = POL\n\t\t\tadd_core_of = POL\n\t\t\ttransfer_state = 8\n\t\t\tbuildings = { infrastructure = 3 }\n\t\t}\n\t\tif = { limit = { has_dlc = "X" } owner = ITA }\n\t}\n}\n'
      const r = patchStateText(src, [
        {
          id: 7,
          owner: 'SNN',
          cores: [],
          stripDated: ['owner', 'controller', 'add_core_of', 'transfer_state']
        }
      ])
      expect(r.errors).toEqual([])
      expect(r.text).toBe(
        'state={\n\tid=7\n\thistory={\n\t\towner = SNN\n\t\t1939.1.1 = {\n\t\t\tbuildings = { infrastructure = 3 }\n\t\t}\n\t\tif = { limit = { has_dlc = "X" } owner = ITA }\n\t}\n}\n'
      )
      // Aplicarlo de nuevo no cambia nada
      expect(
        patchStateText(r.text, [
          {
            id: 7,
            owner: 'SNN',
            cores: [],
            stripDated: ['owner', 'controller', 'add_core_of', 'transfer_state']
          }
        ]).text
      ).toBe(r.text)
    })

    it('el contador de pendientes coincide y Siguiente / Anterior los recorre todos', () => {
      store.openProject(blankProject('noNation'), null)
      store.set({ map: demo, activeTag: 'NVG' })
      expect(pendingStates(p(), demo)).toHaveLength(40)
      click('brush', 1)
      click('brush', 2)
      const pend = pendingStates(p(), demo)
      expect(pend).toHaveLength(38)
      expect(pend).not.toContain(1)
      const seen = new Set<number>()
      let i = 0
      for (let k = 0; k < pend.length; k++) {
        seen.add(pend[i])
        i = nextPendingIndex(pend.length, i, 1)
      }
      expect(seen.size).toBe(pend.length)
      expect(nextPendingIndex(pend.length, 0, -1)).toBe(pend.length - 1)
      // Validador: aviso de pendientes con "Ir" a Ver pendientes
      const aviso = validateProject(p(), null, {
        map: { ...demo, source: 'real' },
        gamePath: '/j'
      }).find((x) => x.goPending)!
      expect(aviso.severity).toBe('aviso')
      expect(aviso.message).toContain('38')
    })

    it('el validador marca el tag de Sin nación que choca con otro', () => {
      let pr = blankProject('noNation')
      pr = syncNoNation(
        {
          ...pr,
          mapSettings: { ...pr.mapSettings, noNation: { ...pr.mapSettings.noNation, tag: 'DMA' } }
        },
        null,
        demo
      )
      const errs = validateProject(pr, null, {
        map: { ...demo, source: 'real' },
        gamePath: '/j'
      }).filter((i) => i.severity === 'error')
      expect(errs.some((e) => e.message.includes('choca con otro país'))).toBe(true)
      const avisos = validateProject(pr, null, {
        map: { ...demo, source: 'real' },
        gamePath: '/j'
      }).map((i) => i.message)
      expect(avisos.some((m) => m.includes('países del juego no existirán al inicio'))).toBe(true)
    })
  })
})

// ---------------- Paleta e interacción ----------------
describe('paleta e interacción tipo Paint', () => {
  beforeEach(() => {
    store.openProject(blankProject('keep'), null)
    store.set({ map: demo, activeTag: null, recentTags: [] })
  })

  it('pintar con un país del juego no abre ventanas ni lo agrega a Países', () => {
    let asked = false
    ;(globalThis as { confirm?: () => boolean }).confirm = () => (asked = true)
    const before = p().countries.length
    setBrush('DMA')
    click('brush', 20)
    expect(asked).toBe(false)
    expect(p().countries).toHaveLength(before)
    expect(p().stateEdits[20]?.owner).toBe('DMA')
    expect(store.get().recentTags[0]).toBe('DMA')
  })

  it('clic derecho borra (a la base) y, con Sin nación, deja el estado pendiente', () => {
    setBrush('NVG')
    click('brush', 6)
    expect(p().stateEdits[6]?.owner).toBe('NVG')
    click('brush', 6, true)
    expect(p().stateEdits[6]).toBeUndefined()

    store.openProject(blankProject('noNation'), null)
    store.set({ map: demo })
    setBrush('NVG')
    click('brush', 6)
    expect(pendingStates(p(), demo)).not.toContain(6)
    click('bucket', 6, true)
    expect(pendingStates(p(), demo)).toContain(6)
    // El pincel "Sin nación" hace lo mismo que el clic derecho
    click('brush', 7)
    setBrush(NO_NATION)
    click('brush', 7)
    expect(pendingStates(p(), demo)).toContain(7)
  })

  it('las teclas 1–9 eligen pincel entre Mis países', () => {
    const pr = addCountry(p(), newCountry({ mode: 'nuevo', tag: 'AAA', name: 'A' }))
    expect(brushForKey(pr, '1')).toBe(pr.countries.filter((c) => !c.technical)[0].tag)
    expect(brushForKey(pr, '3')).toBe('AAA')
    expect(brushForKey(pr, '9')).toBeNull()
    expect(brushForKey(pr, '0')).toBeNull()
  })

  it('"País rápido" crea el país y lo deja como pincel activo', () => {
    const c = createQuickCountry('Gran Colombia', 'GRC', [200, 180, 40])
    expect(store.get().activeTag).toBe('GRC')
    const added = p().countries.find((x) => x.tag === 'GRC')!
    expect(added).toMatchObject({ mode: 'nuevo', color: [200, 180, 40], uid: c.uid })
    expect(added.flags.main).toBeNull() // bandera de relleno
    expect(added.leaders).toHaveLength(1) // líder de relleno
    expect(added.leaders[0].portrait).toBeNull()
    store.undo()
    expect(p().countries.some((x) => x.tag === 'GRC')).toBe(false)
  })

  it('la cubeta en el lienzo en blanco rellena la región blanca conectada sin preguntar', () => {
    let asked = false
    ;(globalThis as { confirm?: () => boolean }).confirm = () => (asked = true)
    setBrush('NVG')
    click('bucket', 1)
    expect(asked).toBe(false)
    expect(Object.keys(p().stateEdits).length).toBeGreaterThan(30)
    expect(toasts.pop()).toMatch(/^Pintaste \d+ estado\(s\)$/)
  })
})

describe('migración v4 → v5', () => {
  it('agrega la base del mapa y el modo Sin nación', () => {
    const v4 = { ...emptyProject(), version: 4, stateEdits: { 3: { owner: 'NVG' } } } as Record<
      string,
      unknown
    >
    delete v4.mapSettings
    const m = migrateProject(v4)
    expect(m.version).toBe(7)
    expect(m.mapSettings).toEqual({
      base: 'game',
      mod: null,
      unpainted: 'keep',
      noNation: { tag: '', name: 'Sin nación', keepGameCores: false }
    })
    const fresh = { ...emptyProject(), version: 4, stateEdits: {} } as Record<string, unknown>
    delete fresh.mapSettings
    expect(migrateProject(fresh).mapSettings.base).toBeNull()
  })
})
