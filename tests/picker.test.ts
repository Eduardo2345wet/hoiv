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
