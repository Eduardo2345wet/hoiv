import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { generateArea } from '../src/renderer/src/blocks/area'
import { emptyProjectFor } from '../src/renderer/src/templates'
import {
  childrenOfMine,
  createIdeology,
  createTech,
  findTechCycle,
  ideologyLoc,
  techFiles,
  techEdges,
  textPatchRequests,
  updateTech,
  validateIdeologies,
  validateTechnologies
} from '../src/renderer/src/sections/technologies'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { planTextPatches } from '../src/main/textPatches'
import { parseTechnologies } from '../src/shared/gameTech'
import { readIdeologyGroups } from '../src/shared/textPatch'
import { isRegisteredPatch } from '../src/shared/exportPaths'
import { planTextPatchExport } from '../src/renderer/src/export/textPatchExport'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Project } from '../src/renderer/src/types'

registerAllBlocks()
const game = {
  technologies: [
    { id: 'infantry_a', folder: 'infantry_folder', file: 'infantry.txt', leadsTo: ['infantry_b'] },
    { id: 'infantry_b', folder: 'infantry_folder', file: 'infantry.txt', leadsTo: [] }
  ],
  ideologyFiles: [
    { file: '00_ideologies.txt', groups: [{ group: 'democratic', types: ['liberalism'] }] }
  ]
} as never

const base = (): Project => {
  let p = { ...emptyProjectFor('Mi Mod', 'content'), techAdvanced: true }
  p = createTech(p, {
    name: 'Fusil nuevo',
    folder: 'infantry_folder',
    x: 1,
    y: 3,
    cost: 2,
    year: 1938,
    categories: ['infantry_weapons'],
    prerequisites: ['infantry_a'],
    leadsTo: ['infantry_b']
  }).project
  p = createIdeology(p, {
    name: 'Liberal social',
    group: 'democratic',
    color: [10, 20, 30]
  }).project
  return p
}

describe('tecnologías e ideologías (S8)', () => {
  it('genera un archivo propio con path hacia lo que desbloquea y localización', async () => {
    const p = base()
    const f = techFiles(p)[0]
    expect(f.path).toBe('common/technologies/mi_mod_technologies.txt')
    const t = f.text!
    expect(t).toContain('research_cost = 2')
    expect(t).toContain('start_year = 1938')
    expect(t).toContain('folder = {\n\t\t\tname = infantry_folder')
    expect(t).toContain('path = {\n\t\t\tleads_to_tech = infantry_b')
    expect(t).toContain('categories = { infantry_weapons }')
    const j = await Jomini.initialize()
    expect(() => j.parseText(t)).not.toThrow()
    const loc = ideologyLoc(p)[0].text!
    expect(loc).toContain('mi_mod_fusil_nuevo:0 "Fusil nuevo"')
    expect(loc).toContain('mi_mod_liberal_social:0 "Liberal social"')
    expect(sectionFiles(p).issues).toEqual([])
    // nunca se escribe el .gui de la pantalla de investigación ni music/music.asset
    expect(sectionFiles(p).files.some((x) => x.path.endsWith('.gui'))).toBe(false)
  })

  it('sin Modo avanzado las tecnologías no se exportan (y se avisa)', () => {
    const p = { ...base(), techAdvanced: false }
    expect(techFiles(p)).toEqual([])
    expect(
      validateTechnologies(p, game).some((i) => /Modo avanzado está desactivado/.test(i.message))
    ).toBe(true)
  })

  it('pide parches mínimos: tecnología del juego con enlace nuevo y subideología en su archivo', () => {
    const r = textPatchRequests(base(), game)
    expect(r).toEqual([
      {
        kind: 'tech',
        file: 'infantry.txt',
        links: [{ from: 'infantry_a', to: 'mi_mod_fusil_nuevo' }]
      },
      {
        kind: 'ideology',
        file: '00_ideologies.txt',
        adds: [
          { group: 'democratic', id: 'mi_mod_liberal_social', lines: ['color = { 10 20 30 }'] }
        ]
      }
    ])
  })

  it('los prerrequisitos míos van en el path del padre', () => {
    let p = base()
    p = createTech(p, { name: 'Hijo', prerequisites: ['mi_mod_fusil_nuevo'] }).project
    const parent = p.technologies[0]
    expect(childrenOfMine(p, parent).sort()).toEqual(['infantry_b', 'mi_mod_hijo'])
  })

  it('validador: ciclos, referencias, carpeta, nombre, ID del juego', () => {
    expect(
      findTechCycle([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a']
      ])
    ).not.toBeNull()
    expect(
      findTechCycle([
        ['a', 'b'],
        ['a', 'c'],
        ['b', 'c']
      ])
    ).toBeNull()
    let p = base()
    // ciclo: infantry_b (del juego) → mía → infantry_b
    p = updateTech(p, p.technologies[0].uid, {
      prerequisites: ['infantry_b'],
      leadsTo: ['infantry_b']
    })
    expect(techEdges(p, game).length).toBeGreaterThan(0)
    expect(validateTechnologies(p, game).some((i) => /ciclo/.test(i.message))).toBe(true)
    p = updateTech(p, p.technologies[0].uid, {
      prerequisites: ['no_existe'],
      leadsTo: ['tampoco'],
      folder: 'carpeta_rara',
      name: '',
      id: 'infantry_a'
    })
    const m = validateTechnologies(p, game).map((i) => i.message)
    expect(m.some((x) => /prerrequisito no_existe no existe/.test(x))).toBe(true)
    expect(m.some((x) => /desbloquea tampoco/.test(x))).toBe(true)
    expect(m.some((x) => /carpeta carpeta_rara no existe/.test(x))).toBe(true)
    expect(m.some((x) => /falta el nombre/.test(x))).toBe(true)
    expect(m.some((x) => /ya existe en el juego/.test(x))).toBe(true)
  })

  it('validador de subideologías: localización, grupo y duplicados con el juego', () => {
    let p = base()
    expect(validateIdeologies(p, game).filter((i) => i.severity === 'error')).toEqual([])
    p = { ...p, ideologies: [{ ...p.ideologies[0], name: '', id: 'liberalism', group: 'fascism' }] }
    const m = validateIdeologies(p, game).map((i) => i.message)
    expect(m.some((x) => /falta el nombre/.test(x))).toBe(true)
    expect(m.some((x) => /ya existe en el juego/.test(x))).toBe(true)
    expect(m.some((x) => /grupo fascism no está/.test(x))).toBe(true)
  })

  it('el proceso principal parcha desde los bytes del juego y verifica; sin archivo, error', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-s8-'))
    fs.mkdirSync(path.join(dir, 'common', 'technologies'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'common', 'ideologies'), { recursive: true })
    const techText = 'ï»¿technologies = {\n\tinfantry_a = {\n\t\tstart_year = 1936\n\t}\n}\n'
    fs.writeFileSync(
      path.join(dir, 'common/technologies/infantry.txt'),
      Buffer.from(techText, 'latin1')
    )
    fs.writeFileSync(
      path.join(dir, 'common/ideologies/00_ideologies.txt'),
      Buffer.from(
        'ideologies = {\n\tdemocratic = {\n\t\ttypes = {\n\t\t\tliberalism = { }\n\t\t}\n\t}\n}\n',
        'latin1'
      )
    )
    const res = await planTextPatches(dir, textPatchRequests(base(), game) as never)
    expect(res.errors).toEqual([])
    expect(res.files.map((f) => f.path)).toEqual([
      'common/technologies/infantry.txt',
      'common/ideologies/00_ideologies.txt'
    ])
    const tech = Buffer.from(res.files[0].data).toString('latin1')
    expect(tech.startsWith('ï»¿technologies')).toBe(true)
    expect(tech).toContain('path = { leads_to_tech = mi_mod_fusil_nuevo research_cost_coeff = 1 }')
    expect(parseTechnologies(tech.slice(3))[0].leadsTo).toEqual(['mi_mod_fusil_nuevo'])
    const ideo = Buffer.from(res.files[1].data).toString('latin1')
    expect(readIdeologyGroups(ideo)[0].types).toEqual(['liberalism', 'mi_mod_liberal_social'])
    // el original del juego no se toca
    expect(fs.readFileSync(path.join(dir, 'common/technologies/infantry.txt'), 'latin1')).toBe(
      techText
    )
    const missing = await planTextPatches(dir, [{ kind: 'tech', file: 'otro.txt', links: [] }])
    expect(missing.errors[0].message).toMatch(/No se encontró/)
    const evil = await planTextPatches(dir, [{ kind: 'tech', file: '../x.txt', links: [] }])
    expect(evil.errors[0].message).toMatch(/no válido/)
  })

  it('el plan del renderer registra las rutas de parche (mismo nombre que el juego permitido)', async () => {
    ;(globalThis as { window?: unknown }).window = {
      electronAPI: {
        planTextPatches: async () => ({
          files: [{ path: 'common/technologies/infantry.txt', data: new Uint8Array([1]) }],
          errors: []
        })
      }
    }
    const r = await planTextPatchExport(base(), '/juego', null, game)
    expect(r.files).toHaveLength(1)
    expect(isRegisteredPatch('common/technologies/infantry.txt')).toBe(true)
    // sin carpeta del juego: error claro, nada exportado
    const none = await planTextPatchExport(base(), null, null, game)
    expect(none.files).toEqual([])
    expect(none.errors[0].message).toMatch(/carpeta del juego/)
    delete (globalThis as { window?: unknown }).window
  })

  it('bloques nuevos: ranuras, bono de investigación y dar tecnología', () => {
    const ws = new Blockly.Workspace()
    const mk = (type: string, fields: Record<string, unknown>): void => {
      Blockly.serialization.workspaces.load(
        {
          blocks: {
            languageVersion: 0,
            blocks: [
              { type: 'area_root_effect_country', inputs: { BODY: { block: { type, fields } } } }
            ]
          }
        },
        ws
      )
    }
    mk('eff_add_research_slot', { AMOUNT: 1 })
    expect(generateArea(ws)).toBe('\tadd_research_slot = 1\n')
    mk('eff_add_tech_bonus', {
      NAME: 'b1',
      BONUS: 0.5,
      USES: 2,
      KIND: 'category',
      TARGET: 'infantry_weapons'
    })
    expect(generateArea(ws)).toBe(
      '\tadd_tech_bonus = {\n\t\tname = b1\n\t\tbonus = 0.5\n\t\tuses = 2\n\t\tcategory = infantry_weapons\n\t}\n'
    )
    mk('eff_set_technology', { TECH: 'infantry_a', LEVEL: 1 })
    expect(generateArea(ws)).toBe('\tset_technology = { infantry_a = 1 }\n')
  })
})
