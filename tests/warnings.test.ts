// Avisos reales: países liberables sin estados NO avisan; los que yo dejo sin estados, agrupados
import { describe, expect, it } from 'vitest'
import type { MapData, MapState } from '../src/shared/map/types'
import type { GameCatalog } from '../src/renderer/src/catalog/catalog'
import type { Project } from '../src/renderer/src/types'
import { planCapitalMoves, leaveState } from '../src/renderer/src/map/capitals'
import { validateProject, type Issue } from '../src/renderer/src/export/validator'
import { migrateProject } from '../src/renderer/src/migrate'
import { store } from '../src/renderer/src/store/appStore'
import { emptyProject } from './fixtures'
import { ignoreIssue, isIgnored, issueKey, splitIgnored } from '../src/renderer/src/export/ignore'

const st = (id: number, owner: string, vp: number): MapState => ({
  id,
  nameKey: `STATE_${id}`,
  name: `Estado ${id}`,
  file: `${id}-S.txt`,
  provinces: [id * 10],
  owner,
  cores: [],
  victoryPoints: [[id * 10, vp]],
  category: 'rural',
  hasDatedChanges: false
})
// ABK (liberable): su capital 826 es de SOV y NO tiene estados en la base. GXC tiene 594 y 595. DMA solo 700.
const map = (): MapData =>
  ({
    source: 'real',
    width: 1,
    height: 1,
    states: [
      st(1, 'SOV', 20),
      st(826, 'SOV', 1),
      st(594, 'GXC', 5),
      st(595, 'GXC', 2),
      st(700, 'DMA', 3)
    ]
  }) as unknown as MapData
const game = {
  countries: [
    ['SOV', 'Unión Soviética'],
    ['ABK', 'Abjasia'],
    ['GXC', 'Guangxi'],
    ['DMA', 'Dominica']
  ],
  countryCapitals: { SOV: 1, ABK: 826, GXC: 594, DMA: 700 },
  historyFiles: { ABK: 'ABK - Abkhazia.txt', GXC: 'GXC - Guangxi.txt', DMA: 'DMA - Dominica.txt' }
} as unknown as GameCatalog

const proj = (edits: Project['stateEdits'] = {}): Project => {
  const p = emptyProject()
  return { ...p, countries: [], stateEdits: edits, mapSettings: { ...p.mapSettings, base: 'game' } }
}
const issues = (p: Project): Issue[] => validateProject(p, game, { map: map(), gamePath: '/x' })
const capital = (p: Project): Issue[] =>
  issues(p).filter((i) => /capital|no existirán|sin estados/i.test(i.message))

describe('avisos de capitales: solo los reales', () => {
  it('un país liberable que ya empieza sin estados NO da aviso (ni mueve nada)', () => {
    expect(capital(proj())).toEqual([])
    expect(planCapitalMoves(proj(), map(), game)).toEqual([])
  })
  it('país con estados al que le quito la capital: aviso y la capital se mueve', () => {
    const p = proj({ 594: { owner: 'SOV' } })
    const c = capital(p)
    expect(c).toHaveLength(1)
    expect(c[0].message).toContain('GXC')
    expect(c[0].stateId).toBe(594)
    expect(planCapitalMoves(p, map(), game)).toEqual([
      expect.objectContaining({ tag: 'GXC', to: 595 })
    ])
  })
  it('país que se queda sin estados por mis cambios: UN aviso agrupado', () => {
    const p = proj({ 700: { owner: 'SOV' }, 594: { owner: 'SOV' }, 595: { owner: 'SOV' } })
    const c = capital(p)
    expect(c).toHaveLength(1)
    expect(c[0].message).toMatch(/2 países del juego no existirán al inicio por tus cambios/)
    expect(c[0].message).toContain('Dominica')
    expect(c[0].message).toContain('Guangxi')
    expect(c[0].message).toContain('Attempting to set capital state')
    expect(c[0].message).not.toContain('ABK')
  })
  it('"Dejarle un estado" devuelve el estado y lo hace capital en un solo paso de deshacer', () => {
    const p = proj({ 700: { owner: 'SOV' } })
    store.openProject(p, null)
    leaveState('DMA', 700, map())
    const q = store.get().project!
    expect(q.stateEdits[700]?.owner).toBe('DMA')
    expect(q.mapSettings.capitalChoices.DMA).toBe(700)
    expect(capital(q)).toEqual([])
    store.undo()
    expect(store.get().project!.stateEdits[700]?.owner).toBe('SOV')
    expect(store.get().project!.mapSettings.capitalChoices?.DMA).toBeUndefined()
  })
})

describe('avisos ignorados', () => {
  it('se guardan en el proyecto, sobreviven a reabrirlo y se pueden mostrar', () => {
    const p = proj({ 594: { owner: 'SOV' } })
    const [a] = capital(p)
    const q = ignoreIssue(p, a)
    expect(q.ignoredIssues).toEqual([issueKey(a)])
    const reopened = migrateProject(JSON.parse(JSON.stringify(q)))
    expect(isIgnored(reopened, a)).toBe(true)
    const { shown, hidden } = splitIgnored(reopened, issues(reopened))
    expect(hidden.some((i) => issueKey(i) === issueKey(a))).toBe(true)
    expect(shown.some((i) => issueKey(i) === issueKey(a))).toBe(false)
  })
  it('los errores no se pueden ignorar', () => {
    const e: Issue = { severity: 'error', message: 'x' }
    expect(ignoreIssue(proj(), e).ignoredIssues ?? []).toEqual([])
  })
})
