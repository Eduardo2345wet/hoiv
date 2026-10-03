// Datos de estado editables (S6): población, categoría, recursos, edificios y puntos de victoria.
// Se guardan en stateEdits[id] solo si difieren del original; el parche mínimo toca solo esas líneas.
import type { Project, StateEdit } from '../types'
import type { MapState } from '../../../shared/map/types'
import type { StateProps } from '../../../shared/map/statePatch'

/** por verificar con common/buildings del juego: máximos si no hay carpeta del juego */
export const BUILDING_DEFAULTS: Record<string, { max: number; provincial: boolean }> = {
  infrastructure: { max: 5, provincial: false },
  industrial_complex: { max: 5, provincial: false },
  arms_factory: { max: 5, provincial: false },
  dockyard: { max: 5, provincial: false },
  air_base: { max: 10, provincial: false },
  anti_air_building: { max: 5, provincial: false },
  radar_station: { max: 6, provincial: false },
  synthetic_refinery: { max: 3, provincial: false },
  fuel_silo: { max: 5, provincial: false },
  rocket_site: { max: 3, provincial: false },
  nuclear_reactor: { max: 1, provincial: false },
  naval_base: { max: 10, provincial: true },
  bunker: { max: 5, provincial: true },
  coastal_bunker: { max: 5, provincial: true },
  supply_node: { max: 1, provincial: false }
}
/** Edificios que solo existen en provincias costeras */
export const COASTAL_ONLY = ['naval_base', 'coastal_bunker']
/** Recursos del juego */
export const RESOURCES = ['oil', 'steel', 'aluminium', 'rubber', 'tungsten', 'chromium']
export const RESOURCE_LABELS: Record<string, string> = {
  oil: 'Petróleo',
  steel: 'Acero',
  aluminium: 'Aluminio',
  rubber: 'Caucho',
  tungsten: 'Tungsteno',
  chromium: 'Cromo'
}
/** por verificar con common/state_category: lista de reserva */
export const BUILTIN_CATEGORIES = [
  'wasteland',
  'enclave',
  'tiny_island',
  'pastoral',
  'small_island',
  'rural',
  'town',
  'large_town',
  'city',
  'large_city',
  'metropolis',
  'megalopolis'
]

export type BuildingInfo = Record<string, { max: number; provincial: boolean }>
export const buildingInfo = (game?: { buildingMax?: BuildingInfo } | null): BuildingInfo => ({
  ...BUILDING_DEFAULTS,
  ...(game?.buildingMax ?? {})
})

const PROP_KEYS = [
  'manpower',
  'category',
  'resources',
  'buildings',
  'provinceBuildings',
  'victoryPoints'
] as const

export const hasProps = (e?: StateEdit): boolean => !!e && PROP_KEYS.some((k) => e[k] !== undefined)

/** Lo que el parche necesita (provincias como números) */
export function propsOf(e?: StateEdit): StateProps | undefined {
  if (!hasProps(e)) return undefined
  const num = <T>(o?: Record<string, T>): Record<number, T> | undefined =>
    o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), v])) : undefined
  return {
    manpower: e!.manpower,
    category: e!.category,
    resources: e!.resources,
    buildings: e!.buildings,
    provinceBuildings: num(e!.provinceBuildings),
    victoryPoints: num(e!.victoryPoints)
  }
}

/** Fusiona un cambio en stateEdits[id]; lo que queda vacío se borra, y el edit vacío también */
export function setStateProps(p: Project, id: number, patch: Partial<StateEdit>): Project {
  const cur: StateEdit = { ...(p.stateEdits[id] ?? {}), ...patch }
  for (const k of PROP_KEYS) {
    const v = cur[k]
    if (v && typeof v === 'object' && !Object.keys(v).length) delete cur[k]
    else if (v === undefined) delete cur[k]
  }
  const edits = { ...p.stateEdits }
  if (Object.keys(cur).length) edits[id] = cur
  else delete edits[id]
  return { ...p, stateEdits: edits }
}

/** Valores efectivos (el cambio del usuario o el original del juego) */
export const manpowerOf = (s: MapState, p: Project): number =>
  p.stateEdits[s.id]?.manpower ?? s.manpower ?? 0
export const categoryOf = (s: MapState, p: Project): string =>
  p.stateEdits[s.id]?.category ?? s.category
export const resourcesOf = (s: MapState, p: Project): Record<string, number> => ({
  ...(s.resources ?? {}),
  ...(p.stateEdits[s.id]?.resources ?? {})
})
export const buildingsOf = (s: MapState, p: Project): Record<string, number> => ({
  ...(s.buildings ?? {}),
  ...(p.stateEdits[s.id]?.buildings ?? {})
})
export function provinceBuildingsOf(
  s: MapState,
  p: Project
): Record<number, Record<string, number>> {
  const out: Record<number, Record<string, number>> = {}
  for (const [k, v] of Object.entries(s.provinceBuildings ?? {})) out[Number(k)] = { ...v }
  for (const [k, v] of Object.entries(p.stateEdits[s.id]?.provinceBuildings ?? {}))
    out[Number(k)] = { ...(out[Number(k)] ?? {}), ...v }
  return out
}
export function victoryPointsOf(s: MapState, p: Project): [number, number][] {
  const m = new Map(s.victoryPoints)
  for (const [k, v] of Object.entries(p.stateEdits[s.id]?.victoryPoints ?? {})) m.set(Number(k), v)
  return [...m].filter(([, v]) => v > 0).sort((a, b) => a[0] - b[0])
}
