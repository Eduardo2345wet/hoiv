// Reglas del validador para los datos de estado editados (S6): niveles, costa, provincias, población.
import type { Project } from '../types'
import type { MapData } from '../../../shared/map/types'
import type { GameCatalog } from '../catalog/catalog'
import { BUILTIN_CATEGORIES, COASTAL_ONLY, buildingInfo, hasProps } from './stateProps'

export interface StateDataIssue {
  severity: 'error' | 'aviso'
  message: string
  stateId: number
}

export function validateStateData(
  project: Project,
  map: MapData,
  game?: GameCatalog | null
): StateDataIssue[] {
  const out: StateDataIssue[] = []
  const info = buildingInfo(game)
  const categories = new Set(game?.stateCategories ?? BUILTIN_CATEGORIES)
  for (const s of map.states) {
    const e = project.stateEdits[s.id]
    if (!hasProps(e)) continue
    const at = (severity: StateDataIssue['severity'], m: string): number =>
      out.push({ severity, message: `Estado ${s.name} (#${s.id}): ${m}`, stateId: s.id })
    if (e.manpower !== undefined && !(e.manpower > 0))
      at('error', 'la población debe ser mayor que 0.')
    if (e.category !== undefined && !categories.has(e.category))
      at('error', `la categoría ${e.category} no existe en el juego.`)
    for (const [k, v] of Object.entries(e.resources ?? {}))
      if (v < 0) at('error', `el recurso ${k} no puede ser negativo.`)
    const level = (kind: string, v: number, where: string): void => {
      const b = info[kind]
      if (v < 0 || !Number.isInteger(v))
        at('error', `${kind} ${where}: el nivel debe ser un entero ≥ 0.`)
      else if (b && v > b.max)
        at('error', `${kind} ${where}: el nivel ${v} pasa el máximo (${b.max}).`)
    }
    for (const [k, v] of Object.entries(e.buildings ?? {})) {
      level(k, v, 'del estado')
      if (info[k]?.provincial && v > 0)
        at('aviso', `${k} es un edificio por provincia: ponlo en una provincia, no en el estado.`)
    }
    for (const [prov, bs] of Object.entries(e.provinceBuildings ?? {})) {
      const pn = Number(prov)
      if (!s.provinces.includes(pn)) at('error', `la provincia ${prov} no pertenece a este estado.`)
      for (const [k, v] of Object.entries(bs)) {
        level(k, v, `en la provincia ${prov}`)
        if (v > 0 && COASTAL_ONLY.includes(k) && !map.provinceCoastal[pn])
          at('error', `${k} solo puede ir en una provincia costera (la ${prov} no lo es).`)
      }
    }
    for (const [prov, v] of Object.entries(e.victoryPoints ?? {})) {
      if (!s.provinces.includes(Number(prov)))
        at(
          'error',
          `el punto de victoria está en la provincia ${prov}, que no pertenece a este estado.`
        )
      if (v < 0 || !Number.isInteger(v))
        at('error', 'los puntos de victoria deben ser enteros ≥ 0.')
    }
  }
  return out
}
