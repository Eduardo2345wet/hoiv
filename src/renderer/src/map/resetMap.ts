// Cambios de los ajustes del mapa de un proyecto y "Reiniciar el mapa con otra plantilla".
// La plantilla es parte del proyecto; reiniciarla es una acción aparte, confirmada y deshacible.
import type { MapData } from '../../../shared/map/types'
import type { GameCatalog } from '../catalog/catalog'
import type { MapModRef, MapSettings, Project, TemplateId } from '../types'
import { mapSettingsFor } from '../templates'
import { store } from '../store/appStore'
import { syncNoNation } from './noNation'

/**
 * Cambia los datos del país técnico "Sin nación". La plantilla (base, mod y qué pasa con lo no
 * pintado) NO se puede cambiar por aquí: para eso hay un proyecto nuevo o resetMapWithTemplate.
 * (Antes se cambiaba la base con los estados ya pintados encima y por eso "se quedaban".)
 */
export function setMapSettings(patch: Pick<Partial<MapSettings>, 'noNation'>): void {
  const { map } = store.get()
  store.updateProject((p) =>
    syncNoNation({ ...p, mapSettings: { ...p.mapSettings, ...patch } }, store.catalogGame(), map)
  )
}

/** Cuántos estados pintó el usuario en el proyecto */
export const paintedCount = (p: Project): number => Object.keys(p.stateEdits).length

/**
 * Proyecto con otra plantilla y el mapa LIMPIO: stateEdits vacío (la plantilla vieja y lo
 * pintado sobre ella ya no tienen sentido). Función pura; la acción de la interfaz la aplica con
 * un solo paso de deshacer.
 */
export function resetMapProject(
  p: Project,
  template: TemplateId,
  mod: MapModRef | null,
  game: GameCatalog | null,
  map: MapData | null
): Project {
  const next: Project = {
    ...p,
    template,
    stateEdits: {},
    mapSettings: mapSettingsFor(template, mod)
  }
  return syncNoNation(next, game, map)
}

/** Pide confirmación y reinicia el mapa del proyecto activo. Devuelve si se aplicó. */
export async function resetMapWithTemplate(
  template: TemplateId,
  mod: MapModRef | null
): Promise<boolean> {
  const p = store.get().project
  if (!p) return false
  const n = paintedCount(p)
  const a = await store.askUser({
    title: 'Reiniciar el mapa',
    message:
      n > 0
        ? `Se borrarán ${n} estados pintados en este proyecto. Podrás deshacerlo con Ctrl+Z.`
        : 'El mapa de este proyecto empezará de cero con la nueva plantilla.',
    buttons: [
      { label: 'Reiniciar el mapa', value: 'ok', primary: true },
      { label: 'Cancelar', value: 'cancel' }
    ]
  })
  if (a !== 'ok') return false
  const { game, map } = { game: store.catalogGame(), map: store.get().map }
  store.updateProject((q) => resetMapProject(q, template, mod, game, map))
  void store.ensureMap()
  return true
}
