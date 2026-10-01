// Pincel activo del mapa (un país) y los últimos usados. No va al historial de deshacer.
import { store } from '../store/appStore'
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import { DEMO_COUNTRY_NAMES } from '../../../shared/map/demo'

/** Pincel especial "Sin nación": devuelve estados a pendiente (como el clic derecho) */
export const NO_NATION = '\u0000sin_nacion'

/** Máximo de países en "Recientes" */
export const RECENT_MAX = 8

/** Nombre legible de un país: el del mod, el del juego (localización) o el tag */
export function countryLabel(
  tag: string,
  project: Project | null,
  game: GameCatalog | null
): string {
  const mod = project?.countries.find((c) => c.tag === tag)
  if (mod) return mod.names.name || tag
  return game?.countries.find(([t]) => t === tag)?.[1] ?? DEMO_COUNTRY_NAMES[tag] ?? tag
}

/**
 * Elige el país con el que se pinta. NO agrega nada al proyecto: pintar con un país del juego
 * solo guarda su tag como dueño en stateEdits.
 */
export function setBrush(tag: string | null): void {
  const recent = store.get().recentTags
  store.set({
    activeTag: tag,
    recentTags:
      tag && tag !== NO_NATION
        ? [tag, ...recent.filter((t) => t !== tag)].slice(0, RECENT_MAX)
        : recent
  })
}
