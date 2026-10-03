import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import {
  hasOob,
  newDivision,
  newTemplate,
  oobFiles,
  oobText,
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
import { parseEquipments, parseSubUnits } from '../src/shared/gameUnits'
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
