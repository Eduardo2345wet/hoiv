// Colores de cada estado según el modo de vista. Resultado: una "paleta" RGBA por posición
// de estado (el renderizador la sube a una textura pequeña; cambiar un dueño = pocos texels).
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import { mapColor, hsvToRgb, type RGB } from '../countries/color'
import { colorForTag } from '../countries/countryOps'
import { effectiveCores, effectiveOwner, isChanged } from './mapOps'

export type ViewMode = 'politico' | 'estados' | 'cores' | 'cambios'
export const VIEW_MODES: [ViewMode, string][] = [
  ['politico', 'Político'],
  ['estados', 'Estados'],
  ['cores', 'Cores del país activo'],
  ['cambios', 'Cambios']
]

/** Bits del canal alfa de la paleta */
export const FLAG = { active: 1, changed: 2, selected: 4, dim: 8 } as const

/** Color del país en el mapa: apagado (saturación ×0.6, valor ×0.8), como en el juego */
export function countryMapColor(
  tag: string,
  project: Project | null,
  game: GameCatalog | null
): RGB {
  const mod = project?.countries.find((c) => c.tag === tag)
  if (mod) return mapColor(mod.color)
  const g = game?.countryColors?.[tag]
  return mapColor(g ?? colorForTag(tag))
}

export interface Palette {
  /** RGBA por posición de estado */
  rgba: Uint8Array
  /** Índice numérico del dueño por posición de estado (para las fronteras de país) */
  owners: Uint16Array
}

export function buildPalette(
  map: MapData,
  project: Project | null,
  game: GameCatalog | null,
  mode: ViewMode,
  activeTag: string | null,
  selectedId: number | null
): Palette {
  const n = map.states.length
  const rgba = new Uint8Array(n * 4)
  const owners = new Uint16Array(n)
  const ownerIds = new Map<string, number>()
  const colorCache = new Map<string, RGB>()
  const grey: RGB = [92, 92, 100]
  map.states.forEach((s, i) => {
    const owner = project ? effectiveOwner(s, project) : s.owner
    if (!ownerIds.has(owner)) ownerIds.set(owner, ownerIds.size + 1)
    owners[i] = ownerIds.get(owner)!
    let c: RGB
    if (mode === 'estados') c = hsvToRgb([(s.id * 137.508) % 360, 0.45, 0.8])
    else if (mode === 'cores') {
      const cores = project ? effectiveCores(s, project) : s.cores
      c = activeTag && cores.includes(activeTag) ? [230, 170, 40] : grey
    } else if (mode === 'cambios') c = project && isChanged(s, project) ? [230, 120, 40] : grey
    else {
      if (!colorCache.has(owner)) colorCache.set(owner, countryMapColor(owner, project, game))
      c = colorCache.get(owner)!
    }
    let flags = 0
    if (activeTag && owner === activeTag) flags |= FLAG.active
    else if (activeTag && mode === 'politico') flags |= FLAG.dim
    if (project && isChanged(s, project)) flags |= FLAG.changed
    if (s.id === selectedId) flags |= FLAG.selected
    rgba.set([c[0], c[1], c[2], flags], i * 4)
  })
  return { rgba, owners }
}
