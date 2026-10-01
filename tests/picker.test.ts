// Selector de país universal, países ligeros, prioridad del árbol e IDs únicos
import { describe, expect, it } from 'vitest'
import { generateDemoMap } from '../src/shared/map/demo'
import { countrySections, matchChoice } from '../src/renderer/src/countries/choices'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import { emptyProject } from './fixtures'

const demo = generateDemoMap()
const game = {
  countries: [
    ['DMA', 'Norte'],
    ['DMB', 'Este'],
    ['SOV', 'Russia'],
    ['LUX', 'Luxemburgo']
  ] as [string, string][],
  ideas: []
}

describe('CountryPicker: secciones (parte 1)', () => {
  it('Mis países → En el mapa (por estados) → Todos (incluye sin estados)', () => {
    let p = emptyProject()
    p = addCountry(p, {
      ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
      focusTreeId: null
    })
    const s = countrySections(p, demo, game)
    expect(s.mine.map((c) => c.tag)).toEqual(
      ['MEX', 'NVG'].filter((t) => s.mine.some((c) => c.tag === t))
    )
    expect(s.mine.every((c) => c.mine)).toBe(true)
    const counts = s.onMap.map((c) => c.states)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(s.onMap.length).toBeGreaterThan(1)
    expect(s.onMap.some((c) => c.tag === 'MEX')).toBe(false) // ya está en Mis países
    // SOV y LUX no tienen estados en el mapa de demostración: solo en Todos
    expect(s.game.map((c) => c.tag)).toEqual(expect.arrayContaining(['SOV', 'LUX']))
    expect(s.onMap.some((c) => c.tag === 'SOV')).toBe(false)
    expect(s.game.find((c) => c.tag === 'SOV')!.states).toBe(0)
    // Ningún país repetido entre secciones
    const all = [...s.mine, ...s.onMap, ...s.game].map((c) => c.tag)
    expect(new Set(all).size).toBe(all.length)
  })
  it('lo pintado cambia "En el mapa"', () => {
    let p = emptyProject()
    const st = demo.states[0]
    p = { ...p, stateEdits: { [st.id]: { owner: 'SOV' } } }
    const s = countrySections(p, demo, game)
    expect(s.onMap.find((c) => c.tag === 'SOV')!.states).toBe(1)
  })
  it('busca por nombre y por tag, sin tildes', () => {
    const c = { tag: 'SOV', name: 'Rusia', states: 1, mine: false }
    expect(matchChoice(c, 'rus')).toBe(true)
    expect(matchChoice(c, 'sov')).toBe(true)
    expect(matchChoice({ ...c, name: 'México' }, 'mexi')).toBe(true)
    expect(matchChoice(c, 'xyz')).toBe(false)
  })
})

import {
  assignTreeToTag,
  deleteTree,
  createTreeForCountry
} from '../src/renderer/src/countries/countryOps'
import { buildExtraFiles, plannedPaths } from '../src/renderer/src/export/exportMod'
import { createFocus } from '../src/renderer/src/ui/projectOps'
import type { Project } from '../src/renderer/src/types'

const noCountries = (): Project => ({ ...emptyProject(), countries: [], focusTrees: [], tag: '' })

describe('país del juego ligero (parte 3)', () => {
  it('elegir SOV registra un país existente ligero y le da un árbol, sin ventanas', () => {
    const r = assignTreeToTag(noCountries(), 'SOV', 'Russia')
    const c = r.project.countries.find((x) => x.tag === 'SOV')!
    expect(c).toMatchObject({ mode: 'existente', light: true, focusTreeId: r.treeId, leaders: [] })
    expect(r.project.focusTrees.length).toBe(1)
  })
  it('un árbol "sin país" se puede asignar a un país del juego', () => {
    let p = noCountries()
    p = { ...p, focusTrees: [{ id: 'arbol_1', name: 'Viejo' }] }
    const r = assignTreeToTag(p, 'SOV', 'Russia', 'arbol_1')
    expect(r.treeId).toBe('arbol_1')
    expect(r.project.focusTrees.length).toBe(1)
    expect(r.project.countries[0].focusTreeId).toBe('arbol_1')
  })
  it('al borrar el árbol el país ligero desaparece; uno del mod se queda', () => {
    const r = assignTreeToTag(noCountries(), 'SOV', 'Russia')
    expect(deleteTree(r.project, r.treeId).countries).toEqual([])
    const mine = emptyProject() // MEX es del mod y ya tiene arbol_1
    expect(deleteTree(mine, 'arbol_1').countries.length).toBe(1)
  })
  it('un país ligero no exporta historia, banderas, personajes ni localización de país', async () => {
    let r = assignTreeToTag(noCountries(), 'SOV', 'Russia')
    let p = createFocus(r.project, 0, 0, 'Industria', r.treeId).project
    p = { ...p, modName: 'Mi Mod' }
    const files = await buildExtraFiles(p, async () => ({
      width: 1,
      height: 1,
      rgba: new Uint8Array(4)
    }))
    const paths = files.map((f) => f.path)
    expect(paths.some((x) => x.includes('national_focus/SOV_focus.txt'))).toBe(true)
    expect(
      paths.filter((x) =>
        /history\/countries|gfx\/flags|characters|country_tags|leaders|common\/countries/.test(x)
      )
    ).toEqual([])
    expect(plannedPaths(p).filter((x) => /gfx\/flags|history\/countries/.test(x))).toEqual([])
    expect(files.some((f) => f.path.includes('countries_l_english'))).toBe(false)
  })
  it('editar el país con el asistente lo vuelve completo (light = false)', () => {
    const r = assignTreeToTag(noCountries(), 'SOV', 'Russia')
    const c = r.project.countries[0]
    expect({ ...c, light: false }.light).toBe(false)
  })
})
