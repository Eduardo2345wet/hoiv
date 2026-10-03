import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readGameCatalog } from '../src/main/game'
import { parseTechnologies } from '../src/shared/gameTech'
import { parseTechTags, folderCanon } from '../src/shared/techFolders'
import { folderChoices, folderApplies, folderName } from '../src/renderer/src/sections/technologies'

const game = (opts: { dlc: boolean; spanish?: boolean }): string => {
  const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-folders-'))
  const w = (rel: string, t: string): void => {
    fs.mkdirSync(path.dirname(path.join(g, rel)), { recursive: true })
    fs.writeFileSync(path.join(g, rel), t)
  }
  w('common/country_tags/00.txt', 'GER = "countries/Germany.txt"\n')
  const tech = (id: string, folder: string): string =>
    `${id} = { folder = { name = ${folder} position = { x = 0 y = 0 } } }`
  w(
    'common/technologies/a.txt',
    `technologies = {\n${[
      tech('t_inf', 'infantry_folder'),
      tech('t_arm', 'armour_folder'),
      tech('t_nsb', 'nsb_armour_folder'),
      tech('t_air', 'air_techs_folder'),
      tech('t_bba', 'bba_air_techs_folder'),
      tech('t_nav', 'naval_folder'),
      tech('t_mtg', 'mtgnavalfolder')
    ].join('\n')}\n}`
  )
  w(
    'common/technology_tags/00.txt',
    'technology_tags = { nsb_armour_folder = { has_dlc = "No Step Back" } mtgnavalfolder = { has_dlc = "Man the Guns" } }'
  )
  if (opts.dlc) {
    fs.mkdirSync(path.join(g, 'dlc', 'dlc018_no_step_back'), { recursive: true })
    fs.mkdirSync(path.join(g, 'dlc', 'dlc012_man_the_guns'), { recursive: true })
    fs.mkdirSync(path.join(g, 'dlc', 'dlc010_by_blood_alone'), { recursive: true })
  }
  const loc = (lang: string, arm: string, nsb: string): string =>
    `l_${lang}:\n infantry_folder:0 "x1"\n armour_folder:0 "${arm}"\n nsb_armour_folder:0 "${nsb}"\n air_techs_folder:0 "x2"\n bba_air_techs_folder:0 "x3"\n naval_folder:0 "x4"\n mtgnavalfolder:0 "x5"\n`
  w('localisation/english/t_l_english.yml', '﻿' + loc('english', 'Armour', 'Armour (NSB)'))
  if (opts.spanish)
    w('localisation/spanish/t_l_spanish.yml', '﻿' + loc('spanish', 'Blindados', 'Blindados NSB'))
  return g
}

describe('carpetas de investigación', () => {
  it('lee la condición de DLC de technology_tags', () => {
    expect(parseTechTags('technology_tags = { a_folder = { has_dlc = "X Y" } b = { } }')).toEqual({
      a_folder: 'X Y'
    })
    expect(folderCanon('nsb_armour_folder')).toBe(folderCanon('armour_folder'))
    expect(folderCanon('mtgnavalfolder')).toBe(folderCanon('naval_folder'))
    expect(folderCanon('bba_air_techs_folder')).toBe(folderCanon('air_techs_folder'))
  })

  it('con el DLC instalado, la carpeta del DLC reemplaza a la normal', () => {
    const cat = readGameCatalog(game({ dlc: true, spanish: true }))!
    const vis = folderChoices(cat as never, false).map((c) => c.id)
    expect(vis).toContain('nsb_armour_folder')
    expect(vis).not.toContain('armour_folder')
    expect(vis).toContain('bba_air_techs_folder') // por prefijo, sin technology_tags
    expect(vis).not.toContain('air_techs_folder')
    expect(vis).toContain('mtgnavalfolder')
    expect(vis).not.toContain('naval_folder')
    expect(vis).toContain('infantry_folder')
  })

  it('sin el DLC se usa la normal y la del DLC no aplica', () => {
    const cat = readGameCatalog(game({ dlc: false }))! as never
    const vis = folderChoices(cat, false).map((c) => c.id)
    expect(vis).toContain('armour_folder')
    expect(vis).not.toContain('nsb_armour_folder')
    expect(folderApplies(cat, 'nsb_armour_folder')).toBe(false)
    expect(folderApplies(cat, 'armour_folder')).toBe(true)
  })

  it('"Mostrar todas" enseña ambas con la etiqueta del DLC; los nombres salen de la localización en un solo idioma', () => {
    const cat = readGameCatalog(game({ dlc: true, spanish: true }))! as never
    const all = folderChoices(cat, true)
    expect(all.find((c) => c.id === 'nsb_armour_folder')?.label).toBe(
      'Blindados NSB · No Step Back'
    )
    expect(all.find((c) => c.id === 'armour_folder')?.label).toBe('Blindados')
    expect(folderName('armour_folder', cat)).toBe('Blindados')
    // sin español: todo en el idioma del juego
    const en = readGameCatalog(game({ dlc: true }))! as never
    expect(folderName('armour_folder', en)).toBe('Armour')
    expect(folderName('infantry_folder', en)).toBe('x1')
  })

  it('resuelve variables @ en posiciones y años', () => {
    const t = parseTechnologies(
      `@1936 = 0\n@step = 2\ntechnologies = { a = { folder = { name = f position = { x = 1 y = @1936 } } start_year = 1936 research_cost = @step dependencies = { b = 1 } } }`
    )
    expect(t[0]).toMatchObject({ x: 1, y: 0, year: 1936, cost: 2, dependencies: ['b'] })
  })
})
