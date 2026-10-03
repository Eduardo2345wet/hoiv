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
  artillery_brigade = { sprite = artillery type = artillery group = artillery }
  engineer = { sprite = engineer group = support }
  destroyer = { sprite = destroyer map_icon_category = ship type = naval group = ships }
  fighter = { sprite = fighter map_icon_category = air type = air group = air }
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
    expect(unitCategory({ group: 'artillery' })).toBe('artillery')
    expect(unitCategory({ group: 'support' })).toBe('support')
    expect(unitCategory({ group: 'ships', type: 'naval' })).toBeNull()
    expect(unitCategory({ group: 'air', mapIcon: 'air' })).toBeNull()
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
