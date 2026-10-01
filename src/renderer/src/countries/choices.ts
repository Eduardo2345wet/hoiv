// Opciones de país para TODOS los selectores: Mis países → En el mapa → Todos los del juego.
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import { BUILTIN_COUNTRIES } from '../catalog/builtin'
import { effectiveOwner } from '../map/mapOps'

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
  const count = new Map<string, number>()
  if (map)
    for (const s of map.states) {
      const o = project ? effectiveOwner(s, project) : s.owner
      if (o) count.set(o, (count.get(o) ?? 0) + 1)
    }
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
  const onMap = [...count.entries()]
    .filter(
      ([t]) => !mineTags.has(t) && !project?.countries.some((c) => c.technical && c.tag === t)
    )
    .map(([tag, states]): CountryChoice => ({ tag, name: nameOf(tag), states, mine: false }))
    .sort(byStatesThenName)
  const onMapTags = new Set(onMap.map((c) => c.tag))
  const all = [...names.keys()]
    .filter((t) => !mineTags.has(t) && !onMapTags.has(t))
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
