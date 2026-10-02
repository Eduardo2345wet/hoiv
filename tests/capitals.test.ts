// Capitales de países del juego: lectura robusta, aviso de capital perdida y movimiento al exportar
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readTopLevelCapital, patchCapitalText } from '../src/shared/countryHistory'
import { readGameCatalog } from '../src/main/game'
import { planCapitalPatches } from '../src/main/capitalExport'
import type { MapData, MapState } from '../src/shared/map/types'
import type { GameCatalog } from '../src/renderer/src/catalog/catalog'
import type { Project } from '../src/renderer/src/types'
import { lostCapitals, planCapitalMoves, bestCapital } from '../src/renderer/src/map/capitals'
import { validateProject } from '../src/renderer/src/export/validator'
import { withMovedCapitals } from '../src/renderer/src/map/capitals'
import { newCountry } from '../src/renderer/src/countries/countryOps'
import { existingCountryTextFiles } from '../src/renderer/src/export/countryExport'
import { emptyProject } from './fixtures'

const BOM = 'ï»¿' // los 3 bytes UTF-8 de la marca BOM leídos como latin1

describe('lectura de capital (history/countries)', () => {
  it('tolera BOM, sangría, comentarios, CRLF y capital=N sin espacios', () => {
    expect(readTopLevelCapital(`${BOM}capital = 219\r\n1936.1.1 = { }\r\n`)).toBe(219)
    expect(readTopLevelCapital('﻿capital = 219\n')).toBe(219)
    expect(readTopLevelCapital('# hola\n   \tcapital = 64 # Moscú\n')).toBe(64)
    expect(readTopLevelCapital('capital=7\n')).toBe(7)
    expect(
      readTopLevelCapital(
        'oob = "SOV_1936"\ncapital = 195\nset_politics = { ruling_party = communism }'
      )
    ).toBe(195)
  })
  it('solo cuenta el nivel superior: ni bloques con fecha ni if/limit ni comentarios', () => {
    expect(readTopLevelCapital('1939.1.1 = {\n\tcapital = 5\n}\n')).toBeNull()
    expect(
      readTopLevelCapital('if = {\n\tlimit = { has_dlc = "X" }\n\tcapital = 6\n}\ncapital = 9\n')
    ).toBe(9)
    expect(readTopLevelCapital('# capital = 3\nset_politics = { }\n')).toBeNull()
    expect(readTopLevelCapital('1939.1.1 = { capital = 5 }\ncapital = 4\n')).toBe(4)
  })
  it('readGameCatalog lee la capital de un archivo con BOM (causa de "sin capital" en SOV)', () => {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-cap-'))
    fs.mkdirSync(path.join(game, 'common', 'country_tags'), { recursive: true })
    fs.writeFileSync(
      path.join(game, 'common', 'country_tags', '00_countries.txt'),
      'SOV = "countries/Soviet Union.txt"\nGER = "countries/Germany.txt"\n'
    )
    fs.mkdirSync(path.join(game, 'history', 'countries'), { recursive: true })
    // Como los archivos reales: UTF-8 con BOM y la capital en la primera línea
    fs.writeFileSync(
      path.join(game, 'history', 'countries', 'SOV - Soviet Union.txt'),
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('capital = 219 # Moscú\n\nset_politics = { ruling_party = communism }\n')
      ])
    )
    fs.writeFileSync(
      path.join(game, 'history', 'countries', 'GER - Germany.txt'),
      '\n  capital = 64\n'
    )
    const cat = readGameCatalog(game)!
    expect(cat.countryCapitals.SOV).toBe(219)
    expect(cat.countryCapitals.GER).toBe(64)
    expect(cat.historyFiles.SOV).toBe('SOV - Soviet Union.txt')
  })
})

describe('parche mínimo de la capital', () => {
  it('cambia solo el número: bytes, finales de línea y bloques con fecha intactos', () => {
    const src = `${BOM}capital = 219 # Moscú\r\n1939.1.1 = {\r\n\tcapital = 5\r\n}\r\nif = { limit = { always = yes } capital = 7 }\r\n`
    const r = patchCapitalText(src, 77)
    expect('text' in r && r.text).toBe(src.replace('capital = 219', 'capital = 77'))
    // sin capital de nivel superior: no se arriesga
    expect('error' in patchCapitalText('1939.1.1 = { capital = 5 }\n', 3)).toBe(true)
  })
})

// ---- Mapa pequeño: Guangxi (GXC) tenía la capital en el estado 594 ----
const st = (id: number, owner: string, vp: number[], provs = 3): MapState => ({
  id,
  nameKey: `STATE_${id}`,
  name: `Estado ${id}`,
  file: `${id}-S.txt`,
  provinces: Array.from({ length: provs }, (_, i) => id * 10 + i),
  owner,
  cores: [],
  victoryPoints: vp.map((v, i) => [id * 10 + i, v] as [number, number]),
  category: 'rural',
  hasDatedChanges: false
})
const map = (): MapData =>
  ({
    source: 'real',
    width: 1,
    height: 1,
    states: [
      st(594, 'GXC', [5]),
      st(595, 'GXC', [10]),
      st(596, 'GXC', [10], 5),
      st(597, 'GXC', [10], 5),
      st(1, 'SOV', [20])
    ]
  }) as unknown as MapData
const game = {
  countries: [
    ['GXC', 'Guangxi'],
    ['SOV', 'Unión Soviética']
  ],
  countryCapitals: { GXC: 594, SOV: 1 },
  historyFiles: { GXC: 'GXC - Guangxi.txt', SOV: 'SOV - Soviet Union.txt' }
} as unknown as GameCatalog

function proj(
  edits: Project['stateEdits'] = {},
  extra: Partial<Project['mapSettings']> = {}
): Project {
  const p = emptyProject()
  return {
    ...p,
    countries: [],
    stateEdits: edits,
    mapSettings: { ...p.mapSettings, base: 'game', ...extra }
  }
}

describe('capital perdida de un país del juego', () => {
  it('detecta que 594 pasó a SOV y avisa con "Ir"', () => {
    const p = proj({ 594: { owner: 'SOV' } })
    const lost = lostCapitals(p, map(), game)
    expect(lost).toEqual([expect.objectContaining({ tag: 'GXC', capital: 594, newOwner: 'SOV' })])
    const issues = validateProject(p, game, { map: map(), gamePath: '/x' })
    const a = issues.find((i) => i.message.includes('capital') && i.message.includes('GXC'))
    expect(a?.severity).toBe('aviso')
    expect(a?.stateId).toBe(594)
    expect(a?.message).toMatch(/Estado 594/)
    expect(a?.message).toMatch(/SOV/)
  })
  it('sin cambios no hay aviso', () => {
    expect(lostCapitals(proj(), map(), game)).toEqual([])
  })
  it('la nueva capital: más victory points, luego más provincias, luego id menor', () => {
    const p = proj({ 594: { owner: 'SOV' } })
    // 595, 596 y 597 suman 10; 596 y 597 tienen 5 provincias; gana el id menor
    expect(bestCapital(map(), p, 'GXC')).toBe(596)
  })
  it('planCapitalMoves respeta el ajuste y la elección manual', () => {
    const p = proj({ 594: { owner: 'SOV' } })
    expect(planCapitalMoves(p, map(), game)).toEqual([
      expect.objectContaining({ tag: 'GXC', capital: 594, to: 596, manual: false })
    ])
    const off = proj({ 594: { owner: 'SOV' } }, { moveLostCapitals: false })
    expect(planCapitalMoves(off, map(), game)).toEqual([])
    const man = proj({ 594: { owner: 'SOV' } }, { capitalChoices: { GXC: 595 } })
    expect(planCapitalMoves(man, map(), game)[0]).toMatchObject({ to: 595, manual: true })
    // una elección manual que ya no es del país se ignora
    const bad = proj(
      { 594: { owner: 'SOV' }, 595: { owner: 'SOV' } },
      { capitalChoices: { GXC: 595 } }
    )
    expect(planCapitalMoves(bad, map(), game)[0]).toMatchObject({ to: 596, manual: false })
  })
  it('país que se queda sin estados: no se mueve (to = null)', () => {
    const p = proj({
      594: { owner: 'SOV' },
      595: { owner: 'SOV' },
      596: { owner: 'SOV' },
      597: { owner: 'SOV' }
    })
    expect(planCapitalMoves(p, map(), game)[0]).toMatchObject({ tag: 'GXC', to: null })
  })
  it('con una capital editada en el asistente, el archivo único lleva los dos cambios', () => {
    const c = {
      ...newCountry({ mode: 'existente', tag: 'GXC', name: 'Guangxi' }),
      capital: 594,
      existing: {
        renameInGame: false,
        historyFile: 'GXC - Guangxi.txt',
        historyText: 'capital = 594\nset_politics = { ruling_party = neutrality }\n',
        historyEdited: true
      }
    }
    const p = { ...proj({ 594: { owner: 'SOV' } }), countries: [c] }
    const q = withMovedCapitals(p, map(), game)
    expect(q.countries[0].capital).toBe(596)
    const files = existingCountryTextFiles(q.countries[0])
    expect(files).toHaveLength(1)
    expect(files[0].text).toContain('capital = 596')
    expect(files[0].text).not.toContain('capital = 594')
  })
})

describe('parche de capitales en el proceso principal', () => {
  it('lee los bytes originales y parcha solo la capital; error si no se puede', async () => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-capx-'))
    fs.mkdirSync(path.join(g, 'history', 'countries'), { recursive: true })
    const orig = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('capital = 594\r\n1939.1.1 = { capital = 5 }\r\n')
    ])
    fs.writeFileSync(path.join(g, 'history', 'countries', 'GXC - Guangxi.txt'), orig)
    fs.writeFileSync(
      path.join(g, 'history', 'countries', 'SOV - Soviet Union.txt'),
      '1939.1.1 = { capital = 5 }\n'
    )
    const res = await planCapitalPatches(g, [
      { file: 'GXC - Guangxi.txt', capital: 596 },
      { file: 'SOV - Soviet Union.txt', capital: 3 },
      { file: 'NOP - No.txt', capital: 3 }
    ])
    expect(res.files).toHaveLength(1)
    expect(res.files[0].path).toBe('history/countries/GXC - Guangxi.txt')
    expect(Buffer.from(res.files[0].data).toString('latin1')).toBe(
      orig.toString('latin1').replace('= 594', '= 596')
    )
    expect(res.errors.map((e) => e.file).sort()).toEqual(['NOP - No.txt', 'SOV - Soviet Union.txt'])
  })
})
