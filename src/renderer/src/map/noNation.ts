// Modo "Sin nación": en el lienzo en blanco, los estados que no pinto quedan para un país
// TÉCNICO de relleno (no es un país de lore: es el marcador de "pendiente por rellenar").
// HOI4 no soporta bien estados sin dueño, por eso se usa un país real y neutral.
import type { Country, Project } from '../types'
import type { MapData, MapState } from '../../../shared/map/types'
import type { GameCatalog } from '../catalog/catalog'
import { getCatalogOptions } from '../catalog/catalog'
import { newCountry, newLeader } from '../countries/countryOps'
import { suggestTag } from '../countries/tags'
import { effectiveCores, effectiveOwner } from './mapOps'

export const NO_NATION_COLOR: [number, number, number] = [200, 200, 200]
/** Líneas que se quitan de los bloques con fecha de los estados pendientes */
// Patrón real (HOI4 1.19.3): 1938.10.25 = { if = { limit = { … } remove_core_of = GXC  CHI = { transfer_state = PREV } } }
// por verificar: que no haya otras claves con las que un bloque con fecha devuelva el estado a otro país
export const DATED_KEYS_TO_STRIP = [
  'owner',
  'controller',
  'add_core_of',
  'remove_core_of',
  'transfer_state'
]

/** ¿Está activo el modo Sin nación? (solo con el lienzo en blanco) */
export function noNationActive(p: Project | null): boolean {
  return p?.mapSettings?.base === 'blank' && p.mapSettings.unpainted === 'noNation'
}

export function technicalCountry(p: Project): Country | undefined {
  return p.countries.find((c) => c.technical)
}

/** Tag libre para Sin nación: que no exista en el juego ni en el mod */
export function proposeNoNationTag(
  p: Project,
  game: GameCatalog | null,
  map: MapData | null
): string {
  const taken = [
    ...getCatalogOptions('country', null, game).map((o) => o.id),
    ...p.countries.filter((c) => !c.technical).map((c) => c.tag),
    ...(map?.states.map((s) => s.owner) ?? [])
  ]
  return suggestTag(p.mapSettings.noNation.name || 'Sin nacion', taken)
}

/** País técnico con aspecto neutro: gris, sin elecciones, neutralidad al 100 %, líder "Sin gobierno" */
function buildTechnical(tag: string, name: string, prev?: Country): Country {
  const base = prev ?? newCountry({ mode: 'nuevo', tag, name })
  const leader = prev?.leaders[0] ?? newLeader('Sin gobierno', 'neutrality')
  return {
    ...base,
    mode: 'nuevo',
    technical: true,
    tag,
    names: { name, def: name, adj: '' },
    color: NO_NATION_COLOR,
    politics: {
      ...base.politics,
      ruling: 'neutrality',
      popularities: { democratic: 0, fascism: 0, communism: 0, neutrality: 100 },
      electionsAllowed: false
    },
    flags: { main: null, byIdeology: {} },
    leaders: [{ ...leader, name: 'Sin gobierno', ideology: 'neutrality', portrait: null }],
    focusTreeId: null
  }
}

/**
 * Crea, actualiza o quita el país técnico según la configuración del mapa.
 * Se llama al cambiar la base o los ajustes de Sin nación.
 */
export function syncNoNation(p: Project, game: GameCatalog | null, map: MapData | null): Project {
  const tech = technicalCountry(p)
  if (!noNationActive(p))
    return tech ? { ...p, countries: p.countries.filter((c) => !c.technical) } : p
  const ms = p.mapSettings
  const tag = ms.noNation.tag || proposeNoNationTag(p, game, map)
  const name = ms.noNation.name || 'Sin nación'
  const next = buildTechnical(tag, name, tech)
  const settings = ms.noNation.tag === tag ? ms : { ...ms, noNation: { ...ms.noNation, tag } }
  return {
    ...p,
    mapSettings: settings,
    countries: tech ? p.countries.map((c) => (c.technical ? next : c)) : [...p.countries, next]
  }
}

/** Estados pendientes (sin pintar), ordenados por id */
export function pendingStates(p: Project, map: MapData): number[] {
  return map.states.filter((s) => !p.stateEdits[s.id]?.owner).map((s) => s.id)
}

/** Dueño que tendrá el estado en el juego al exportar */
export function exportOwner(s: MapState, p: Project): string {
  const painted = p.stateEdits[s.id]?.owner
  if (painted) return painted
  if (noNationActive(p)) return technicalCountry(p)?.tag ?? p.mapSettings.noNation.tag
  return s.owner
}

/** Cores que tendrá el estado al exportar (en pendientes se quitan los del juego) */
export function exportCores(s: MapState, p: Project): string[] {
  const cores = effectiveCores(s, p)
  if (!noNationActive(p) || p.stateEdits[s.id]?.owner || p.mapSettings.noNation.keepGameCores)
    return cores
  // Solo se respetan los cores de MIS países
  const mine = new Set(p.countries.filter((c) => !c.technical).map((c) => c.tag))
  return cores.filter((t) => mine.has(t))
}

/** Capital del país técnico: el primer estado pendiente (lo necesita su historia) */
export function withTechnicalCapital(p: Project, map: MapData | null): Project {
  const tech = technicalCountry(p)
  if (!tech || !map) return p
  const first = pendingStates(p, map)[0] ?? null
  return { ...p, countries: p.countries.map((c) => (c.technical ? { ...c, capital: first } : c)) }
}

/** Siguiente / Anterior en la lista de pendientes (da la vuelta) */
export function nextPendingIndex(count: number, index: number, dir: number): number {
  if (!count) return 0
  return (((index + dir) % count) + count) % count
}

export { effectiveOwner }
