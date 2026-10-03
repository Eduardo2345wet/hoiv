import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { serialize } from '../src/renderer/src/export/clausewitz'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { generateArea } from '../src/renderer/src/blocks/area'
import { emptyProjectFor } from '../src/renderer/src/templates'
import {
  cellFree,
  childrenOfMine,
  connectTechs,
  disconnectTechs,
  treeOf,
  techNode,
  createIdeology,
  createTech,
  findTechCycle,
  folderLabel,
  GROUPS,
  groupLabel,
  hexToRgb,
  rgbToHex,
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

  it('solo se parcha el archivo de ideologías: la tecnología del juego NO se toca y el requisito va en la mía', () => {
    const r = textPatchRequests(base(), game)
    expect(r.some((x) => x.kind === 'tech')).toBe(false)
    const mine = techFiles(base())[0].text!
    expect(mine).toContain('dependencies = {')
    expect(mine).toMatch(/infantry_a = 1/)
    expect(r).toEqual([
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
    expect(res.files.map((f) => f.path)).toEqual(['common/ideologies/00_ideologies.txt'])
    const ideo = Buffer.from(res.files[0].data).toString('latin1')
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

describe('rediseño: color, grupos y carpetas en español', () => {
  it('el selector de color da el mismo r g b que antes y el mismo parche', () => {
    expect(hexToRgb('#336699')).toEqual([51, 102, 153])
    expect(rgbToHex([51, 102, 153])).toBe('#336699')
    expect(hexToRgb('azul')).toBeNull()
    for (const c of [
      [0, 0, 0],
      [255, 255, 255],
      [10, 20, 30]
    ] as [number, number, number][])
      expect(hexToRgb(rgbToHex(c))).toEqual(c)
    // lo que se exporta con el valor del selector es lo mismo que con tres cajas r g b
    const viaPicker = createIdeology(emptyProjectFor('Mi Mod', 'content'), {
      name: 'A',
      group: 'democratic',
      color: hexToRgb('#0a141e')
    }).project
    const viaBoxes = createIdeology(emptyProjectFor('Mi Mod', 'content'), {
      name: 'A',
      group: 'democratic',
      color: [10, 20, 30]
    }).project
    const game = {
      ideologyFiles: [{ file: '00_ideologies.txt', groups: [{ group: 'democratic', types: [] }] }]
    } as never
    expect(textPatchRequests(viaPicker, game)).toEqual(textPatchRequests(viaBoxes, game))
    expect(JSON.stringify(textPatchRequests(viaPicker, game))).toContain('color = { 10 20 30 }')
  })

  it('los grupos y las carpetas se muestran en español', () => {
    expect(GROUPS.map((g) => g.label)).toEqual([
      'Democracia',
      'Comunismo',
      'Fascismo',
      'No alineado'
    ])
    expect(groupLabel('neutrality')).toBe('No alineado')
    expect(folderLabel('infantry_folder')).toBe('Infantería')
    expect(folderLabel('algo_raro_folder')).toBe('Algo raro')
  })
})

describe('árbol interactivo: operaciones', () => {
  const g = {
    technologies: [
      { id: 'a', folder: 'f', x: 0, y: 0, year: 1936, leadsTo: ['b'] },
      { id: 'b', folder: 'f', x: 0, y: 2, year: 1938, leadsTo: [] },
      { id: 'z', folder: 'otra', x: 0, y: 0, leadsTo: [] }
    ]
  } as never
  const mk = (): { p: Project; uid: string } => {
    const r = createTech(emptyProjectFor('Mi Mod', 'content'), {
      name: 'Mía',
      folder: 'f',
      x: 2,
      y: 2
    })
    return { p: { ...r.project, techAdvanced: true }, uid: r.tech.uid }
  }

  it('solo dibuja la carpeta elegida, con las líneas del juego y las mías, y no deja encimar', () => {
    const { p, uid } = mk()
    const t = treeOf(p, g, 'f', uid)
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'mi_mod_mia'])
    expect(t.nodes.find((n) => n.id === 'mi_mod_mia')).toMatchObject({ mine: true, selected: true })
    expect(t.edges).toEqual([{ from: 'a', to: 'b', mine: false }])
    expect(cellFree(t.nodes, 2, 2, 'mi_mod_mia')).toBe(true)
    expect(cellFree(t.nodes, 0, 2, 'mi_mod_mia')).toBe(false)
    expect(cellFree(t.nodes, -1, 0, 'mi_mod_mia')).toBe(false)
  })

  it('una conexión del juego hacia la mía queda en MI tecnología (dependencies) y no toca la del juego', () => {
    const { p } = mk()
    const r = connectTechs(p, 'a', 'mi_mod_mia', g)
    expect('project' in r).toBe(true)
    if (!('project' in r)) return
    expect(r.project.technologies[0].prerequisites).toEqual(['a'])
    const code = serialize([techNode(r.project, r.project.technologies[0])])
    expect(code).toContain('dependencies')
    expect(code).toContain('a = 1')
    expect(code).not.toContain('leads_to_tech = a')
    expect(textPatchRequests(r.project, g).some((x) => x.kind === 'tech')).toBe(false)
    // la línea se dibuja igual en la vista
    expect(treeOf(r.project, g, 'f', null).edges).toContainEqual({
      from: 'a',
      to: 'mi_mod_mia',
      mine: true
    })
  })

  it('entre dos mías usa leads_to_tech; las líneas del juego no se pueden borrar', () => {
    let { p } = mk()
    p = createTech(p, { name: 'Otra', folder: 'f', x: 3, y: 4 }).project
    const r = connectTechs(p, 'mi_mod_mia', 'mi_mod_otra', g)
    if (!('project' in r)) throw new Error('debía conectar')
    expect(serialize([techNode(r.project, r.project.technologies[0])])).toContain(
      'leads_to_tech = mi_mod_otra'
    )
    const back = disconnectTechs(r.project, 'mi_mod_mia', 'mi_mod_otra')
    expect(back.technologies[0].leadsTo).toEqual([])
    // intentar borrar a>b (del juego) no cambia nada
    expect(disconnectTechs(p, 'a', 'b')).toEqual(p)
    // ciclo rechazado y conexión entre dos del juego rechazada
    const c1 = connectTechs(r.project, 'mi_mod_otra', 'mi_mod_mia', g)
    expect('error' in c1).toBe(true)
    expect('error' in connectTechs(p, 'a', 'b', g)).toBe(true)
  })

  it('la exportación lleva la posición y los requisitos correctos', () => {
    const { p } = mk()
    const r = connectTechs(p, 'b', 'mi_mod_mia', g) as { project: Project }
    const text = techFiles(r.project)[0].text!
    expect(text).toMatch(/position = \{\s*x = 2\s*y = 2\s*\}/)
    expect(text).toMatch(/dependencies = \{\s*b = 1\s*\}/)
  })
})
