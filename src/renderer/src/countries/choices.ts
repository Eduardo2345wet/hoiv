// Opciones de país para TODOS los selectores: Mis países → En el mapa → Todos los del juego.
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import { BUILTIN_COUNTRIES } from '../catalog/builtin'
import { getOwnerCounts } from '../map/mapOps'

export interface CountryChoice {
  tag: string
  name: string
  /** Estados que tiene ahora en este proyecto (plantilla + lo pintado) */
  states: number
  mine: boolean
}

export interface CountrySections {
  mine: CountryChoice[]
  onMap: CountryChoice[]
  game: CountryChoice[]
}

const byStatesThenName = (a: CountryChoice, b: CountryChoice): number =>
  b.states - a.states || a.name.localeCompare(b.name)

export function countrySections(
  project: Project | null,
  map: MapData | null,
  game: GameCatalog | null
): CountrySections {
  // Conteos de ESTE mapa (effectiveOwner); sin proyecto, los de la base
  const count = project && map ? getOwnerCounts(map, project) : new Map<string, number>()
  if (!project && map)
    for (const s of map.states) if (s.owner) count.set(s.owner, (count.get(s.owner) ?? 0) + 1)
  const technical = new Set((project?.countries ?? []).filter((c) => c.technical).map((c) => c.tag))
  const mineTags = new Set<string>()
  const mine: CountryChoice[] = []
  for (const c of project?.countries ?? []) {
    if (c.technical || c.light) continue
    mineTags.add(c.tag)
    mine.push({
      tag: c.tag,
      name: c.names.name || c.tag,
      states: count.get(c.tag) ?? 0,
      mine: true
    })
  }
  const names = new Map<string, string>(
    game?.countries?.length ? game.countries : BUILTIN_COUNTRIES
  )
  for (const c of project?.countries ?? [])
    if (c.light) names.set(c.tag, c.names.name || names.get(c.tag) || c.tag)
  const nameOf = (t: string): string => names.get(t) ?? t
  // En el mapa: SOLO países con al menos 1 estado en este mapa (no los del mod: ya están arriba)
  const onMap = [...count.entries()]
    .filter(([t, n]) => n > 0 && !mineTags.has(t) && !technical.has(t))
    .map(([tag, states]): CountryChoice => ({ tag, name: nameOf(tag), states, mine: false }))
    .sort(byStatesThenName)
  const onMapTags = new Set(onMap.map((c) => c.tag))
  const all = [...names.keys()]
    .filter((t) => !mineTags.has(t) && !onMapTags.has(t) && !technical.has(t))
    .map((tag): CountryChoice => ({
      tag,
      name: nameOf(tag),
      states: count.get(tag) ?? 0,
      mine: false
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { mine: mine.sort(byStatesThenName), onMap, game: all }
}

/** Búsqueda por nombre o tag (sin tildes ni mayúsculas) */
export function matchChoice(c: CountryChoice, q: string): boolean {
  const n = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const t = n(q.trim())
  return !t || n(c.name).includes(t) || n(c.tag).includes(t)
}
