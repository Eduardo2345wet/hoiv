import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Jomini } from 'jomini'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import {
  DIVISION_PRESETS,
  hasOob,
  landUnits,
  newDivision,
  newTemplate,
  oobFiles,
  oobText,
  templateFromPreset,
  unitGroups,
  unitLists,
  updateOob,
  validateOob
} from '../src/renderer/src/sections/oob'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { countryTextFiles } from '../src/renderer/src/export/countryExport'
import { patchHistory } from '../src/renderer/src/countries/history'
import { historyExtras } from '../src/renderer/src/sections/historyExtras'
import { generateDemoMap } from '../src/shared/map/demo'
import { PROVINCE_TYPE } from '../src/shared/map/types'
import {
  parseEquipments,
  parseSubUnits,
  parseUnitNames,
  unitCategory,
  unitName,
  unitSpriteCandidates
} from '../src/shared/gameUnits'
import { readGameCatalog } from '../src/main/game'
import { spriteThumb } from '../src/main/gameSprites'
import { decodeDds, thumbnail } from '../src/shared/dds'
import { parseGfxSprites } from '../src/shared/gfxSprites'
import type { Project } from '../src/renderer/src/types'

const map = generateDemoMap()
const land = (): number => map.provinceType.findIndex((t) => t === PROVINCE_TYPE.land)
const sea = (): number => map.provinceType.findIndex((t) => t === PROVINCE_TYPE.sea)

const withOob = (mode: 'nuevo' | 'existente' = 'nuevo'): Project => {
  let p = emptyProjectFor('Mi Mod', 'content')
  p = addCountry(p, newCountry({ mode, tag: 'NVG', name: 'Nueva' }))
  p = updateOob(p, 'NVG', (o) => {
    const t = {
      ...newTemplate(o, 'Infantería'),
      regiments: [
        { type: 'infantry', x: 0, y: 0 },
        { type: 'infantry', x: 0, y: 1 },
        { type: 'artillery_brigade', x: 1, y: 0 }
      ],
      support: [{ type: 'engineer', y: 0 }]
    }
    return {
      ...o,
      templates: [t],
      divisions: [
        newDivision({ ...o, templates: [t] }, 3030, { name: '1ª División', experience: 0.3 }),
        newDivision({ ...o, templates: [t] }, 3031, { ordinal: 2 })
      ],
      production: [{ equipment: 'infantry_equipment_1', factories: 3 }]
    }
  })
  return p
}

// Fixture propio que imita un OOB real (formato de history/units)
const FIXTURE = `division_template = {
\tname = "Infantería"
\tregiments = {
\t\tinfantry = {
\t\t\tx = 0
\t\t\ty = 0
\t\t}
\t\tinfantry = {
\t\t\tx = 0
\t\t\ty = 1
\t\t}
\t\tartillery_brigade = {
\t\t\tx = 1
\t\t\ty = 0
\t\t}
\t}
\tsupport = {
\t\tengineer = {
\t\t\tx = 0
\t\t\ty = 0
\t\t}
\t}
}
units = {
\tdivision = {
\t\tname = "1ª División"
\t\tlocation = 3030
\t\tdivision_template = "Infantería"
\t\tstart_experience_factor = 0.3
\t\tstart_equipment_factor = 1
\t}
\tdivision = {
\t\tdivision_name = {
\t\t\tis_name_ordered = yes
\t\t\tname_order = 2
\t\t}
\t\tlocation = 3031
\t\tdivision_template = "Infantería"
\t\tstart_experience_factor = 0
\t\tstart_equipment_factor = 1
\t}
}
instant_effect = {
\tadd_equipment_production = {
\t\tequipment = {
\t\t\ttype = infantry_equipment_1
\t\t\tcreator = "NVG"
\t\t}
\t\trequested_factories = 3
\t\tprogress = 0.5
\t\tefficiency = 100
\t}
}
`

describe('ejército inicial (S7)', () => {
  it('el texto generado coincide con el fixture y se lee con jomini', async () => {
    const p = withOob()
    const text = oobText('NVG', p.oobs[0])
    expect(text.trimEnd()).toBe(FIXTURE.trimEnd())
    const j = await Jomini.initialize()
    expect(() => j.parseText(text)).not.toThrow()
    expect(text).not.toContain('\\"')
  })

  it('país nuevo: archivo con prefijo del mod, historia apunta a él y no queda el OOB mínimo', () => {
    const p = withOob('nuevo')
    expect(oobFiles(p).map((f) => f.path)).toEqual(['history/units/mi_mod_NVG_1936.txt'])
    expect(sectionFiles(p).issues).toEqual([])
    const files = countryTextFiles(p, null)
    const hist = files.find((f) => f.path.startsWith('history/countries/'))!.text!
    expect(hist).toContain('oob = "mi_mod_NVG_1936"')
    expect(files.some((f) => f.path === 'history/units/NVG_1936.txt')).toBe(false)
    // sin ejército propio se conserva el OOB mínimo de siempre
    const q = addCountry(
      emptyProjectFor('Mi Mod', 'content'),
      newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva' })
    )
    expect(countryTextFiles(q, null).some((f) => f.path === 'history/units/NVG_1936.txt')).toBe(
      true
    )
  })

  it('país del juego: archivo NUEVO y solo cambia la línea oob de su historia', () => {
    const p = withOob('existente')
    const orig =
      'capital = 1\noob = "NVG_1936"\nset_politics = {\n\truling_party = neutrality\n}\nset_popularities = {\n\tneutrality = 100\n}\n'
    const out = patchHistory(orig, p.countries[0], historyExtras(p, p.countries[0]))
    expect(out).toContain('oob = "mi_mod_NVG_1936"')
    expect(out.startsWith('capital = 1\noob = "mi_mod_NVG_1936"\n')).toBe(true)
    expect(oobFiles(p).every((f) => f.path !== 'history/units/NVG_1936.txt')).toBe(true)
    expect(hasOob(p, 'NVG')).toBe(true)
  })

  it('validador: plantilla vacía, fuera de la cuadrícula, duplicados, plantilla inexistente, mar', () => {
    let p = withOob()
    p = updateOob(p, 'NVG', (o) => ({
      ...o,
      templates: [
        ...o.templates,
        { name: 'Vacía', regiments: [], support: [] },
        {
          name: 'Mala',
          regiments: [
            { type: 'infantry', x: 5, y: 0 },
            { type: 'infantry', x: 0, y: 0 },
            { type: 'infantry', x: 0, y: 0 }
          ],
          support: [
            { type: 'engineer', y: 7 },
            { type: 'recon', y: 1 },
            { type: 'recon', y: 1 }
          ]
        }
      ],
      divisions: [
        ...o.divisions,
        newDivision(o, land(), { template: 'No existe' }),
        newDivision(o, sea(), { template: 'Infantería' })
      ]
    }))
    const m = validateOob(p, map).map((i) => i.message)
    expect(m.some((x) => /"Vacía" necesita al menos un batallón/.test(x))).toBe(true)
    expect(m.some((x) => /fuera de la cuadrícula de 5×5/.test(x))).toBe(true)
    expect(m.some((x) => /dos batallones en la posición 0,0/.test(x))).toBe(true)
    expect(m.some((x) => /apoyo fuera de la columna/.test(x))).toBe(true)
    expect(m.some((x) => /dos compañías de apoyo en la posición 1/.test(x))).toBe(true)
    expect(m.some((x) => /"No existe" no existe/.test(x))).toBe(true)
    expect(m.some((x) => /provincia de tierra/.test(x))).toBe(true)
    // un OOB correcto no da errores
    expect(validateOob(withOob()).filter((i) => i.severity === 'error')).toEqual([])
  })

  it('validador con datos del juego: batallón y equipo inexistentes; aviso de reemplazo', () => {
    const p = withOob('existente')
    const game = {
      subUnits: [
        { id: 'infantry', group: 'infantry' },
        { id: 'engineer', group: 'support' }
      ],
      equipments: ['infantry_equipment_1']
    } as never
    const m = validateOob(p, null, game)
    expect(m.some((i) => /artillery_brigade, que no existe/.test(i.message))).toBe(true)
    expect(
      m.some((i) => /reemplaza TODO el ejército/.test(i.message) && i.severity === 'aviso')
    ).toBe(true)
    expect(unitLists(game)).toEqual({ combat: ['infantry'], support: ['engineer'] })
  })

  it('lee batallones y equipos del juego', () => {
    expect(
      parseSubUnits(`sub_units = {
  infantry = { group = infantry max_organisation = 60 }
  engineer = { group = support }
}`)
    ).toEqual([
      { id: 'infantry', group: 'infantry' },
      { id: 'engineer', group: 'support' }
    ])
    expect(
      parseEquipments(`equipments = {
  infantry_equipment = { is_archetype = yes }
  infantry_equipment_1 = { archetype = infantry_equipment }
}`)
    ).toEqual(['infantry_equipment_1'])
  })
})

describe('Ejército: solo unidades terrestres, nombres e íconos del juego', () => {
  const gameDir = (): string => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-units-'))
    const w = (rel: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(g, rel)), { recursive: true })
      fs.writeFileSync(path.join(g, rel), text)
    }
    w('common/country_tags/00_countries.txt', 'GER = "countries/Germany.txt"\n')
    w(
      'common/units/infantry.txt',
      `sub_units = {
  infantry = { sprite = infantry map_icon_category = infantry type = infantry group = infantry }
  motorized = { sprite = motorized type = motorized group = mobile }
  light_armor = { sprite = light_armor type = armor group = armor }
  artillery_brigade = { sprite = artillery map_icon_category = infantry type = { infantry artillery } group = combat_support }
  engineer = { sprite = engineer group = support }
  destroyer = { sprite = destroyer map_icon_category = ship type = screen_ship }
  fighter = { sprite = fighter type = fighter }
}`
    )
    w(
      'interface/units.gfx',
      `spriteTypes = {
  spriteType = { name = "GFX_unit_infantry_icon_medium" texturefile = "gfx/interface/units/infantry.dds" noOfFrames = 2 }
  spriteType = { name = "GFX_unit_engineer_icon_medium" texturefile = "gfx/interface/units/engineer.dds" }
}`
    )
    // El archivo del juego trae BOM; el español gana sobre el inglés
    fs.mkdirSync(path.join(g, 'localisation', 'spanish'), { recursive: true })
    fs.writeFileSync(
      path.join(g, 'localisation', 'spanish', 'units_l_spanish.yml'),
      '\uFEFFl_spanish:\n infantry:0 "Infantería"\n light_armor:0 "Tanque ligero"\n',
      'utf-8'
    )
    fs.mkdirSync(path.join(g, 'localisation', 'english'), { recursive: true })
    fs.writeFileSync(
      path.join(g, 'localisation', 'english', 'units_l_english.yml'),
      '\uFEFFl_english:\n infantry:0 "Infantry"\n engineer:0 "Engineer"\n destroyer:0 "Destroyer"\n',
      'utf-8'
    )
    return g
  }

  it('reconoce la categoría terrestre y deja fuera las aéreas y navales', () => {
    expect(unitCategory({ group: 'infantry' })).toBe('infantry')
    expect(unitCategory({ group: 'mobile' })).toBe('mobile')
    expect(unitCategory({ group: 'armor' })).toBe('armor')
    // los group reales de la artillería son combat_support, mobile_combat_support y armor_combat_support
    expect(unitCategory({ group: 'combat_support', type: 'infantry artillery' })).toBe('artillery')
    expect(unitCategory({ group: 'support' })).toBe('support')
    // aéreas y navales: sin group (o con un ícono de barco)
    expect(unitCategory({ group: '', type: 'fighter' })).toBeNull()
    expect(unitCategory({ group: '', type: 'screen_ship', mapIcon: 'ship' })).toBeNull()
    expect(unitCategory({ group: 'x', mapIcon: 'ship' })).toBeNull()
    // grupo desconocido: se decide por el tipo
    expect(unitCategory({ group: 'otro', type: 'cavalry' })).toBe('infantry')
    expect(unitCategory({ group: 'otro', type: 'raro' })).toBeNull()
  })

  it('el catálogo trae nombres (español antes que inglés) y el sprite de cada batallón', () => {
    const cat = readGameCatalog(gameDir())!
    const u = Object.fromEntries(cat.subUnits!.map((x) => [x.id, x]))
    expect(u.infantry.gfx).toBe('GFX_unit_infantry_icon_medium')
    expect(u.engineer.gfx).toBe('GFX_unit_engineer_icon_medium')
    expect(u.motorized.gfx ?? null).toBeNull()
    expect(cat.unitNames!.infantry).toEqual({ es: 'Infantería', en: 'Infantry' })
    expect(cat.unitNames!.engineer).toEqual({ en: 'Engineer' })
  })

  it('las listas solo traen terrestres, agrupadas por tipo y con su nombre del juego', () => {
    const cat = readGameCatalog(gameDir())! as never
    const ids = landUnits(cat).map((x) => x.id)
    expect(ids).not.toContain('destroyer')
    expect(ids).not.toContain('fighter')
    expect(unitLists(cat)).toEqual({
      combat: ['infantry', 'motorized', 'light_armor', 'artillery_brigade'],
      support: ['engineer']
    })
    const groups = unitGroups(cat)
    expect(groups.map((g) => g.label)).toEqual([
      'Infantería',
      'Móviles',
      'Blindados',
      'Artillería, antitanque y antiaérea',
      'Apoyo'
    ])
    const names = Object.fromEntries(landUnits(cat).map((x) => [x.id, x.name]))
    // español del juego → tabla propia → inglés → id legible
    expect(names.infantry).toBe('Infantería')
    expect(names.light_armor).toBe('Tanque ligero')
    expect(names.motorized).toBe('Motorizada')
    expect(names.engineer).toBe('Ingenieros')
  })

  it('sin la carpeta del juego usa la lista básica con nombres en español y tipos', () => {
    const all = landUnits(null)
    expect(all.find((x) => x.id === 'infantry')).toMatchObject({
      name: 'Infantería',
      category: 'infantry',
      gfx: null
    })
    expect(all.find((x) => x.id === 'light_armor')?.category).toBe('armor')
    expect(all.find((x) => x.id === 'engineer')?.category).toBe('support')
    expect(unitName('algo_raro')).toBe('Algo raro')
  })

  it('lee solo los textos pedidos de un .yml y propone nombres de sprite', () => {
    const m = parseUnitNames(
      'l_english:\n infantry:0 "Infantry"\n otra:0 "x"\n engineer: "Engineer"\n',
      new Set(['infantry', 'engineer'])
    )
    expect([...m.entries()]).toEqual([
      ['infantry', 'Infantry'],
      ['engineer', 'Engineer']
    ])
    expect(unitSpriteCandidates({ id: 'infantry', sprite: 'infantry' })[0]).toBe(
      'GFX_unit_infantry_icon_medium'
    )
  })

  it('las plantillas de arranque omiten los batallones que el juego no tiene', () => {
    const o = { country: 'NVG', templates: [], divisions: [], production: [] }
    const blank = templateFromPreset(o, 'blank', 'Vacía')
    expect(blank.regiments).toEqual([])
    const inf = templateFromPreset(o, 'infantry', 'Inf')
    expect(inf.regiments.filter((r) => r.type === 'infantry')).toHaveLength(7)
    expect(DIVISION_PRESETS.map((x) => x.id)).toEqual(['blank', 'infantry', 'motorized', 'armor'])
    const cat = readGameCatalog(gameDir())! as never
    const inGame = templateFromPreset(o, 'infantry', 'Inf', cat)
    // el juego de prueba tiene artillery_brigade e infantry; sí hay ingenieros (apoyo)
    expect(inGame.regiments.some((r) => r.type === 'artillery_brigade')).toBe(true)
    expect(inGame.support).toEqual([{ type: 'engineer', y: 0 }])
    const armor = templateFromPreset(o, 'armor', 'Bl', cat)
    // medium_armor no existe en ese juego: no se agrega
    expect(armor.regiments.some((r) => r.type === 'medium_armor')).toBe(false)
  })
})

describe('íconos reales de los batallones (subuniticons.gfx)', () => {
  const cc = (t: string): number =>
    t.charCodeAt(0) | (t.charCodeAt(1) << 8) | (t.charCodeAt(2) << 16) | (t.charCodeAt(3) << 24)
  /** DDS sin FourCC con máscaras BGRA de 32 bits; mitad izquierda roja, derecha azul */
  const raw = (w: number, h: number): Buffer => {
    const b = Buffer.alloc(128 + w * h * 4)
    b.writeUInt32LE(0x20534444, 0)
    b.writeUInt32LE(h, 12)
    b.writeUInt32LE(w, 16)
    b.writeUInt32LE(32, 76)
    b.writeUInt32LE(0x41, 80) // RGB + alfa, sin FourCC
    b.writeUInt32LE(32, 88)
    b.writeUInt32LE(0xff0000, 92)
    b.writeUInt32LE(0xff00, 96)
    b.writeUInt32LE(0xff, 100)
    b.writeUInt32LE(0xff000000, 104)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = 128 + (y * w + x) * 4
        if (x < w / 2) b[o + 2] = 255
        else b[o] = 255
        b[o + 3] = 255
      }
    return b
  }
  const bc7 = (): Buffer => {
    const b = Buffer.alloc(128 + 64)
    b.writeUInt32LE(0x20534444, 0)
    b.writeUInt32LE(8, 12)
    b.writeUInt32LE(8, 16)
    b.writeUInt32LE(4, 80)
    b.writeUInt32LE(cc('DX10'), 84)
    return b
  }
  const mk = (): string => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-unit-ico-'))
    const w = (rel: string, data: Buffer | string): void => {
      fs.mkdirSync(path.dirname(path.join(g, rel)), { recursive: true })
      fs.writeFileSync(path.join(g, rel), data)
    }
    w('common/country_tags/00.txt', 'GER = "countries/Germany.txt"\n')
    w(
      'common/units/a.txt',
      `sub_units = {
  infantry = { sprite = infantry group = infantry }
  amphibious_armor = { sprite = amphibious_armor group = armor }
  odd = { sprite = odd group = armor }
}`
    )
    w(
      'interface/subuniticons.gfx',
      `spriteTypes = {
  spriteType = { name = "GFX_unit_infantry_icon_medium" textureFile = "gfx//interface//counters/Divisions_Large/unit_infantry_icon.dds" noOfFrames = 2 }
  spriteType = { name = "GFX_unit_amphibious_armor_icon_medium" textureFile = "gfx/interface/counters/divisions_large/unit_amphibious_tank_icon.dds" noOfFrames = 2 }
  spriteType = { name = "GFX_unit_odd_icon_medium" textureFile = "gfx/interface/counters/divisions_large/odd.dds" noOfFrames = 2 }
}`
    )
    w('gfx/interface/counters/divisions_large/unit_infantry_icon.dds', raw(16, 8))
    w('gfx/interface/counters/divisions_large/unit_amphibious_tank_icon.dds', raw(16, 8))
    w('gfx/interface/counters/divisions_large/odd.dds', bc7())
    return g
  }

  it('resuelve GFX_unit_<sprite>_icon_medium con la ruta del .gfx, aunque el archivo tenga otro nombre', () => {
    const cat = readGameCatalog(mk())!
    const u = Object.fromEntries(cat.subUnits!.map((x) => [x.id, x.gfx]))
    expect(u.infantry).toBe('GFX_unit_infantry_icon_medium')
    expect(u.amphibious_armor).toBe('GFX_unit_amphibious_armor_icon_medium')
  })

  it('la miniatura recorta el primer cuadro, normaliza "//" y mayúsculas, y un formato no soportado da null', () => {
    const g = mk()
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-cache-'))
    const a = spriteThumb(g, cache, 'GFX_unit_infantry_icon_medium')!
    // el primer cuadro (mitad izquierda) es rojo: el PNG no es del color azul de la derecha
    expect(a).toMatch(/^data:image\/png;base64,/)
    expect(spriteThumb(g, cache, 'GFX_unit_amphibious_armor_icon_medium')).toMatch(/^data:image/)
    expect(spriteThumb(g, cache, 'GFX_unit_odd_icon_medium')).toBeNull()
  })

  it('el decodificador sin FourCC lee las máscaras y el primer cuadro es el izquierdo', () => {
    const r = decodeDds(new Uint8Array(raw(16, 8)))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = thumbnail(r.image, 8, 2)
    expect(t.width).toBe(8)
    expect([...t.rgba.slice(0, 4)]).toEqual([255, 0, 0, 255])
    expect(decodeDds(new Uint8Array(bc7())).ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
// Ronda del ejército: íconos por ID, .gfx tolerante y reconocer bien las unidades terrestres.
// Los fixtures los escribí yo imitando el FORMATO real (grupos, type como bloque, .gfx sin comillas);
// no hay texto del juego aquí.
// ---------------------------------------------------------------------------------------------
describe('ronda del ejército: íconos por ID, .gfx tolerante y unidades terrestres', () => {
  const armyGame = (): string => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-army-'))
    const w = (rel: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(g, rel)), { recursive: true })
      fs.writeFileSync(path.join(g, rel), text)
    }
    w('common/country_tags/00_countries.txt', 'GER = "countries/Germany.txt"\n')
    // Cada archivo tiene su propio sub_units. `type` puede ser un valor o un bloque.
    w(
      'common/units/infantry.txt',
      `sub_units = {
\tinfantry = {
\t\tsprite = infantry
\t\tmap_icon_category = infantry
\t\ttype = infantry
\t\tgroup = infantry
\t}
}`
    )
    w(
      'common/units/artillery_brigade.txt',
      `sub_units = {
\tartillery_brigade = {
\t\tsprite = artillery
\t\tmap_icon_category = infantry
\t\ttype = { infantry artillery }
\t\tgroup = combat_support
\t\tcombat_width = 2
\t}
}`
    )
    w(
      'common/units/artillery.txt',
      `sub_units = {
\tartillery = {
\t\tsprite = artillery
\t\tmap_icon_category = infantry
\t\ttype = { infantry support }
\t\tgroup = support
\t}
}`
    )
    w(
      'common/units/motorized.txt',
      `sub_units = {
\tmot_artillery_brigade = {
\t\tsprite = artillery
\t\tmap_icon_category = infantry
\t\ttype = { motorized artillery }
\t\tgroup = mobile_combat_support
\t}
\tlight_sp_artillery_brigade = {
\t\tsprite = light_sp_artillery
\t\tmap_icon_category = armored
\t\ttype = { armor artillery }
\t\tgroup = armor_combat_support
\t}
\tlight_tank_destroyer_support = {
\t\tsprite = light_tank_destroyer
\t\tmap_icon_category = armored
\t\ttype = { support armor anti_tank }
\t\tgroup = support
\t}
\tfalta_el_icono = {
\t\tsprite = infantry
\t\tmap_icon_category = infantry
\t\ttype = infantry
\t\tgroup = infantry
\t}
\tsin_ningun_icono = {
\t\tsprite = nada_de_nada
\t\tmap_icon_category = infantry
\t\ttype = infantry
\t\tgroup = infantry
\t}
}`
    )
    // Aéreas, navales y cañones de tren: sin group (o con map_icon_category = ship)
    w(
      'common/units/air.txt',
      `sub_units = {
\tfighter = { sprite = fighter type = fighter }
\tstrat_bomber = { sprite = bomber type = strategic_bomber }
\tguided_missile = { sprite = missile type = missile }
}`
    )
    w(
      'common/units/destroyer.txt',
      `sub_units = {
\tdestroyer = { sprite = destroyer map_icon_category = ship type = screen_ship }
\tcarrier = { sprite = carrier map_icon_category = ship type = carrier }
\tsubmarine = { sprite = submarine map_icon_category = ship type = submarine }
\trailway_gun = { sprite = railway_gun map_icon_category = other type = railway_gun }
}`
    )
    w(
      'interface/subuniticons.gfx',
      `spriteTypes = {
\tspriteType = { name = "GFX_unit_infantry_icon_medium" textureFile = "gfx/interface/counters/divisions_large/unit_inf_icon.dds" noOfFrames = 2 }
\tspriteType = { name = "GFX_unit_artillery_brigade_icon_medium" textureFile = "gfx/interface/counters/divisions_large/unit_art_icon.dds" noOfFrames = 2 }
\tspriteType = { name = "GFX_unit_artillery_icon_medium" textureFile = "gfx/interface/counters/divisions_large/support_unit_art_icon.dds" noOfFrames = 2 }
\tspriteType = { name = "GFX_unit_mot_artillery_brigade_icon_medium" textureFile = "gfx/interface/counters/divisions_large/unit_mot_art_icon.dds" noOfFrames = 2 }
\tspriteType = { name = "GFX_unit_light_sp_artillery_brigade_icon_medium" textureFile = "gfx/interface/counters/divisions_large/unit_sp_art_icon.dds" noOfFrames = 2 }
\t# comentario en medio
\tspriteType = { name = "GFX_unit_light_tank_destroyer_support_icon_medium" textureFile = gfx/interface/counters/divisions_large/support_unit_light_td_icon.dds noOfFrames = 2}
}`
    )
    return g
  }

  it('lee un .gfx con ruta sin comillas, llave pegada ("2}"), tabuladores y comentarios', () => {
    const sprites = parseGfxSprites(
      `spriteTypes = {
\tspriteType = { name = "GFX_a_icon_medium" textureFile = gfx/interface/counters/a.dds noOfFrames = 2}
\tspriteType = {
\t\tname = GFX_b_icon_medium\t# nombre sin comillas
\t\tTextureFile = "gfx//interface//b.dds"\t
\t\tnoOfFrames=2}
\tspriteType = { name = "GFX_c_icon_medium" textureFile = "gfx/interface/c.dds" }
\tspriteType = { name = "GFX_sin_textura" }
}`
    )
    expect(sprites).toEqual([
      { name: 'GFX_a_icon_medium', texture: 'gfx/interface/counters/a.dds', frames: 2 },
      { name: 'GFX_b_icon_medium', texture: 'gfx/interface/b.dds', frames: 2 },
      { name: 'GFX_c_icon_medium', texture: 'gfx/interface/c.dds', frames: 1 }
    ])
  })

  it('el ícono se busca por el ID de la unidad y solo después por su sprite', () => {
    expect(unitSpriteCandidates({ id: 'artillery_brigade', sprite: 'artillery' })).toEqual([
      'GFX_unit_artillery_brigade_icon_medium',
      'GFX_unit_artillery_icon_medium'
    ])
    const cat = readGameCatalog(armyGame())!
    const gfx = Object.fromEntries(cat.subUnits!.map((u) => [u.id, u.gfx ?? null]))
    // artillería de línea ≠ artillería de apoyo (aunque las dos tengan sprite = artillery)
    expect(gfx.artillery_brigade).toBe('GFX_unit_artillery_brigade_icon_medium')
    expect(gfx.artillery).toBe('GFX_unit_artillery_icon_medium')
    // el nombre del ícono usa el ID, no el campo sprite
    expect(gfx.mot_artillery_brigade).toBe('GFX_unit_mot_artillery_brigade_icon_medium')
    expect(gfx.light_sp_artillery_brigade).toBe('GFX_unit_light_sp_artillery_brigade_icon_medium')
    // respaldo: sin ícono con su ID, el del sprite
    expect(gfx.falta_el_icono).toBe('GFX_unit_infantry_icon_medium')
    // sin ninguno: ícono genérico por tipo (gfx null)
    expect(gfx.sin_ningun_icono).toBeNull()
  })

  it('el apoyo de cazacarros con la línea sin comillas del .gfx ya tiene su ícono', () => {
    const cat = readGameCatalog(armyGame())!
    const td = cat.subUnits!.find((u) => u.id === 'light_tank_destroyer_support')
    expect(td?.gfx).toBe('GFX_unit_light_tank_destroyer_support_icon_medium')
  })

  it('lee type como valor o como bloque { … }', () => {
    const u = parseSubUnits(
      `sub_units = {
\ta = { type = infantry group = infantry }
\tb = {
\t\tsprite = artillery
\t\ttype = { infantry artillery }
\t\tgroup = combat_support
\t\tmap_icon_category = infantry
\t}
\tc = { group = support }
}`
    )
    expect(u).toEqual([
      { id: 'a', group: 'infantry', type: 'infantry' },
      {
        id: 'b',
        group: 'combat_support',
        type: 'infantry artillery',
        mapIcon: 'infantry',
        sprite: 'artillery'
      },
      { id: 'c', group: 'support' }
    ])
  })

  it('reconoce la categoría con group (incluidos los *_combat_support), type y map_icon_category', () => {
    const c = unitCategory
    expect(c({ group: 'combat_support', type: 'infantry artillery', mapIcon: 'infantry' })).toBe(
      'artillery'
    )
    expect(c({ group: 'mobile_combat_support', type: 'motorized artillery' })).toBe('artillery')
    expect(c({ group: 'armor_combat_support', type: 'armor artillery', mapIcon: 'armored' })).toBe(
      'artillery'
    )
    expect(c({ group: 'armor_combat_support', type: 'armor anti_tank' })).toBe('artillery')
    expect(c({ group: 'support', type: 'support armor anti_tank' })).toBe('support')
    expect(c({ group: 'armor', type: 'armor' })).toBe('armor')
    expect(c({ group: 'mobile', type: 'motorized' })).toBe('mobile')
    // aéreas, misiles, barcos y cañones de tren: sin group
    expect(c({ group: '', type: 'fighter' })).toBeNull()
    expect(c({ group: '', type: 'missile' })).toBeNull()
    expect(c({ group: '', type: 'screen_ship', mapIcon: 'ship' })).toBeNull()
    expect(c({ group: '', type: 'railway_gun', mapIcon: 'other' })).toBeNull()
    // un group que no conocemos: se decide por type y map_icon_category
    expect(c({ group: 'otro_apoyo', type: 'support infantry', mapIcon: 'infantry' })).toBe(
      'support'
    )
    expect(c({ group: 'otro', type: 'armor artillery', mapIcon: 'armored' })).toBe('artillery')
    expect(c({ group: 'otro', type: 'carrier', mapIcon: 'ship' })).toBeNull()
    expect(c({ group: 'otro', type: 'raro' })).toBeNull()
  })

  it('artillery_brigade (combat_support) existe y es terrestre; no sale el aviso falso', () => {
    const cat = readGameCatalog(armyGame())!
    expect(cat.subUnits!.find((u) => u.id === 'artillery_brigade')).toMatchObject({
      group: 'combat_support',
      type: 'infantry artillery'
    })
    const land = landUnits(cat).map((u) => u.id)
    expect(land).toContain('artillery_brigade')
    expect(unitLists(cat).combat).toContain('artillery_brigade')
    // una plantilla con artillería de línea (dos veces) y un cazacarros de apoyo
    let p = withOob()
    p = updateOob(p, 'NVG', (o) => ({
      ...o,
      templates: [
        {
          name: 'Infantería',
          regiments: [
            { type: 'infantry', x: 0, y: 0 },
            { type: 'artillery_brigade', x: 1, y: 0 },
            { type: 'artillery_brigade', x: 1, y: 1 }
          ],
          support: [{ type: 'light_tank_destroyer_support', y: 0 }]
        }
      ],
      divisions: []
    }))
    const m = validateOob(p, null, cat).map((i) => i.message)
    expect(m.filter((x) => /que no existe/.test(x))).toEqual([])
  })

  it('no se cuelan aéreas ni navales y no falta ninguna terrestre', () => {
    const cat = readGameCatalog(armyGame())!
    const land = landUnits(cat).map((u) => u.id)
    for (const x of [
      'fighter',
      'strat_bomber',
      'guided_missile',
      'destroyer',
      'carrier',
      'submarine',
      'railway_gun'
    ])
      expect(land).not.toContain(x)
    expect(land.sort()).toEqual(
      [
        'infantry',
        'artillery_brigade',
        'artillery',
        'mot_artillery_brigade',
        'light_sp_artillery_brigade',
        'light_tank_destroyer_support',
        'falta_el_icono',
        'sin_ningun_icono'
      ].sort()
    )
    const byCategory = Object.fromEntries(landUnits(cat).map((u) => [u.id, u.category]))
    expect(byCategory.artillery_brigade).toBe('artillery')
    expect(byCategory.light_sp_artillery_brigade).toBe('artillery')
    expect(byCategory.artillery).toBe('support')
  })

  it('una unidad aérea o naval existe en el juego pero no cabe en una división: aviso distinto', () => {
    const cat = readGameCatalog(armyGame())!
    let p = withOob()
    p = updateOob(p, 'NVG', (o) => ({
      ...o,
      templates: [
        {
          name: 'Rara',
          regiments: [
            { type: 'fighter', x: 0, y: 0 },
            { type: 'no_existe_nunca', x: 0, y: 1 }
          ],
          support: []
        }
      ],
      divisions: []
    }))
    const m = validateOob(p, null, cat).map((i) => i.message)
    expect(m.some((x) => /fighter, que no es una unidad terrestre/.test(x))).toBe(true)
    expect(m.some((x) => /no_existe_nunca, que no existe en el juego/.test(x))).toBe(true)
    expect(m.some((x) => /fighter, que no existe/.test(x))).toBe(false)
  })

  it('la exportación de una plantilla sale idéntica con o sin los datos del juego', () => {
    const p = withOob()
    const text = oobText('NVG', p.oobs[0])
    expect(text.trimEnd()).toBe(FIXTURE.trimEnd())
    // el catálogo solo valida y muestra íconos: no cambia ni una letra del script
    expect(oobText('NVG', p.oobs[0])).toBe(text)
    expect(sectionFiles(p).files.find((f) => f.path.includes('history/units'))?.text).toBe(text)
  })
})
