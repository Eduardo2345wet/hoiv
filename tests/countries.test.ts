// Pruebas de países: color, popularidades, tags, TGA, exportación, existentes, migración y deshacer
import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { mapColor, rgbToHsv, hsvToRgb } from '../src/renderer/src/countries/color'
import {
  balancePopularities,
  sumPopularities,
  type Popularities
} from '../src/renderer/src/countries/politics'
import { suggestTag } from '../src/renderer/src/countries/tags'
import { FORBIDDEN_TAGS, TAG_REGEX, validateProject } from '../src/renderer/src/export/validator'
import { writeTGA } from '../src/renderer/src/export/images'
import {
  addCountry,
  createTreeForCountry,
  deleteCountry,
  newCountry,
  newLeader,
  updateCountry
} from '../src/renderer/src/countries/countryOps'
import { buildExtraFiles } from '../src/renderer/src/export/exportMod'
import { countryTextFiles } from '../src/renderer/src/export/countryExport'
import { parseHistory, patchHistory } from '../src/renderer/src/countries/history'
import { generateLocalisation } from '../src/renderer/src/generator/focusTree'
import { migrateProject } from '../src/renderer/src/migrate'
import { handleExportMod } from '../src/main/export'
import { parseState, parseSubideologies } from '../src/main/game'
import { store } from '../src/renderer/src/store/appStore'
import { setPlaceholderRenderers } from '../src/renderer/src/icons/renderer'
import { createFocus } from '../src/renderer/src/ui/projectOps'
import type { Country, Project } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

setPlaceholderRenderers({ flag: (t) => `fake-flag:${t}`, portrait: (n) => `fake-portrait:${n}` })

/** Lector falso: devuelve píxeles del tamaño pedido */
const fakeRead = async (_png: string, w: number, h: number) => ({
  width: w,
  height: h,
  rgba: new Uint8Array(w * h * 4)
})
const fakeDecode = async () => ({ width: 100, height: 88, rgba: new Uint8Array(100 * 88 * 4) })

/** País nuevo completo: Nueva Granada (NVG) con líder y árbol de focos */
function newCountryProject(): { project: Project; country: Country } {
  let p = emptyProject()
  const c = newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' })
  c.names.adj = 'granadino'
  c.names.def = 'la República de Nueva Granada'
  c.capital = 64
  c.politics.ruling = 'democratic'
  c.politics.popularities = { democratic: 55, fascism: 5, communism: 10, neutrality: 30 }
  const leader = newLeader('Juan Pérez', 'democratic')
  leader.subideology = 'liberalism'
  const reserve = newLeader('Ana Ruiz', 'communism', [leader.id])
  reserve.subideology = 'marxism'
  c.leaders = [reserve, leader]
  p = addCountry(p, c)
  const r = createTreeForCountry(p, c.uid)
  p = createFocus(r.project, 0, 0, 'Industrializar', r.treeId).project
  return { project: p, country: p.countries.find((x) => x.uid === c.uid)! }
}

describe('color apagado del mapa', () => {
  it('rojo puro → HSV (0,1,1) → s×0.6, v×0.8', () => {
    expect(rgbToHsv([255, 0, 0])).toEqual([0, 1, 1])
    expect(mapColor([255, 0, 0])).toEqual([204, 82, 82])
  })
  it('ida y vuelta RGB→HSV→RGB', () => {
    for (const c of [
      [12, 200, 90],
      [255, 255, 255],
      [0, 0, 0],
      [30, 60, 240]
    ] as [number, number, number][])
      expect(hsvToRgb(rgbToHsv(c))).toEqual(c)
  })
})

describe('balancear popularidades', () => {
  const cases: [Popularities, keyof Popularities][] = [
    [{ democratic: 50, fascism: 50, communism: 50, neutrality: 50 }, 'democratic'],
    [{ democratic: 30, fascism: 0, communism: 0, neutrality: 0 }, 'democratic'],
    [{ democratic: 100, fascism: 20, communism: 20, neutrality: 20 }, 'democratic'],
    [{ democratic: 0, fascism: 33, communism: 33, neutrality: 33 }, 'democratic'],
    [{ democratic: 1, fascism: 1, communism: 1, neutrality: 1 }, 'neutrality'],
    [{ democratic: 10, fascism: 17, communism: 23, neutrality: 71 }, 'communism'],
    [{ democratic: 150, fascism: -5, communism: 3, neutrality: 7 }, 'democratic']
  ]
  it.each(cases)('%o fijando %s suma 100 con enteros', (pops, fixed) => {
    const out = balancePopularities(pops, fixed)
    expect(sumPopularities(out)).toBe(100)
    for (const v of Object.values(out)) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
    expect(out[fixed]).toBe(Math.max(0, Math.min(100, pops[fixed])))
  })
  it('reparte en proporción', () => {
    expect(
      balancePopularities(
        { democratic: 40, fascism: 10, communism: 20, neutrality: 30 },
        'democratic'
      )
    ).toEqual({
      democratic: 40,
      fascism: 10,
      communism: 20,
      neutrality: 30
    })
    expect(
      balancePopularities(
        { democratic: 60, fascism: 10, communism: 20, neutrality: 30 },
        'democratic'
      )
    ).toEqual({
      democratic: 60,
      fascism: 7,
      communism: 13,
      neutrality: 20
    })
  })
})

describe('tag automático', () => {
  it('no choca con reservados ni con tags usados', () => {
    const taken = ['NVG', 'NVA', 'MEX']
    const t = suggestTag('Nueva Granada', taken)
    expect(TAG_REGEX.test(t)).toBe(true)
    expect(taken).not.toContain(t)
    for (const name of ['Not', 'Tag', 'Red', 'Log', 'Num', 'And', 'Oob'])
      expect(FORBIDDEN_TAGS).not.toContain(suggestTag(name, []))
    expect(suggestTag('Nueva Granada', [])).toBe('NVG')
    expect(suggestTag('', [])).toMatch(TAG_REGEX)
  })
  it('sigue encontrando uno libre aunque casi todo esté ocupado', () => {
    const taken: string[] = []
    for (let n = 0; n < 100; n++) taken.push(`N${String(n).padStart(2, '0')}`)
    const t = suggestTag('N', taken)
    expect(TAG_REGEX.test(t)).toBe(true)
    expect(taken).not.toContain(t)
  })
})

describe('escritor TGA', () => {
  it('cabecera de 18 bytes y tamaño para los 3 tamaños', () => {
    for (const [w, h] of [
      [82, 52],
      [41, 26],
      [10, 7]
    ]) {
      const tga = writeTGA(w, h, new Uint8Array(w * h * 4))
      expect(tga.length).toBe(18 + w * h * 4)
      expect([...tga.slice(0, 18)]).toEqual([
        0,
        0,
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        w & 255,
        w >> 8,
        h & 255,
        h >> 8,
        32,
        0x08
      ])
    }
  })
  it('un píxel rojo arriba a la izquierda queda al inicio de la ÚLTIMA fila del archivo', () => {
    const w = 82
    const h = 52
    const rgba = new Uint8Array(w * h * 4)
    rgba.set([255, 0, 0, 255], 0)
    const tga = writeTGA(w, h, rgba)
    const lastRow = 18 + (h - 1) * w * 4
    expect([...tga.slice(lastRow, lastRow + 4)]).toEqual([0, 0, 255, 255]) // BGRA
    expect([...tga.slice(18, 22)]).toEqual([0, 0, 0, 0])
  })
})

describe('exportación de un país nuevo', () => {
  it('genera todos los archivos con el formato correcto', async () => {
    const { project } = newCountryProject()
    const files = await buildExtraFiles(project, fakeDecode, fakeRead)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-pais-'))
    const res = await handleExportMod({
      exportPath: dir,
      modName: project.modName,
      tag: project.tag,
      focusTreeScript: '',
      locYaml: generateLocalisation(project),
      files
    })
    expect(res.success).toBe(true)
    const mod = path.join(dir, 'mi_mod')
    const read = (p: string): string => fs.readFileSync(path.join(mod, p), 'utf-8')

    // 15 banderas TGA
    const tgas: string[] = []
    for (const folder of ['gfx/flags', 'gfx/flags/medium', 'gfx/flags/small'])
      for (const f of fs.readdirSync(path.join(mod, folder)))
        if (f.endsWith('.tga')) tgas.push(`${folder}/${f}`)
    expect(tgas.filter((t) => t.includes('NVG'))).toHaveLength(15)
    expect(fs.statSync(path.join(mod, 'gfx/flags/NVG_fascism.tga')).size).toBe(18 + 82 * 52 * 4)
    expect(fs.statSync(path.join(mod, 'gfx/flags/medium/NVG.tga')).size).toBe(18 + 41 * 26 * 4)
    expect(fs.statSync(path.join(mod, 'gfx/flags/small/NVG_neutrality.tga')).size).toBe(
      18 + 10 * 7 * 4
    )

    // Líder: DDS 156×210 y .gfx
    expect(fs.statSync(path.join(mod, 'gfx/leaders/NVG/juan_perez.dds')).size).toBe(
      128 + 156 * 210 * 4
    )
    const gfx = read('interface/mi_mod_leaders.gfx')
    expect(gfx).toContain('name = "GFX_NVG_juan_perez"')
    expect(gfx).toContain('texturefile = "gfx/leaders/NVG/juan_perez.dds"')

    // Personajes con nombre ÚNICO del mod (nunca NVG.txt)
    expect(fs.existsSync(path.join(mod, 'common/characters/NVG.txt'))).toBe(false)
    const chars = read('common/characters/mi_mod_NVG_characters.txt')
    expect(chars).toContain('\tNVG_juan_perez = {\n\t\tname = NVG_juan_perez')
    expect(chars).toContain('large = GFX_NVG_juan_perez')
    expect(chars).toContain('ideology = liberalism')
    expect(chars).toContain('expire = "1965.1.1.1"')

    // Historia: recruit_character antes de set_politics y nunca al final
    const hist = read('history/countries/NVG - Nueva Granada.txt')
    const lines = hist.trimEnd().split('\n')
    expect(lines[0]).toBe('capital = 64')
    expect(lines[1]).toBe('oob = "NVG_1936"')
    expect(lines[2]).toBe('set_research_slots = 3')
    const firstRecruit = lines.indexOf('recruit_character = NVG_juan_perez')
    expect(firstRecruit).toBeGreaterThan(0)
    expect(firstRecruit).toBeLessThan(lines.indexOf('set_politics = {'))
    expect(lines[lines.length - 1]).not.toMatch(/recruit_character/)
    expect(hist).toContain(
      '\truling_party = democratic\n\tlast_election = "1932.1.1"\n\telection_frequency = 48\n\telections_allowed = no'
    )
    expect(hist).toContain(
      'set_popularities = {\n\tdemocratic = 55\n\tfascism = 5\n\tcommunism = 10\n\tneutrality = 30\n}'
    )

    // OOB, country_tags y countries
    const oob = read('history/units/NVG_1936.txt')
    expect(oob).toContain('division_template = {')
    expect(oob).not.toContain('units = {')
    expect(read('common/country_tags/01_mi_mod_tags.txt')).toBe(
      'NVG = "countries/Nueva_Granada.txt"\n'
    )
    expect(fs.existsSync(path.join(mod, 'common/country_tags/00_countries.txt'))).toBe(false)
    const countries = read('common/countries/Nueva_Granada.txt')
    expect(countries).toMatch(
      /^graphical_culture = \w+\ngraphical_culture_2d = \w+\ncolor = rgb \{ \d+ \d+ \d+ \}\n$/
    )

    // Localización con BOM y todas sus claves
    const locBuf = fs.readFileSync(
      path.join(mod, 'localisation/english/mi_mod_countries_l_english.yml')
    )
    expect([...locBuf.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const loc = locBuf.toString('utf-8').slice(1)
    expect(loc.startsWith('l_english:\n')).toBe(true)
    const keys = ['NVG', 'NVG_DEF', 'NVG_ADJ', 'NVG_juan_perez', 'NVG_ana_ruiz']
    for (const i of ['democratic', 'fascism', 'communism', 'neutrality'])
      keys.push(`NVG_${i}`, `NVG_${i}_DEF`, `NVG_${i}_ADJ`, `NVG_${i}_party`, `NVG_${i}_party_long`)
    for (const k of keys) expect(loc).toContain(` ${k}:0 "`)
    expect(loc).toContain(' NVG_DEF:0 "la República de Nueva Granada"')

    // Árbol de focos del país con su tag
    expect(read('common/national_focus/NVG_focus.txt')).toContain('\t\t\ttag = NVG')
  })

  it('el validador no pone errores a un país nuevo completo (solo avisos)', () => {
    const { project } = newCountryProject()
    const errors = validateProject(project).filter((i) => i.severity === 'error')
    expect(errors).toEqual([])
    const avisos = validateProject(project).map((i) => i.message)
    expect(avisos.some((m) => m.includes('no aparece en la partida'))).toBe(true)
  })

  it('el validador marca errores del país con su paso', () => {
    const { project, country } = newCountryProject()
    const bad = updateCountry(project, country.uid, {
      tag: 'NOT',
      capital: null,
      politics: {
        ...country.politics,
        popularities: { democratic: 0, fascism: 50, communism: 10, neutrality: 30 }
      }
    })
    const errs = validateProject(bad).filter(
      (i) => i.severity === 'error' && i.countryUid === country.uid
    )
    expect(errs.map((e) => e.step).sort()).toEqual([0, 1, 1, 2])
  })
})

describe('país existente', () => {
  function existing(historyText: string | null): Project {
    let p = emptyProject() // MEX existente
    const mex = p.countries[0]
    p = updateCountry(p, mex.uid, {
      capital: 100,
      existing: {
        renameInGame: true,
        historyFile: historyText ? 'MEX - Mexico.txt' : null,
        historyText,
        historyEdited: true
      },
      leaders: [{ ...newLeader('Lázaro Cárdenas', 'neutrality'), subideology: 'moderatism' }]
    })
    return p
  }

  it('NO genera country_tags ni common/countries; sin carpeta del juego no exporta historia', () => {
    const paths = countryTextFiles(existing(null)).map((f) => f.path)
    expect(paths.some((p) => p.startsWith('common/country_tags'))).toBe(false)
    expect(paths.some((p) => p.startsWith('common/countries'))).toBe(false)
    expect(paths.some((p) => p.startsWith('history/'))).toBe(false)
    expect(paths).toContain('common/characters/mi_mod_MEX_characters.txt')
    expect(paths).toContain('localisation/english/replace/mi_mod_countries_l_english.yml')
    // Y el validador lo explica como error
    const errs = validateProject(existing(null))
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
    expect(errs.some((m) => m.includes('Configura la carpeta de HOI4'))).toBe(true)
  })

  it('con la historia del juego: mismo nombre de archivo y copia lo que no se tocó', () => {
    const original =
      '# comentario\ncapital = 57\noob = "MEX_1936"\nset_technology = { infantry_weapons = 1 }\n' +
      'set_politics = {\n\truling_party = neutrality\n\tlast_election = "1934.7.1"\n\telection_frequency = 72\n\telections_allowed = no\n}\n' +
      'set_popularities = { democratic = 10 fascism = 5 communism = 5 neutrality = 80 }\n' +
      'recruit_character = MEX_lazaro_cardenas_viejo\n1939.1.1 = {\n\tset_politics = { ruling_party = democratic }\n}\n'
    const files = countryTextFiles(existing(original))
    const h = files.find((f) => f.path === 'history/countries/MEX - Mexico.txt')!
    expect(h).toBeDefined()
    expect(h.text).toContain('# comentario\ncapital = 100\noob = "MEX_1936"')
    expect(h.text).toContain('recruit_character = MEX_lazaro_cardenas\nset_politics = {')
    expect(h.text).toContain('recruit_character = MEX_lazaro_cardenas_viejo') // se conservan los del juego
    expect(h.text).toContain('1939.1.1 = {\n\tset_politics = { ruling_party = democratic }\n}') // bloque de fecha intacto
    expect(h.text.trimEnd().split('\n').pop()).not.toMatch(/^recruit_character/)
  })

  it('lee capital, política y popularidades del archivo del juego', () => {
    const h = parseHistory(
      'capital = 57\nset_politics = {\n ruling_party = neutrality\n last_election = "1934.7.1"\n election_frequency = 72\n elections_allowed = no\n}\nset_popularities = {\n democratic = 10\n fascism = 5\n communism = 5\n neutrality = 80\n}\n'
    )
    expect(h).toEqual({
      capital: 57,
      ruling: 'neutrality',
      lastElection: '1934.7.1',
      electionFrequency: 72,
      electionsAllowed: false,
      popularities: { democratic: 10, fascism: 5, communism: 5, neutrality: 80 }
    })
    expect(
      patchHistory('capital = 1\n', {
        ...newCountry({ mode: 'existente', tag: 'MEX', name: 'x' }),
        capital: 2
      })
    ).toContain('set_popularities')
  })

  it('banderas: solo sustituye las que se subieron, con los nombres del juego', async () => {
    let p = emptyProject()
    p = updateCountry(p, p.countries[0].uid, {
      flags: { main: null, byIdeology: { communism: 'png-rojo' } }
    })
    const files = await buildExtraFiles(p, fakeDecode, fakeRead)
    const tgas = files.filter((f) => f.path.endsWith('.tga')).map((f) => f.path)
    expect(tgas).toEqual([
      'gfx/flags/MEX_communism.tga',
      'gfx/flags/medium/MEX_communism.tga',
      'gfx/flags/small/MEX_communism.tga'
    ])
  })
})

describe('lectura de la carpeta del juego (países)', () => {
  it('estados y subideologías', () => {
    expect(
      parseState(
        'state = {\n\tid = 64\n\tname = "STATE_64"\n\thistory = {\n\t\towner = MEX\n\t}\n}'
      )
    ).toEqual({
      id: 64,
      nameKey: 'STATE_64',
      owner: 'MEX'
    })
    const ideologies =
      'ideologies = {\n\tdemocratic = {\n\t\ttypes = {\n\t\t\tconservatism = { }\n\t\t\tliberalism = { }\n\t\t}\n\t\tcolor = { 0 0 255 }\n\t}\n}'
    expect(parseSubideologies(ideologies)).toEqual({ democratic: ['conservatism', 'liberalism'] })
  })
})

describe('migración v2 → v3', () => {
  it('crea un país con el tag del mod y le asigna el árbol', () => {
    const v2 = {
      version: 2,
      modName: 'Viejo',
      tag: 'ZZZ',
      focuses: [
        {
          uid: 'a',
          id: 'ZZZ_x',
          name: 'X',
          description: '',
          cost: 10,
          icon: { kind: 'game', gfx: 'GFX_goal_generic_trade' },
          iconAuto: false,
          x: 0,
          y: 0,
          prerequisites: [],
          mutuallyExclusive: [],
          blocks: null,
          scripts: { available: '', bypass: '', reward: '' }
        }
      ],
      ideas: [],
      icons: [],
      countryFlags: []
    }
    const p = migrateProject(v2)
    expect(p.version).toBe(3)
    expect(p.countries).toHaveLength(1)
    expect(p.countries[0]).toMatchObject({ tag: 'ZZZ', mode: 'nuevo', focusTreeId: 'arbol_1' })
    expect(p.focusTrees).toEqual([{ id: 'arbol_1', name: 'Árbol de ZZZ' }])
    expect(p.focuses[0]).toMatchObject({
      id: 'ZZZ_x',
      treeId: 'arbol_1',
      icon: { kind: 'game', gfx: 'GFX_goal_generic_trade' }
    })
  })
})

describe('deshacer / rehacer de países', () => {
  beforeEach(() => store.openProject(emptyProject(), null))

  it('crear, editar y borrar un país', () => {
    const c = newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' })
    store.updateProject((p) => addCountry(p, c))
    store.updateProject((p) => updateCountry(p, c.uid, { names: { ...c.names, name: 'Granada' } }))
    store.updateProject((p) => deleteCountry(p, c.uid))
    expect(store.get().project!.countries.map((x) => x.tag)).toEqual(['MEX'])

    store.undo()
    expect(store.get().project!.countries.find((x) => x.uid === c.uid)?.names.name).toBe('Granada')
    store.undo()
    expect(store.get().project!.countries.find((x) => x.uid === c.uid)?.names.name).toBe(
      'Nueva Granada'
    )
    store.undo()
    expect(store.get().project!.countries).toHaveLength(1)
    store.redo()
    store.redo()
    store.redo()
    expect(store.get().project!.countries).toHaveLength(1)
    store.undo()
    expect(store.get().project!.countries).toHaveLength(2)
  })
})
