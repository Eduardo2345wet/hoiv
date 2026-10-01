// Dueño efectivo ("como se ve en el mapa del proyecto"), listas del selector y conteos
import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../src/renderer/src/store/appStore'
import { generateDemoMap } from '../src/shared/map/demo'
import { countrySections } from '../src/renderer/src/countries/choices'
import { handleStroke } from '../src/renderer/src/map/tools'
import { effectiveOwner, getOwnerCounts, ownerCountStats } from '../src/renderer/src/map/mapOps'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { syncNoNation, technicalCountry } from '../src/renderer/src/map/noNation'
import type { TemplateId } from '../src/renderer/src/types'

const demo = generateDemoMap()
const game = {
  countries: [
    ['DMA', 'Norte'],
    ['DMB', 'Este'],
    ['DMC', 'Sur'],
    ['DMD', 'Oeste'],
    ['SOV', 'Russia'],
    ['LUX', 'Luxemburgo']
  ] as [string, string][],
  ideas: []
}
const ctx = { toast: () => {}, brush: { giveCore: false, removePreviousCores: false } }
const stroke = (id: number, erase = false): void => {
  handleStroke('brush', 'start', id, { shift: false, erase }, ctx)
  handleStroke('brush', 'end', 0, { shift: false, erase }, ctx)
}
function open(template: TemplateId): void {
  for (const t of [...store.get().tabs]) store.closeTab(t.id)
  store.set({ map: demo, mapKey: 'demo', activeTag: null })
  const p = syncNoNation(emptyProjectFor('T', template), null, demo)
  store.openInNewTab(p, null, 'mapa')
}
const sections = (): ReturnType<typeof countrySections> =>
  countrySections(store.get().project, demo, game)

describe('"En el mapa" solo con lo que se ve en MI mapa', () => {
  beforeEach(() => store.clearMapCache())

  for (const t of ['blankNoNation', 'blank'] as const)
    it(`${t}: sin pintar, "En el mapa" está vacío (no muestra los dueños del juego)`, () => {
      open(t)
      expect(sections().onMap).toEqual([])
      expect(demo.states.every((s) => effectiveOwner(s, store.get().project!) === '')).toBe(true)
    })

  for (const t of ['blankNoNation', 'blank'] as const)
    it(`${t}: pintar 3 estados con SOV deja solo Russia con 3; borrar 1 deja 2`, () => {
      open(t)
      store.set({ activeTag: 'SOV' })
      const ids = demo.states.slice(0, 3).map((s) => s.id)
      ids.forEach((id) => stroke(id))
      let m = sections().onMap
      expect(m.map((c) => [c.tag, c.name, c.states])).toEqual([['SOV', 'Russia', 3]])
      stroke(ids[0], true) // clic derecho: borrar
      m = sections().onMap
      expect(m.map((c) => [c.tag, c.states])).toEqual([['SOV', 2]])
    })

  it('"Mapa del juego": muestra los dueños del juego con sus conteos y pintar o borrar los cambia', () => {
    open('game')
    const real = new Map<string, number>()
    for (const s of demo.states) real.set(s.owner, (real.get(s.owner) ?? 0) + 1)
    expect(
      sections()
        .onMap.map((c) => [c.tag, c.states])
        .sort()
    ).toEqual([...real.entries()].sort())
    const counts = sections().onMap.map((c) => c.states)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    // Pintar un estado de DMA con SOV: DMA baja 1 y SOV aparece con 1
    const s = demo.states.find((x) => x.owner === 'DMA')!
    store.set({ activeTag: 'SOV' })
    stroke(s.id)
    const m = new Map(sections().onMap.map((c) => [c.tag, c.states]))
    expect(m.get('DMA')).toBe((real.get('DMA') ?? 0) - 1)
    expect(m.get('SOV')).toBe(1)
    stroke(s.id, true) // borrar: vuelve al dueño de la base
    const m2 = new Map(sections().onMap.map((c) => [c.tag, c.states]))
    expect(m2.get('DMA')).toBe(real.get('DMA'))
    expect(m2.has('SOV')).toBe(false)
  })

  it('"Sin nación" nunca aparece en el selector, y cuenta como en blanco', () => {
    open('blankNoNation')
    const tech = technicalCountry(store.get().project!)!
    const g = {
      ...game,
      countries: [...game.countries, [tech.tag, 'Sin nación'] as [string, string]]
    }
    const s = countrySections(store.get().project, demo, g)
    for (const list of [s.mine, s.onMap, s.game])
      expect(list.some((c) => c.tag === tech.tag)).toBe(false)
    expect(s.mine).toEqual([])
  })

  it('"Todos" incluye todos los tags y los que no están en mi mapa tienen 0 (se muestra "—")', () => {
    open('blankNoNation')
    store.set({ activeTag: 'SOV' })
    stroke(demo.states[0].id)
    const s = sections()
    const all = [...s.mine, ...s.onMap, ...s.game].map((c) => c.tag).sort()
    expect(all).toEqual(game.countries.map(([t]) => t).sort())
    const lux = s.game.find((c) => c.tag === 'LUX')!
    expect(lux.states).toBe(0)
    // Nunca el conteo del juego original: DMA tiene estados en el juego pero 0 en mi mapa
    expect(s.game.find((c) => c.tag === 'DMA')!.states).toBe(0)
  })

  it('tarjeta, Navegador y selector dan los mismos conteos (una sola función)', () => {
    open('blankNoNation')
    store.set({ activeTag: 'SOV' })
    demo.states.slice(0, 4).forEach((s) => stroke(s.id))
    const counts = getOwnerCounts(demo, store.get().project!)
    expect(counts.get('SOV')).toBe(4)
    expect(sections().onMap.find((c) => c.tag === 'SOV')!.states).toBe(counts.get('SOV'))
  })

  it('dos pestañas con plantillas distintas no comparten conteos', () => {
    open('blankNoNation')
    store.set({ activeTag: 'SOV' })
    stroke(demo.states[0].id)
    const a = getOwnerCounts(demo, store.get().project!)
    expect(a.get('SOV')).toBe(1)
    store.openInNewTab(emptyProjectFor('Juego', 'game'), null, 'mapa')
    const b = getOwnerCounts(demo, store.get().project!)
    expect(b.get('SOV')).toBeUndefined()
    expect((b.get('DMA') ?? 0) > 0).toBe(true)
    store.cycleTab(-1)
    expect(getOwnerCounts(demo, store.get().project!).get('SOV')).toBe(1)
  })

  it('los conteos son incrementales: una pincelada no recorre todos los estados', () => {
    open('game')
    store.set({ activeTag: 'SOV' })
    getOwnerCounts(demo, store.get().project!)
    const full0 = ownerCountStats.full
    for (const s of demo.states.slice(0, 10)) {
      stroke(s.id)
      getOwnerCounts(demo, store.get().project!)
    }
    expect(ownerCountStats.full).toBe(full0) // ningún recálculo completo
    expect(ownerCountStats.incremental).toBeGreaterThanOrEqual(8)
    // Al cambiar de pestaña se recalcula completo una sola vez
    store.openInNewTab(emptyProjectFor('Otro', 'game'), null, 'mapa')
    getOwnerCounts(demo, store.get().project!)
    getOwnerCounts(demo, store.get().project!)
    expect(ownerCountStats.full).toBe(full0 + 1)
  })
})
