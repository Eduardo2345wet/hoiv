// Base común de las secciones nuevas: modelo, exportador seguro, serializador, localización, bloques
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { areaRootType, generateArea, registerAreaBlocks } from '../src/renderer/src/blocks/area'
import { FOCUS_ROOT } from '../src/renderer/src/blocks/slots'
import { generateSlots } from '../src/renderer/src/generator/pdx'
import { block, file, kv, list, quote, raw, str } from '../src/renderer/src/export/clausewitz'
import { localisationFiles, LANGUAGES } from '../src/renderer/src/export/localisation'
import { pathProblems, PathRegistry } from '../src/renderer/src/export/registry'
import { registerSectionGenerator, sectionFiles } from '../src/renderer/src/sections/generators'
import { migrateProject } from '../src/renderer/src/migrate'
import { SECTION_KEYS } from '../src/renderer/src/sections/types'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { validateProject } from '../src/renderer/src/export/validator'
import { handleExportMod } from '../src/main/export'
import { store } from '../src/renderer/src/store/appStore'
import { emptyProject } from './fixtures'

registerAllBlocks()
registerAreaBlocks()
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-base-'))

describe('modelo dentro de Project', () => {
  it('un proyecto viejo migra con todas las colecciones vacías (y el inglés como idioma base)', () => {
    const old = { ...emptyProject(), version: 8 } as Record<string, unknown>
    for (const k of SECTION_KEYS) delete old[k]
    const m = migrateProject(old) as unknown as Record<string, unknown[]>
    for (const k of SECTION_KEYS) expect(Array.isArray(m[k]), k).toBe(true)
    for (const k of SECTION_KEYS) if (k !== 'languages') expect(m[k]).toEqual([])
    expect(m.languages).toEqual([{ code: 'english' }])
  })
  it('guardar y abrir conserva las colecciones, y deshacer funciona', () => {
    const p = { ...emptyProjectFor('Prueba', 'content') }
    store.openProject(p, null)
    store.updateProject((q) => ({
      ...q,
      music: [{ uid: 'm1', name: 'Canción', file: 'a.ogg', weight: 1 }]
    }))
    const saved = JSON.parse(JSON.stringify(store.get().project))
    expect(migrateProject(saved).music).toHaveLength(1)
    store.undo()
    expect(store.get().project!.music).toEqual([])
  })
  it('dos pestañas nunca comparten datos de las secciones', () => {
    const a = store.openInNewTab(emptyProjectFor('A', 'content'), null, 'focos')
    store.updateProject((q) => ({ ...q, music: [{ uid: 'x', name: 'x', file: 'x', weight: 1 }] }))
    const b = store.openInNewTab(emptyProjectFor('B', 'content'), null, 'focos')
    expect(store.get().project!.music).toEqual([])
    store.switchTab(a)
    expect(store.get().project!.music).toHaveLength(1)
    store.switchTab(b)
    expect(store.get().project!.music).toEqual([])
  })
})

describe('exportador seguro', () => {
  it('un proyecto nuevo y vacío exporta solo descriptor.mod y <slug>.mod', async () => {
    const p = emptyProjectFor('Mod vacío', 'content')
    expect(plannedPaths(p)).toEqual(['descriptor.mod'])
    const dir = tmp()
    const r = await handleExportMod({
      exportPath: dir,
      modName: p.modName,
      tag: '',
      focusTreeScript: '',
      locYaml: 'l_english:\n',
      files: []
    })
    expect(r.success).toBe(true)
    expect(fs.readdirSync(dir).sort()).toEqual(['mod_vacio', 'mod_vacio.mod'])
    expect(fs.readdirSync(path.join(dir, 'mod_vacio'))).toEqual(['descriptor.mod'])
  })
  it('la lista negra y las carpetas no permitidas dan error', () => {
    for (const bad of [
      'map/definition.csv',
      'map/provinces.bmp',
      'interface/countrytechtreeview.gui',
      'music/music.asset',
      'common/characters/GER.txt',
      'otra/cosa.txt'
    ])
      expect(pathProblems(bad).length, bad).toBeGreaterThan(0)
    for (const ok of [
      'common/characters/mimod_GER_characters.txt',
      'history/states/12-Berlin.txt',
      'events/mimod_x.txt',
      'localisation/english/mimod_events_l_english.yml'
    ])
      expect(pathProblems(ok), ok).toEqual([])
    // archivo del juego con el mismo nombre: error salvo parches mínimos
    const game = {
      gameFiles: new Set(['common/ideas/00_ideas.txt', 'history/states/12-berlin.txt'])
    }
    expect(pathProblems('common/ideas/00_ideas.txt', game).length).toBeGreaterThan(0)
    expect(pathProblems('history/states/12-Berlin.txt', game)).toEqual([])
  })
  it('dos generadores con la misma ruta producen un error, y los de sección llevan el prefijo del mod', () => {
    const reg = new PathRegistry({}, 'mimod')
    reg.add('a', { path: 'events/mimod_x.txt', text: '1' }, { requirePrefix: true })
    reg.add('b', { path: 'events/MIMOD_x.txt', text: '2' }, { requirePrefix: true })
    reg.add('c', { path: 'events/otro.txt', text: '3' }, { requirePrefix: true })
    expect(reg.issues.map((i) => i.message).join('|')).toMatch(/Dos generadores/)
    expect(reg.issues.map((i) => i.message).join('|')).toMatch(/prefijo/)
    expect(reg.files).toHaveLength(2)
  })
  it('el validador bloquea una sección que escribe en la lista negra o duplica rutas', () => {
    registerSectionGenerator({
      id: 'prueba-a',
      generate: () => [{ path: 'map/definition.csv', text: 'x' }]
    })
    const p = emptyProjectFor('Mi Mod', 'content')
    const issues = validateProject(p)
    expect(issues.some((i) => i.severity === 'error' && /map\//.test(i.message))).toBe(true)
    registerSectionGenerator({ id: 'prueba-a', generate: () => [] })
    expect(sectionFiles(p).files).toEqual([])
  })
})

describe('serializador y localización', () => {
  it('los strings llevan comillas una sola vez; nunca \\"', () => {
    expect(quote('hola')).toBe('"hola"')
    expect(quote('"ya citado"')).toBe('"ya citado"')
    expect(quote('di "hola"')).toBe('"di \'hola\'"')
    expect(quote('a \\"b\\"')).toBe('"a \'b\'"')
    const out = file([
      block('country_event', [
        kv('id', 'mod.1'),
        str('title', 'él dijo "no"'),
        list('countries', ['GER', 'ITA']),
        kv('hidden', true),
        raw('add_stability = 0.05\n')
      ])
    ])
    expect(out).toBe(
      'country_event = {\n\tid = mod.1\n\ttitle = "él dijo \'no\'"\n\tcountries = { GER ITA }\n\thidden = yes\n\tadd_stability = 0.05\n}\n'
    )
    expect(out).not.toContain('\\"')
  })
  it('un .yml por idioma, con BOM, cabecera y la carpeta correcta', () => {
    const p = {
      ...emptyProjectFor('Mi Mod', 'content'),
      languages: [{ code: 'english' }, { code: 'spanish' }]
    }
    const files = localisationFiles(p, 'events', {
      'mi.1.t': { english: 'Hello', spanish: 'Hola' },
      'mi.1.d': 'Dijo "no"'
    })
    expect(files.map((f) => f.path)).toEqual([
      'localisation/english/mi_mod_events_l_english.yml',
      'localisation/spanish/mi_mod_events_l_spanish.yml'
    ])
    for (const f of files) {
      expect(f.bom).toBe(true)
      expect(f.text).not.toContain('\\"')
      expect(f.path.startsWith('localisation/l_')).toBe(false)
    }
    expect(files[0].text!.startsWith('l_english:\n')).toBe(true)
    expect(files[1].text).toContain(' mi.1.t:0 "Hola"')
    expect(localisationFiles(p, 'events', {})).toEqual([])
    expect(LANGUAGES.map((l) => l.code)).toContain('braz_por')
  })
})

describe('BlocklyArea', () => {
  it('genera el mismo texto que las ranuras de los focos', () => {
    const effects = {
      block: {
        type: 'eff_add_stability',
        fields: { PERCENT: 5 },
        next: { block: { type: 'eff_set_country_flag', fields: { FLAG: 'reforma' } } }
      }
    }
    const focusWs = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: { languageVersion: 0, blocks: [{ type: FOCUS_ROOT, inputs: { REWARD: effects } }] }
      },
      focusWs
    )
    const areaWs = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: areaRootType('effect', 'country'), inputs: { BODY: effects } }]
        }
      },
      areaWs
    )
    expect(generateArea(areaWs)).toBe(generateSlots(focusWs).reward)
    // un bloque suelto no genera código
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: areaRootType('effect', 'country') },
            { type: 'eff_add_stability', fields: { PERCENT: 9 } }
          ]
        }
      },
      areaWs
    )
    expect(generateArea(areaWs)).toBe('')
  })
})
