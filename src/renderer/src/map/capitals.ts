// Capitales de los países DEL JUEGO: cuáles quedan sin su estado por mis cambios en el mapa y
// a dónde se mueven al exportar. (La capital de mis países nuevos la valida validateMap.)
import type { Country, Project } from '../types'
import type { MapData, MapState } from '../../../shared/map/types'
import type { GameCatalog } from '../catalog/catalog'
import { exportOwner, technicalCountry } from './noNation'
import { store } from '../store/appStore'

export interface LostCapital {
  tag: string
  name: string
  /** Estado que era su capital */
  capital: number
  /** Dueño de ese estado ahora ('' = ninguno) */
  newOwner: string
  /** Estados que le quedan al país */
  remaining: number
}

export interface CapitalMove extends LostCapital {
  /** Nueva capital (null = el país se queda sin estados: no se toca) */
  to: number | null
  /** Elegida a mano en la tarjeta del país */
  manual: boolean
}

/** Capital actual de un país del juego: la que editó el asistente o, si no, la de history/countries */
export function currentGameCapital(
  tag: string,
  project: Project,
  game: GameCatalog | null
): number | null {
  const c = project.countries.find((x) => x.tag === tag)
  if (c && !c.technical && c.mode === 'nuevo') return null // los países nuevos los valida validateMap
  if (c?.existing.historyEdited && c.capital) return c.capital
  return game?.countryCapitals?.[tag] ?? null
}

const countryName = (tag: string, game: GameCatalog | null, c?: Country): string =>
  c?.names.name || game?.countries.find(([t]) => t === tag)?.[1] || tag

/** Puntos de victoria de un estado (suma de todas sus provincias) */
const vpOf = (s: MapState): number => s.victoryPoints.reduce((a, [, v]) => a + v, 0)

/** Estados que tiene cada tag al exportar */
function statesByOwner(project: Project, map: MapData): Map<string, MapState[]> {
  const by = new Map<string, MapState[]>()
  for (const s of map.states) {
    const o = exportOwner(s, project)
    if (!o) continue
    const l = by.get(o)
    if (l) l.push(s)
    else by.set(o, [s])
  }
  return by
}

/** Mejor capital entre los estados que le quedan: más victory points, más provincias, id menor */
export function bestCapital(map: MapData, project: Project, tag: string): number | null {
  const own = statesByOwner(project, map).get(tag)
  if (!own?.length) return null
  return [...own].sort(
    (a, b) => vpOf(b) - vpOf(a) || b.provinces.length - a.provinces.length || a.id - b.id
  )[0].id
}

/** Países del juego cuyo estado de capital ahora es de otro país */
export function lostCapitals(
  project: Project,
  map: MapData | null,
  game: GameCatalog | null
): LostCapital[] {
  if (!map) return []
  const byId = new Map(map.states.map((s) => [s.id, s]))
  const owners = statesByOwner(project, map)
  const tech = technicalCountry(project)?.tag
  // Solo cuentan los países que EXISTÍAN al inicio en la base (los liberables o formables que
  // ya empiezan sin estados no son cosa mía: no se avisa ni se mueve nada)
  const existed = new Set(map.states.map((s) => s.owner))
  const tags = new Set([
    ...Object.keys(game?.countryCapitals ?? {}),
    ...project.countries.filter((c) => c.mode === 'existente').map((c) => c.tag)
  ])
  const out: LostCapital[] = []
  for (const tag of [...tags].sort()) {
    if (tag === tech || !existed.has(tag)) continue
    const cap = currentGameCapital(tag, project, game)
    const s = cap ? byId.get(cap) : undefined
    if (!cap || !s) continue
    const owner = exportOwner(s, project)
    if (owner === tag) continue
    out.push({
      tag,
      name: countryName(
        tag,
        game,
        project.countries.find((c) => c.tag === tag)
      ),
      capital: cap,
      newOwner: owner,
      remaining: owners.get(tag)?.length ?? 0
    })
  }
  return out
}

/** Qué capitales se mueven al exportar (vacío si el ajuste está apagado) */
export function planCapitalMoves(
  project: Project,
  map: MapData | null,
  game: GameCatalog | null
): CapitalMove[] {
  if (!map || project.mapSettings.moveLostCapitals === false) return []
  const own = statesByOwner(project, map)
  return lostCapitals(project, map, game).map((l) => {
    const choice = project.mapSettings.capitalChoices?.[l.tag]
    const valid = !!choice && own.get(l.tag)?.some((s) => s.id === choice)
    return {
      ...l,
      to: valid ? choice! : bestCapital(map, project, l.tag),
      manual: !!valid
    }
  })
}

/**
 * Los países del juego editados con el asistente llevan su capital nueva en `capital`: así su
 * archivo de historia (uno solo) sale con la edición del asistente Y la capital movida.
 */
export function withMovedCapitals(
  project: Project,
  map: MapData | null,
  game: GameCatalog | null
): Project {
  const moves = planCapitalMoves(project, map, game).filter((m) => m.to !== null)
  if (!moves.length) return project
  return {
    ...project,
    countries: project.countries.map((c) => {
      const m = c.existing.historyEdited && moves.find((x) => x.tag === c.tag)
      return m ? { ...c, capital: m.to } : c
    })
  }
}

/** Mensaje del informe al exportar: "Capital de Guangxi movida del estado 594 al 596" */
export const moveReport = (m: CapitalMove): string =>
  `Capital de ${m.name} movida del estado ${m.capital} al ${m.to}`

/** ¿Existía el país al inicio (tiene al menos un estado en la base, sin mis cambios)? */
export const existedAtStart = (map: MapData | null, tag: string): boolean =>
  !!map?.states.some((s) => s.owner === tag)

/**
 * "Dejarle un estado": el estado elegido vuelve a ser suyo y pasa a ser su capital, todo en UN
 * paso de deshacer.
 */
export function leaveState(tag: string, stateId: number, map: MapData | null): void {
  if (!map?.states.some((s) => s.id === stateId)) return
  store.updateProject((p) => ({
    ...p,
    stateEdits: { ...p.stateEdits, [stateId]: { ...p.stateEdits[stateId], owner: tag } },
    mapSettings: {
      ...p.mapSettings,
      capitalChoices: { ...p.mapSettings.capitalChoices, [tag]: stateId }
    }
  }))
}
