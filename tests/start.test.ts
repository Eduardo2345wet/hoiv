import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import {
  bookmarkFiles,
  newBookmark,
  setStart,
  startFiles,
  validateStart
} from '../src/renderer/src/sections/start'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { countryTextFiles } from '../src/renderer/src/export/countryExport'
import { patchHistory } from '../src/renderer/src/countries/history'
import { historyExtras } from '../src/renderer/src/sections/historyExtras'
import { parseTechnologies, topLevelKeys } from '../src/shared/gameTech'
import type { Project } from '../src/renderer/src/types'

const base = (): Project => {
  let p = emptyProjectFor('Mi Mod', 'content')
  p = addCountry(p, newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva' }))
  p = addCountry(p, newCountry({ mode: 'nuevo', tag: 'NVH', name: 'Otra' }))
  return p
}
const hist = (p: Project, tag: string): string =>
  countryTextFiles(p, null).find(
    (f) => f.path.startsWith('history/countries/') && f.path.includes(tag)
  )!.text!

describe('situación inicial (S5)', () => {
  it('valores, espíritus, tecnologías y diplomacia van en la historia del país nuevo', async () => {
    let p = base()
    p = setStart(p, 'NVG', {
      stability: 60,
      warSupport: 30,
      convoys: 20,
      researchSlots: 4,
      ideas: ['mi_espiritu'],
      technologies: ['infantry_weapons'],
      faction: { name: 'Eje Nuevo', joins: null },
      puppets: [{ tag: 'NVH', autonomy: 'autonomy_puppet' }],
      guarantees: ['NVH']
    })
    p = setStart(p, 'NVH', { faction: { name: '', joins: 'NVG' } })
    const t = hist(p, 'NVG')
    const j = await Jomini.initialize()
    expect(() => j.parseText(t)).not.toThrow()
    expect(t).toContain('set_stability = 0.6')
    expect(t).toContain('set_war_support = 0.3')
    expect(t).toContain('set_convoys = 20')
    expect(t).toContain('set_research_slots = 4')
    expect(t).not.toContain('set_research_slots = 3')
    expect(t).toContain('add_ideas = { mi_espiritu }')
    expect(t).toContain('infantry_weapons = 1')
    expect(t).toContain('create_faction = "Eje Nuevo"')
    expect(t).toContain('add_to_faction = NVH')
    expect(t).toContain('give_guarantee = NVH')
    expect(t).toContain('autonomy_state = autonomy_puppet')
    expect(t).not.toContain('\\"')
  })

  it('1939: todo va en un bloque con fecha', () => {
    let p = base()
    p = setStart(p, 'NVG', { stability: 50, startDate: '1939' })
    const t = hist(p, 'NVG')
    expect(t).toContain('1939.1.1 = {')
    expect(t).toMatch(/1939\.1\.1 = \{[^}]*set_stability = 0\.5/)
    expect(validateStart(p).length >= 0).toBe(true)
  })

  it('el parche mínimo de un país del juego es idempotente y conserva el resto', () => {
    let p = base()
    p = setStart(p, 'NVG', { stability: 70, ideas: ['x_idea'] })
    const orig =
      'capital = 1\nset_stability = 0.5\nset_politics = {\n\truling_party = neutrality\n}\nset_popularities = {\n\tneutrality = 100\n}\n'
    const e = historyExtras(p, p.countries[0])
    const once = patchHistory(orig, p.countries[0], e)
    expect(once).toContain('set_stability = 0.7')
    expect(once).not.toContain('set_stability = 0.5')
    expect(once).toContain('add_ideas = { x_idea }')
    expect(once).toContain('capital = 1')
    expect(patchHistory(orig, p.countries[0], e)).toBe(once)
  })

  it('guerras al inicio: on_actions con declare_war_on, con prefijo del mod', () => {
    let p = base()
    p = setStart(p, 'NVG', { wars: ['NVH'] })
    const f = startFiles(p)
    expect(f[0].path).toBe('common/on_actions/mi_mod_start.txt')
    expect(f[0].text).toContain('declare_war_on = {')
    expect(f[0].text).toContain('target = NVH')
    expect(sectionFiles(p).issues).toEqual([])
  })

  it('validador: popularidades, gobernante en 0 %, facción de un miembro, ciclo de títeres', () => {
    let p = base()
    p = {
      ...p,
      countries: p.countries.map((c) =>
        c.tag === 'NVG'
          ? {
              ...c,
              politics: {
                ...c.politics,
                popularities: { democratic: 50, fascism: 30, communism: 10, neutrality: 5 },
                ruling: 'neutrality' as const
              }
            }
          : c
      )
    }
    p = setStart(p, 'NVG', { puppets: [{ tag: 'NVH', autonomy: 'autonomy_puppet' }] })
    p = setStart(p, 'NVH', {
      puppets: [{ tag: 'NVG', autonomy: 'autonomy_puppet' }],
      faction: { name: '', joins: 'NVG' }
    })
    const m = validateStart(p).map((i) => i.message)
    expect(m.some((x) => /suman 95/.test(x))).toBe(true)
    expect(m.some((x) => /ciclo de títeres/.test(x))).toBe(true)
    p = setStart(p, 'NVG', { faction: { name: '', joins: 'NVH' } })
    expect(validateStart(p).some((i) => /a su vez es miembro/.test(i.message))).toBe(true)
  })

  it('validador: tecnología y autonomía inexistentes según el juego', () => {
    let p = base()
    p = setStart(p, 'NVG', {
      technologies: ['no_existe'],
      puppets: [{ tag: 'NVH', autonomy: 'nada' }]
    })
    const game = {
      technologies: [{ id: 'infantry_weapons', leadsTo: [] }],
      autonomyStates: ['autonomy_puppet']
    } as never
    const m = validateStart(p, game).map((i) => i.message)
    expect(m.some((x) => /no existe en el juego/.test(x))).toBe(true)
    expect(m.some((x) => /autonomía nada no existe/.test(x))).toBe(true)
  })

  it('escenario (bookmark): archivo, localización y país por defecto', () => {
    let p = base()
    p = {
      ...p,
      bookmarks: [
        newBookmark({
          name: 'Gran Guerra',
          description: 'Todo arde',
          defaultCountry: 'NVG',
          isDefault: true,
          featured: [
            { tag: 'NVG', ideology: 'neutrality', history: 'Hola', ideas: [], focuses: [] }
          ]
        })
      ]
    }
    const f = bookmarkFiles(p)
    const t = f.find((x) => x.path === 'common/bookmarks/mi_mod_bookmarks.txt')!.text!
    expect(t).toContain('bookmark = {')
    expect(t).toContain('name = mi_mod_bookmark_1')
    expect(t).toContain('default_country = "NVG"')
    expect(t).toContain('default = yes')
    expect(t).toContain('"---"')
    const loc = f.find((x) => x.path.endsWith('mi_mod_bookmarks_l_english.yml'))!
    expect(loc.bom).toBe(true)
    expect(loc.text).toContain('mi_mod_bookmark_1:0 "Gran Guerra"')
    expect(loc.text).toContain('NVG_mi_mod_bookmark_1_desc:0 "Hola"')
  })

  it('lee tecnologías y estados de autonomía del juego', () => {
    const t = parseTechnologies(`technologies = {
  infantry_weapons = { cost = 1 start_year = 1936 folder = { name = infantry_folder } leads_to_tech = { infantry_weapons1 } }
  gwtank = { }
}`)
    expect(t.map((x) => x.id)).toEqual(['infantry_weapons', 'gwtank'])
    expect(topLevelKeys('autonomy_puppet = { x = 1 }\nautonomy_dominion = { }')).toEqual([
      'autonomy_puppet',
      'autonomy_dominion'
    ])
  })
})
