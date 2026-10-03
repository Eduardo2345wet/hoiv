// Batallones (common/units) y equipos (common/units/equipment) del juego, para el editor de ejército.
import { entries, topValue } from './gameBuildings'

export interface GameSubUnit {
  id: string
  /** group = support para las compañías de apoyo */
  group: string
}

/** por verificar con common/units del juego: sub_units = { infantry = { group = infantry … } } */
export function parseSubUnits(text: string): GameSubUnit[] {
  return entries(text, 'sub_units').map(({ key, body }) => ({
    id: key,
    group: topValue(body, 'group') ?? ''
  }))
}

/** Equipos: claves de `equipments = { … }` que no son solo arquetipos */
export function parseEquipments(text: string): string[] {
  return entries(text, 'equipments')
    .filter(({ body }) => topValue(body, 'is_archetype') !== 'yes')
    .map((e) => e.key)
}
