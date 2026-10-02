// Interfaz tipo NX: pestañas de proyectos, plantillas, plantilla fija, migración
import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { store } from '../src/renderer/src/store/appStore'
import { generateDemoMap } from '../src/shared/map/demo'
import {
  emptyProjectFor,
  mapSettingsFor,
  templateOf,
  TEMPLATES
} from '../src/renderer/src/templates'
import { resetMapProject, paintedCount } from '../src/renderer/src/map/resetMap'
import { effectiveOwner } from '../src/renderer/src/map/mapOps'
import { migrateProject } from '../src/renderer/src/migrate'
import { openContent } from '../src/renderer/src/ui/fileOps'
import { resetMapWithTemplate } from '../src/renderer/src/map/resetMap'
import { createProjectFolder } from '../src/main/projectFiles'
import { handleStroke } from '../src/renderer/src/map/tools'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import { syncNoNation } from '../src/renderer/src/map/noNation'
import type { Project, TemplateId } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

const demo = generateDemoMap()
const ctx = { toast: () => {}, brush: { giveCore: false, removePreviousCores: false } }
const paint = (id: number): void => {
  handleStroke('brush', 'start', id, { shift: false, erase: false }, ctx)
  handleStroke('brush', 'end', 0, { shift: false, erase: false }, ctx)
}

function withCountry(p: Project): Project {
  return syncNoNation(
    addCountry(p, {
      ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
      focusTreeId: null
    }),
    null,
    demo
  )
}

function reset(): void {
  for (const t of [...store.get().tabs]) store.closeTab(t.id)
  store.set({ map: demo, mapKey: 'demo', activeTag: null })
}

describe('pestañas de proyectos (parte 2)', () => {
  beforeEach(reset)

  it('cada pestaña tiene su proyecto, historial, selección y herramienta', () => {
    const a = withCountry(emptyProjectFor('A', 'blank'))
    const b = withCountry(emptyProjectFor('B', 'blank'))
    const ta = store.openInNewTab(a, null, 'mapa')
    store.set({ activeTag: 'NVG' })
    paint(3)
    paint(4)
    store.setUi({ tool: 'bucket' })
    expect(Object.keys(store.get().project!.stateEdits)).toEqual(['3', '4'])
    expect(store.get().past.length).toBe(2)

    const tb = store.openInNewTab(b, null, 'mapa')
    // B está limpia: sin pintar, sin historial, con su propia herramienta y sin país activo
    expect(store.get().project!.modName).toBe('B')
    expect(store.get().project!.stateEdits).toEqual({})
    expect(store.get().past.length).toBe(0)
    expect(store.get().activeTag).toBeNull()
    expect(store.get().ui.tool).toBe('select')
    // Deshacer en B no toca a A; pintar en B no cambia A
    store.undo()
    store.set({ activeTag: 'NVG' })
    paint(9)
    store.switchTab(ta)
    expect(Object.keys(store.get().project!.stateEdits)).toEqual(['3', '4'])
    expect(store.get().past.length).toBe(2)
    expect(store.get().ui.tool).toBe('bucket')
    store.undo() // deshace en A
    expect(Object.keys(store.get().project!.stateEdits)).toEqual(['3'])
    store.switchTab(tb)
    expect(Object.keys(store.get().project!.stateEdits)).toEqual(['9'])
  })

  it('"sin guardar" es por pestaña y listTabs lo muestra', () => {
    const a = store.openInNewTab(withCountry(emptyProjectFor('A', 'blank')), null)
    store.set({ activeTag: 'NVG' })
    paint(2)
    const b = store.openInNewTab(withCountry(emptyProjectFor('B', 'game')), null)
    const tabs = store.listTabs()
    expect(tabs.find((t) => t.id === a)!.dirty).toBe(true)
    expect(tabs.find((t) => t.id === b)!.dirty).toBe(false)
    expect(tabs.find((t) => t.id === b)!.active).toBe(true)
  })

  it('cerrar la activa pasa a la vecina y cerrar la última deja el área vacía', () => {
    const a = store.openInNewTab(emptyProjectFor('A', 'blank'), null)
    const b = store.openInNewTab(emptyProjectFor('B', 'blank'), null)
    store.closeTab(b)
    expect(store.get().activeTabId).toBe(a)
    expect(store.get().project!.modName).toBe('A')
    store.closeTab(a)
    expect(store.get().activeTabId).toBeNull()
    expect(store.get().project).toBeNull()
  })

  it('Ctrl+Tab recorre las pestañas dando la vuelta', () => {
    const a = store.openInNewTab(emptyProjectFor('A', 'blank'), null)
    store.openInNewTab(emptyProjectFor('B', 'blank'), null)
    const c = store.openInNewTab(emptyProjectFor('C', 'blank'), null)
    expect(store.get().activeTabId).toBe(c)
    store.cycleTab(1)
    expect(store.get().activeTabId).toBe(a)
    store.cycleTab(-1)
    expect(store.get().activeTabId).toBe(c)
  })

  it('el mismo archivo no se abre dos veces: se activa su pestaña', () => {
    const a = store.openInNewTab(emptyProjectFor('A', 'blank'), '/x/a/proyecto.json')
    store.openInNewTab(emptyProjectFor('B', 'blank'), '/x/b/proyecto.json')
    expect(store.openInNewTab(emptyProjectFor('A', 'blank'), '/x/a/proyecto.json')).toBe(a)
    expect(store.get().tabs.length).toBe(2)
    expect(store.get().activeTabId).toBe(a)
  })

  it('el MapData se comparte: dos pestañas con la misma plantilla cargan UNA vez', async () => {
    let calls = 0
    const fake = generateDemoMap(7, 300, 150)
    ;(globalThis as { window?: unknown }).window = {
      electronAPI: {
        loadMap: async () => {
          calls++
          return { ok: true, map: fake }
        },
        onMapProgress: () => () => {}
      }
    }
    store.clearMapCache()
    store.set({ gamePath: '/juego', map: null, mapKey: null })
    store.openInNewTab(emptyProjectFor('A', 'game'), null)
    await store.ensureMap()
    expect(store.get().map).toBe(fake)
    store.openInNewTab(emptyProjectFor('B', 'game'), null)
    await store.ensureMap()
    store.cycleTab(1)
    await store.ensureMap()
    expect(calls).toBe(1)
    expect(store.get().map).toBe(fake)
    // Otra plantilla de mapa (lienzo en blanco) usa el mismo mapa del juego: tampoco recarga
    store.openInNewTab(emptyProjectFor('C', 'blank'), null)
    await store.ensureMap()
    expect(calls).toBe(1)
    delete (globalThis as { window?: unknown }).window
    store.set({ gamePath: null })
    store.clearMapCache()
  })
})

describe('plantillas y nuevo proyecto (partes 3 y 4)', () => {
  beforeEach(reset)

  it('cada plantilla crea un proyecto sin países, sin tag y con su base', () => {
    const expected: Record<TemplateId, [string | null, string]> = {
      blank: ['blank', 'keep'],
      blankNoNation: ['blank', 'noNation'],
      game: ['game', 'keep'],
      mod: ['mod', 'keep'],
      content: ['game', 'keep']
    }
    for (const t of TEMPLATES) {
      const p = emptyProjectFor(
        'Nuevo',
        t.id,
        t.id === 'mod' ? { path: '/m', name: 'Otro', replacePaths: [] } : null
      )
      expect(p.tag).toBe('')
      expect(p.countries).toEqual([])
      expect(p.focusTrees).toEqual([])
      expect([p.mapSettings.base, p.mapSettings.unpainted]).toEqual(expected[t.id])
      expect(templateOf(p)).toBe(t.id)
      const id = store.openInNewTab(p, null, t.opensIn)
      expect(store.get().ui.ribbon).toBe(t.opensIn)
      expect(store.get().activeTabId).toBe(id)
    }
    expect(store.get().tabs.length).toBe(TEMPLATES.length)
  })

  it('crea la carpeta y el proyecto.json (y no pisa una carpeta con cosas)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-proy-'))
    const p = emptyProjectFor('Mi mod prueba', 'game')
    const r = createProjectFolder(dir, 'Mi mod prueba', JSON.stringify(p))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(path.basename(r.folder)).toBe('Mi mod prueba')
    expect(JSON.parse(fs.readFileSync(r.path, 'utf-8')).template).toBe('game')
    const again = createProjectFolder(dir, 'Mi mod prueba', '{}')
    expect(again.ok).toBe(false)
    expect(createProjectFolder(dir, '  ', '{}').ok).toBe(false)
    expect(createProjectFolder(dir, 'Mi mod: prueba?', '{}').ok).toBe(false)
  })

  it('"Nuevo proyecto con otra plantilla" abre una pestaña NUEVA y limpia (nunca copia lo pintado)', () => {
    const a = store.openInNewTab(withCountry(emptyProjectFor('Mundo', 'blank')), null, 'mapa')
    store.set({ activeTag: 'NVG' })
    paint(5)
    paint(6)
    expect(paintedCount(store.get().project!)).toBe(2)
    // Lo que hace la cinta: diálogo con el nombre "<nombre> (2)" y proyecto vacío de otra plantilla
    const suggested = `${store.get().project!.modName} (2)`
    expect(suggested).toBe('Mundo (2)')
    const b = store.openInNewTab(emptyProjectFor(suggested, 'game'), null, 'mapa')
    expect(b).not.toBe(a)
    expect(store.get().tabs.length).toBe(2)
    expect(store.get().project!.stateEdits).toEqual({})
    expect(templateOf(store.get().project!)).toBe('game')
    // El proyecto de origen sigue igual
    store.switchTab(a)
    expect(paintedCount(store.get().project!)).toBe(2)
    expect(templateOf(store.get().project!)).toBe('blank')
  })

  it('BUG VIEJO: al cambiar de plantilla lo pintado se quedaba; ahora siempre queda limpio', () => {
    // Antes: el diálogo "Base del mapa" solo cambiaba mapSettings y dejaba stateEdits
    // (su texto decía "tus estados pintados se conservan"). Eso mezclaba el trabajo hecho sobre un
    // lienzo en blanco con el mapa del juego, y los cambios se exportaban sin querer.
    store.openInNewTab(withCountry(emptyProjectFor('Mundo', 'blank')), null, 'mapa')
    store.set({ activeTag: 'NVG' })
    paint(5)
    paint(6)
    const painted = store.get().project!
    expect(
      effectiveOwner(
        demo.states.find((s) => s.id === 5)!,
        painted
      )
    ).toBe('NVG')
    const before = painted.mapSettings
    // Comportamiento anterior (reproducido): solo cambiar la base conservaba los estados
    const legacy: Project = { ...painted, mapSettings: { ...before, ...mapSettingsFor('game') } }
    expect(paintedCount(legacy)).toBe(2)
    // Ahora: reiniciar con otra plantilla deja el mapa vacío y todos vuelven a su dueño original
    const fresh = resetMapProject(painted, 'game', null, null, demo)
    expect(fresh.stateEdits).toEqual({})
    expect(templateOf(fresh)).toBe('game')
    for (const id of [5, 6]) {
      const s = demo.states.find((x) => x.id === id)!
      expect(effectiveOwner(s, fresh)).toBe(s.owner)
    }
  })

  it('"Reiniciar el mapa" borra lo pintado y se puede deshacer', () => {
    store.openInNewTab(withCountry(emptyProjectFor('Mundo', 'blank')), null, 'mapa')
    store.set({ activeTag: 'NVG' })
    paint(5)
    paint(6)
    const n = paintedCount(store.get().project!)
    store.updateProject((p) => resetMapProject(p, 'blankNoNation', null, null, demo))
    expect(store.get().project!.stateEdits).toEqual({})
    expect(templateOf(store.get().project!)).toBe('blankNoNation')
    expect(store.get().project!.countries.some((c) => c.technical)).toBe(true)
    store.undo()
    expect(paintedCount(store.get().project!)).toBe(n)
    expect(templateOf(store.get().project!)).toBe('blank')
    expect(store.get().project!.countries.some((c) => c.technical)).toBe(false)
  })
})

describe('migración a la versión 6 (partes 2 y 4)', () => {
  const old = (over: Record<string, unknown>): Record<string, unknown> => ({
    ...(emptyProject() as unknown as Record<string, unknown>),
    version: 5,
    ...over
  })
  const ms = (base: string | null, unpainted = 'keep', mod: unknown = null): unknown => ({
    base,
    mod,
    unpainted,
    noNation: { tag: '', name: 'Sin nación', keepGameCores: false }
  })

  it('el proyecto viejo toma como plantilla su base y conserva lo pintado', () => {
    const edits = { 3: { owner: 'MEX' }, 4: { owner: 'MEX', addCores: ['MEX'] } }
    const a = migrateProject(old({ mapSettings: ms('blank', 'noNation'), stateEdits: edits }))
    expect(a.template).toBe('blankNoNation')
    expect(a.stateEdits).toEqual(edits)
    expect(migrateProject(old({ mapSettings: ms('blank') })).template).toBe('blank')
    expect(migrateProject(old({ mapSettings: ms('game'), stateEdits: edits })).template).toBe(
      'game'
    )
    expect(migrateProject(old({ mapSettings: ms('game'), stateEdits: edits })).stateEdits).toEqual(
      edits
    )
    const mod = { path: '/m', name: 'Otro', replacePaths: [] }
    const m = migrateProject(old({ mapSettings: ms('mod', 'keep', mod) }))
    expect(m.template).toBe('mod')
    expect(m.mapSettings.mod).toEqual(mod)
    expect(migrateProject(old({ mapSettings: ms(null) })).template).toBe('content')
  })

  it('un proyecto de la versión 1 abre y una plantilla ya guardada se respeta', () => {
    const p = migrateProject({ version: 1, tag: 'MEX', modName: 'Viejo', focuses: [] })
    expect(p.version).toBe(8)
    expect(p.template).toBeDefined()
    expect(migrateProject(old({ template: 'blank', mapSettings: ms('game') })).template).toBe(
      'blank'
    )
  })
})

describe('abrir proyectos y reiniciar con confirmación (partes 2 y 4)', () => {
  beforeEach(reset)

  it('un proyecto viejo (v5) abre en una pestaña con su plantilla y sin perder lo pintado', () => {
    const edits = { 3: { owner: 'MEX' }, 4: { owner: 'MEX' } }
    const v5 = {
      ...(emptyProject() as unknown as Record<string, unknown>),
      version: 5,
      stateEdits: edits,
      mapSettings: {
        base: 'blank',
        mod: null,
        unpainted: 'keep',
        noNation: { tag: '', name: 'Sin nación', keepGameCores: false }
      }
    }
    delete (v5 as Record<string, unknown>).template
    expect(openContent('/viejo/proyecto.json', JSON.stringify(v5))).toBe(true)
    expect(store.get().tabs.length).toBe(1)
    expect(store.get().project!.template).toBe('blank')
    expect(store.get().project!.stateEdits).toEqual(edits)
    expect(store.get().filePath).toBe('/viejo/proyecto.json')
    expect(store.get().dirty).toBe(false)
    // Un archivo que no es un proyecto no abre nada
    expect(openContent('/x.json', '{"hola":1}')).toBe(false)
    expect(store.get().tabs.length).toBe(1)
  })

  it('Reiniciar el mapa pide confirmación; cancelar no cambia nada y aceptar se puede deshacer', async () => {
    store.openInNewTab(withCountry(emptyProjectFor('Mundo', 'blank')), null, 'mapa')
    store.set({ activeTag: 'NVG' })
    paint(5)
    paint(6)
    const asked = resetMapWithTemplate('game', null)
    expect(store.get().ask?.message).toMatch(/Se borrarán 2 estados pintados en este proyecto/)
    store.answerAsk('cancel')
    expect(await asked).toBe(false)
    expect(paintedCount(store.get().project!)).toBe(2)
    expect(store.get().project!.template).toBe('blank')

    const again = resetMapWithTemplate('game', null)
    store.answerAsk('ok')
    expect(await again).toBe(true)
    expect(store.get().project!.stateEdits).toEqual({})
    expect(store.get().project!.template).toBe('game')
    store.undo()
    expect(paintedCount(store.get().project!)).toBe(2)
    expect(store.get().project!.template).toBe('blank')
  })
})
