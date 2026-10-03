// Pruebas de las partes 2–6: catálogo, FieldCatalog, referencias, íconos, DDS, ideas y migración
import { migrateFocusBlocks } from '../src/renderer/src/blocks/slots'
import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import {
  buildMenu,
  FieldCatalog,
  isSpecialValue,
  SPECIAL
} from '../src/renderer/src/blocks/fieldCatalog'
import { getCatalogOptions } from '../src/renderer/src/catalog/catalog'
import { store } from '../src/renderer/src/store/appStore'
import {
  createFocus,
  createIdea,
  deleteFocus,
  renameFocusId,
  setFocusIcon,
  setFocusName
} from '../src/renderer/src/ui/projectOps'
import { pickAutoEmoji } from '../src/renderer/src/icons/emojiData'
import { setIconRenderer } from '../src/renderer/src/icons/renderer'
import { writeDDS, writeTGA } from '../src/renderer/src/export/images'
import { generateIdeas } from '../src/renderer/src/generator/ideas'
import { generateFocusTree, generateLocalisation } from '../src/renderer/src/generator/focusTree'
import { buildExtraFiles } from '../src/renderer/src/export/exportMod'
import { planIconExport } from '../src/renderer/src/export/gfx'
import { validateProject } from '../src/renderer/src/export/validator'
import { migrateProject } from '../src/renderer/src/migrate'
import { handleExportMod } from '../src/main/export'
import { parseCountryTags, parseIdeaIds } from '../src/main/game'
import type { Project } from '../src/renderer/src/types'

import { emptyProject } from './fixtures'

registerAllBlocks()
// Dibujante falso: guarda la receta en el "png" para poder comprobarla
setIconRenderer((r, t) => `fake:${t}:${r.emoji}:${r.color}`)

/** Proyecto con 2 focos: B tiene "completó el foco A" y pone la marca "reforma" */
function projectWithRefs(): Project {
  let p = createFocus(emptyProject(), 0, 0, 'Industrializar').project
  p = createFocus(p, 0, 1, 'Segundo').project
  const [a, b] = p.focuses
  const blocks = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'slot_available',
          inputs: {
            BODY: {
              block: {
                type: 'cond_has_completed_focus',
                fields: { FOCUS: a.id }
              }
            }
          }
        },
        {
          type: 'slot_reward',
          inputs: {
            BODY: {
              block: {
                type: 'eff_set_country_flag',
                fields: { FLAG: 'reforma' }
              }
            }
          }
        }
      ]
    }
  }
  p.focuses[1] = {
    ...b,
    blocks: migrateFocusBlocks(blocks),
    scripts: {
      available: `\thas_completed_focus = ${a.id}\n`,
      bypass: '',
      reward: '\tset_country_flag = reforma\n'
    }
  }
  return p
}

beforeEach(() =>
  store.set({
    project: null,
    selectedUid: null,
    pick: null,
    prompt: null,
    game: null
  })
)

describe('catálogo', () => {
  it('devuelve opciones por tipo en orden mod → juego', () => {
    let p = projectWithRefs()
    p = createIdea(p, 'Industria pesada').project
    const ideas = getCatalogOptions('idea', p)
    expect(ideas[0]).toMatchObject({
      id: 'MEX_industria_pesada',
      origen: 'mod'
    })
    expect(ideas.slice(1).every((o) => o.origen === 'juego')).toBe(true)
    expect(ideas.some((o) => o.id === 'war_economy')).toBe(true)

    const countries = getCatalogOptions('country', p)
    expect(countries[0]).toMatchObject({ id: 'MEX', origen: 'mod' })
    expect(countries.filter((o) => o.id === 'MEX')).toHaveLength(1)

    expect(getCatalogOptions('focus', p).map((o) => o.id)).toEqual(p.focuses.map((f) => f.id))
    expect(getCatalogOptions('countryFlag', p).map((o) => o.id)).toEqual(['reforma'])
    expect(getCatalogOptions('state', p)).toEqual([])
  })

  it('usa el contenido del juego si hay carpeta configurada', () => {
    const opts = getCatalogOptions('country', emptyProject(), {
      countries: [['ZZZ', 'ZZZ']],
      ideas: []
    })
    expect(opts.map((o) => o.id)).toEqual(['MEX', 'ZZZ'])
  })

  it('el menú pone especiales al final y excluye el foco que se edita', () => {
    const p = projectWithRefs()
    store.set({ project: p, selectedUid: p.focuses[1].uid })
    const menu = buildMenu('focus', p.focuses[0].id)
    expect(menu[0][1]).toBe(SPECIAL.pickTree)
    expect(menu.map((m) => m[1])).not.toContain(p.focuses[1].id)
    expect(menu.slice(-3).map((m) => m[1])).toEqual([
      SPECIAL.separator,
      SPECIAL.create,
      SPECIAL.other
    ])
    expect(menu[1][0]).toBe('Industrializar')
  })
})

describe('FieldCatalog', () => {
  it('acepta valores que no están en la lista y nunca guarda opciones especiales', () => {
    store.set({ project: emptyProject() })
    const ws = new Blockly.Workspace()
    const b = ws.newBlock('cond_has_idea')
    b.setFieldValue('idea_de_un_dlc', 'IDEA')
    expect(b.getFieldValue('IDEA')).toBe('idea_de_un_dlc')
    for (const v of Object.values(SPECIAL)) {
      b.setFieldValue(v, 'IDEA')
      expect(b.getFieldValue('IDEA')).toBe('idea_de_un_dlc')
      expect(isSpecialValue(b.getFieldValue('IDEA'))).toBe(false)
    }
    // Un valor que no existe se muestra con ⚠
    expect(buildMenu('idea', 'idea_de_un_dlc')[0][0]).toBe('idea_de_un_dlc (ya no existe)')
  })

  it('"Escribir otro ID" usa el diálogo propio y valida', () => {
    store.set({ project: emptyProject() })
    const ws = new Blockly.Workspace()
    const b = ws.newBlock('cond_has_country_flag')
    const field = b.getField('FLAG') as FieldCatalog
    field.handleSpecial(SPECIAL.other)
    expect(store.get().prompt?.validate?.('con espacio')).not.toBeNull()
    store.closePrompt('marca_de_otro_mod')
    expect(b.getFieldValue('FLAG')).toBe('marca_de_otro_mod')
  })

  it('"+ Crear nuevo" crea una marca (solo minúsculas) y un espíritu', () => {
    store.set({ project: emptyProject() })
    const ws = new Blockly.Workspace()
    const flag = ws.newBlock('eff_set_country_flag').getField('FLAG') as FieldCatalog
    flag.handleSpecial(SPECIAL.create)
    expect(store.get().prompt?.validate?.('Mayus')).not.toBeNull()
    store.closePrompt('nueva_marca')
    expect(flag.getValue()).toBe('nueva_marca')
    expect(store.get().project!.countryFlags).toContain('nueva_marca')

    const idea = ws.newBlock('eff_add_ideas').getField('IDEA') as FieldCatalog
    idea.handleSpecial(SPECIAL.create)
    store.closePrompt('Economía fuerte')
    expect(idea.getValue()).toBe('MEX_economia_fuerte')
    expect(store.get().project!.ideas[0].id).toBe('MEX_economia_fuerte')
  })

  it('"Elegir en el árbol" usa el modo selección genérico del store', () => {
    const p = projectWithRefs()
    store.set({ project: p, selectedUid: p.focuses[1].uid })
    const ws = new Blockly.Workspace()
    const field = ws.newBlock('cond_has_completed_focus').getField('FOCUS') as FieldCatalog
    field.handleSpecial(SPECIAL.pickTree)
    expect(store.get().pick).toMatchObject({
      kind: 'focus',
      exclude: [p.focuses[1].uid]
    })
    store.finishPick(p.focuses[1].uid) // excluido: no hace nada
    expect(store.get().pick).not.toBeNull()
    store.finishPick(p.focuses[0].uid)
    expect(field.getValue()).toBe(p.focuses[0].id)
    expect(store.get().pick).toBeNull()
  })

  it('un proyecto con los valores viejos (texto libre) abre sin perderlos', () => {
    store.set({ project: emptyProject() })
    const ws = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          blocks: [{ type: 'cond_has_idea', fields: { IDEA: 'id_de_idea' } }]
        }
      },
      ws
    )
    expect(ws.getAllBlocks(false)[0].getFieldValue('IDEA')).toBe('id_de_idea')
  })
})

describe('renombrar y borrar focos', () => {
  it('renombrar el id actualiza bloques y scripts', () => {
    const p = projectWithRefs()
    const oldId = p.focuses[0].id
    const next = renameFocusId(p, p.focuses[0].uid, 'MEX_nuevo_id')
    const b = next.focuses[1]
    expect(JSON.stringify(b.blocks)).toContain('"FOCUS":"MEX_nuevo_id"')
    expect(JSON.stringify(b.blocks)).not.toContain(oldId)
    expect(b.scripts.available).toBe('\thas_completed_focus = MEX_nuevo_id\n')
  })

  it('borrar deja la referencia marcada como "ya no existe" y el validador avisa', () => {
    const p = projectWithRefs()
    const oldId = p.focuses[0].id
    const next = deleteFocus(p, p.focuses[0].uid)
    expect(next.focuses[0].scripts.available).toContain(oldId)
    store.set({ project: next })
    expect(buildMenu('focus', oldId).find((m) => m[1] === oldId)?.[0]).toBe(
      `${oldId} (ya no existe)`
    )
    const avisos = validateProject(next)
      .filter((i) => i.severity === 'aviso')
      .map((i) => i.message)
    expect(avisos.some((m) => m.includes('ya no existe'))).toBe(true)
  })
})

describe('ícono automático', () => {
  it('elige el emoji según el nombre (sin tildes ni mayúsculas)', () => {
    expect(pickAutoEmoji('Industrializar')).toBe('🏭')
    expect(pickAutoEmoji('Ampliar la FLOTA')).toBe('⚓')
    expect(pickAutoEmoji('Fortificación del norte')).toBe('🛡️')
    expect(pickAutoEmoji('Minería de ACERO')).toBe('⛏️')
    expect(pickAutoEmoji('Algo raro')).toBe('⭐')
  })

  it('al crear un foco se le asigna un ícono con emoji y gris acero', () => {
    const { project, focus } = createFocus(emptyProject(), 0, 0, 'Industrializar')
    expect(focus.iconAuto).toBe(true)
    const asset = project.icons.find(
      (a) => focus.icon.kind === 'asset' && a.id === focus.icon.assetId
    )!
    expect(asset.recipe).toEqual({ emoji: '🏭', color: 'acero' })
    expect(asset.png).toBe('fake:focus:🏭:acero')
    expect([asset.width, asset.height]).toEqual([100, 88])
  })

  it('los espíritus usan oliva y 60×68', () => {
    const { project, idea } = createIdea(emptyProject(), 'Economía de guerra')
    const asset = project.icons.find(
      (a) => idea.icon?.kind === 'asset' && a.id === idea.icon.assetId
    )!
    expect(asset.recipe).toEqual({ emoji: '💰', color: 'oliva' })
    expect([asset.width, asset.height]).toEqual([60, 68])
  })

  it('renombrar actualiza el emoji automático pero NO un ícono puesto a mano', () => {
    const r = createFocus(emptyProject(), 0, 0, 'Industrializar')
    let p = setFocusName(r.project, r.focus.uid, 'Gran flota')
    expect(p.icons[0].recipe?.emoji).toBe('⚓')
    p = setFocusIcon(p, r.focus.uid, {
      kind: 'game',
      gfx: 'GFX_goal_generic_production'
    })
    expect(p.icons).toHaveLength(0) // el automático que ya no se usa se borra
    p = setFocusName(p, r.focus.uid, 'Ejército')
    expect(p.focuses[0].icon).toEqual({
      kind: 'game',
      gfx: 'GFX_goal_generic_production'
    })
    expect(p.icons).toHaveLength(0)
  })
})

describe('escritores de imágenes', () => {
  it('DDS: cabecera y tamaño del archivo', () => {
    const w = 3
    const h = 2
    const rgba = new Uint8Array(w * h * 4)
    rgba.set([10, 20, 30, 40], 0) // primer píxel RGBA
    const dds = writeDDS(w, h, rgba)
    const v = new DataView(dds.buffer)
    expect(dds.length).toBe(128 + w * h * 4)
    expect(String.fromCharCode(...dds.slice(0, 4))).toBe('DDS ')
    expect(v.getUint32(4, true)).toBe(124)
    expect(v.getUint32(8, true)).toBe(0x100f)
    expect(v.getUint32(12, true)).toBe(h)
    expect(v.getUint32(16, true)).toBe(w)
    expect(v.getUint32(20, true)).toBe(w * 4)
    expect(v.getUint32(76, true)).toBe(32)
    expect(v.getUint32(80, true)).toBe(0x41)
    expect(v.getUint32(88, true)).toBe(32)
    expect(v.getUint32(92, true)).toBe(0x00ff0000)
    expect(v.getUint32(96, true)).toBe(0x0000ff00)
    expect(v.getUint32(100, true)).toBe(0x000000ff)
    expect(v.getUint32(104, true)).toBe(0xff000000)
    expect(v.getUint32(108, true)).toBe(0x1000)
    expect([...dds.slice(128, 132)]).toEqual([30, 20, 10, 40]) // BGRA
  })

  it('TGA de 32 bits', () => {
    const tga = writeTGA(2, 1, new Uint8Array(8))
    expect(tga.length).toBe(18 + 8)
    expect(tga[2]).toBe(2)
    expect(tga[16]).toBe(32)
  })
})

describe('exportación de ideas e íconos', () => {
  function withIdea(): Project {
    let p = createFocus(emptyProject(), 0, 0, 'Industrializar').project
    const r = createIdea(p, 'Industria pesada')
    p = r.project
    p.ideas[0] = {
      ...p.ideas[0],
      description: 'Más fábricas',
      modifiers: [
        { key: 'stability_factor', value: 10 },
        { key: 'political_power_gain', value: 0.5 }
      ]
    }
    return p
  }

  it('formato de common/ideas', () => {
    const txt = generateIdeas(withIdea())
    expect(txt).toBe(
      'ideas = {\n\tcountry = {\n\t\tMEX_industria_pesada = {\n\t\t\tpicture = mex_industria_pesada\n' +
        '\t\t\tmodifier = {\n\t\t\t\tstability_factor = 0.1\n\t\t\t\tpolitical_power_gain = 0.5\n\t\t\t}\n\t\t}\n\t}\n}\n'
    )
  })

  it('sprites en el .gfx y el foco usa su sprite', () => {
    const p = withIdea()
    const plan = planIconExport(p)
    expect(plan.gfx).toContain('name = "GFX_mi_mod_mex_industrializar"')
    expect(plan.gfx).toContain('texturefile = "gfx/interface/goals/mi_mod_mex_industrializar.dds"')
    expect(plan.gfx).toContain('name = "GFX_idea_mex_industria_pesada"')
    expect(plan.gfx).toContain('texturefile = "gfx/interface/ideas/')
    expect(generateFocusTree(p)).toContain('icon = GFX_mi_mod_mex_industrializar')
  })

  it('un ícono del juego no agrega archivos', () => {
    const r = createFocus(emptyProject(), 0, 0, 'X')
    const p = setFocusIcon(r.project, r.focus.uid, {
      kind: 'game',
      gfx: 'GFX_goal_generic_trade'
    })
    expect(planIconExport(p).dds).toHaveLength(0)
    expect(generateFocusTree(p)).toContain('icon = GFX_goal_generic_trade')
  })

  it('nombre de sprite duplicado es ERROR', () => {
    let p = createFocus(emptyProject(), 0, 0, 'Uno').project
    p = createFocus(p, 1, 0, 'Dos').project
    p.focuses[0].id = 'MEX_abc'
    p.focuses[1].id = 'mex_ABC'
    const errs = validateProject(p)
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
    expect(errs.some((m) => m.includes('sprite'))).toBe(true)
  })

  it('escribe ideas, .dds, .gfx y la localización con BOM', async () => {
    const p = withIdea()
    const files = await buildExtraFiles(p, async (png) => {
      const size = png.includes(':idea:') ? [60, 68] : [100, 88]
      return {
        width: size[0],
        height: size[1],
        rgba: new Uint8Array(size[0] * size[1] * 4)
      }
    })
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-'))
    const res = await handleExportMod({
      exportPath: dir,
      modName: p.modName,
      tag: p.tag,
      focusTreeScript: generateFocusTree(p),
      locYaml: generateLocalisation(p),
      files
    })
    expect(res.success).toBe(true)
    const mod = path.join(dir, 'mi_mod')
    expect(fs.readFileSync(path.join(mod, 'common/ideas/mi_mod_ideas.txt'), 'utf-8')).toContain(
      'MEX_industria_pesada = {'
    )
    const goal = fs.readFileSync(
      path.join(mod, 'gfx/interface/goals/mi_mod_mex_industrializar.dds')
    )
    expect(goal.length).toBe(128 + 100 * 88 * 4)
    expect(fs.readdirSync(path.join(mod, 'gfx/interface/ideas'))).toHaveLength(1)
    expect(fs.readFileSync(path.join(mod, 'interface/mi_mod_icons.gfx'), 'utf-8')).toContain(
      'spriteTypes = {'
    )
    const loc = fs.readFileSync(path.join(mod, 'localisation/english/mi_mod_l_english.yml'))
    expect([...loc.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = loc.toString('utf-8')
    expect(text).toContain(' MEX_industria_pesada:0 "Industria pesada"')
    expect(text).toContain(' MEX_industria_pesada_desc:0 "Más fábricas"')
  })

  it('rechaza rutas fuera del mod', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-'))
    const res = await handleExportMod({
      exportPath: dir,
      modName: 'x',
      tag: 'MEX',
      focusTreeScript: '',
      locYaml: '',
      files: [{ path: '../../malo.txt', text: 'x' }]
    })
    expect(res.success).toBe(false)
  })
})

describe('migración de proyecto.json', () => {
  it('un proyecto v1 abre sin error', () => {
    const v1 = {
      version: 1,
      modName: 'Viejo',
      tag: 'GER',
      focuses: [
        {
          uid: 'a',
          id: 'GER_x',
          name: 'X',
          description: '',
          cost: 10,
          icon: 'GFX_goal_generic_production',
          x: 0,
          y: 0,
          prerequisites: [],
          mutuallyExclusive: [],
          blocks: null,
          scripts: { available: '', bypass: '', reward: '' }
        }
      ]
    }
    const p = migrateProject(v1)
    expect(p.version).toBe(9)
    expect(p.stateEdits).toEqual({})
    expect(p.countries).toHaveLength(1)
    expect(p.countries[0]).toMatchObject({ tag: 'GER', mode: 'existente', focusTreeId: 'arbol_1' })
    expect(p.focuses[0].treeId).toBe('arbol_1')
    expect(p.focuses[0].icon).toEqual({
      kind: 'game',
      gfx: 'GFX_goal_generic_production'
    })
    expect(p.focuses[0].iconAuto).toBe(false)
    expect(p.ideas).toEqual([])
    expect(p.icons).toEqual([])
    expect(p.countryFlags).toEqual([])
    expect(validateProject(p).filter((i) => i.severity === 'error')).toEqual([])
    expect(() => migrateProject({ foo: 1 })).toThrow()
  })
})

describe('lectura de la carpeta del juego', () => {
  it('lee tags e ideas', () => {
    expect(
      parseCountryTags('GER = "countries/Germany.txt"\n# ENG = x\nENG = "countries/UK.txt"')
    ).toEqual(['GER', 'ENG'])
    const ideas =
      'ideas = {\n\tcountry = {\n\t\tmi_idea = {\n\t\t\tmodifier = { stability_factor = 0.1 }\n\t\t}\n\t}\n' +
      '\teconomy = {\n\t\tlaw = yes\n\t\twar_economy = { cost = 150 }\n\t}\n}'
    expect(parseIdeaIds(ideas)).toEqual(['mi_idea', 'war_economy'])
  })
})

describe('campos de estado: sin desplegables largos', () => {
  it('con 1000 estados en el juego, el menú de un campo de estado tiene menos de 20 opciones', async () => {
    const { buildMenu } = await import('../src/renderer/src/blocks/fieldCatalog')
    const { store } = await import('../src/renderer/src/store/appStore')
    store.openProject(emptyProject(), null)
    store.set({
      game: {
        countries: [],
        ideas: [],
        states: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `E${i}`, owner: 'GER' }))
      } as never
    })
    expect(buildMenu('state', '12').length).toBeLessThan(20)
    expect(buildMenu('state', '').length).toBeLessThan(20)
  })
})
