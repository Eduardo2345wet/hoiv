// Colores de cada estado según el modo de vista. Resultado: una "paleta" RGBA por posición
// de estado (el renderizador la sube a una textura pequeña; cambiar un dueño = pocos texels).
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import { mapColor, hsvToRgb, type RGB } from '../countries/color'
import { colorForTag } from '../countries/countryOps'
import { THEME_RGB } from '../../../shared/map/theme'
import { effectiveCores, effectiveOwner, isChanged } from './mapOps'

export type ViewMode = 'politico' | 'estados' | 'cores' | 'cambios'
export const VIEW_MODES: [ViewMode, string][] = [
  ['politico', 'Político'],
  ['estados', 'Estados'],
  ['cores', 'Cores del país activo'],
  ['cambios', 'Cambios']
]

/** Bits del canal alfa de la paleta */
export const FLAG = {
  active: 1,
  changed: 2,
  selected: 4,
  dim: 8,
  highlight: 16,
  striped: 32
} as const

export const WHITE: RGB = [...THEME_RGB.land]

/** Color PLENO del país (el del mod, el real del juego o uno estable según el tag) */
export function countryFullColor(
  tag: string,
  project: Project | null,
  game: GameCatalog | null
): RGB {
  const mod = project?.countries.find((c) => c.tag === tag)
  if (mod) return mod.color
  return game?.countryColors?.[tag] ?? colorForTag(tag)
}

/** Color del país en el mapa del juego: apagado (saturación ×0.6, valor ×0.8) */
export function countryMapColor(
  tag: string,
  project: Project | null,
  game: GameCatalog | null
): RGB {
  return mapColor(countryFullColor(tag, project, game))
}

/** Color con el que se dibuja un país (pleno o "como en el juego") */
export function countryDrawColor(
  tag: string,
  project: Project | null,
  game: GameCatalog | null,
  gameColors: boolean
): RGB {
  return gameColors ? countryMapColor(tag, project, game) : countryFullColor(tag, project, game)
}

export interface Palette {
  /** RGBA por posición de estado */
  rgba: Uint8Array
  /** Índice numérico del dueño por posición de estado (para las fronteras de país) */
  owners: Uint16Array
}

export interface PaletteOptions {
  mode: ViewMode
  activeTag: string | null
  selectedId: number | null
  /** "Colores como en el juego": apagado ×0.6 / ×0.8 */
  gameColors: boolean
  /** Lienzo en blanco: los estados sin pintar se ven en blanco */
  blankUnpainted: boolean
  /** "Ver pendientes": resalta los estados sin pintar */
  highlightPending: boolean
}

/** ¿El estado fue pintado por el usuario (tiene dueño asignado en stateEdits)? */
export const isPainted = (id: number, p: Project | null): boolean => !!p?.stateEdits[id]?.owner

export function buildPalette(
  map: MapData,
  project: Project | null,
  game: GameCatalog | null,
  opts: PaletteOptions
): Palette {
  const { mode, activeTag, selectedId } = opts
  const n = map.states.length
  const rgba = new Uint8Array(n * 4)
  const owners = new Uint16Array(n)
  const ownerIds = new Map<string, number>()
  const colorCache = new Map<string, RGB>()
  const grey: RGB = [200, 200, 204]
  map.states.forEach((s, i) => {
    const painted = isPainted(s.id, project)
    const blank = opts.blankUnpainted && !painted
    const owner = project ? effectiveOwner(s, project) : s.owner
    // Los estados en blanco cuentan como un solo "dueño" (sin frontera de país entre ellos)
    const ownerKey = blank ? '\u0000blanco' : owner
    if (!ownerIds.has(ownerKey)) ownerIds.set(ownerKey, ownerIds.size + 1)
    owners[i] = ownerIds.get(ownerKey)!
    let c: RGB
    let flags = 0
    if (mode === 'estados') c = hsvToRgb([(s.id * 137.508) % 360, 0.45, 0.85])
    else if (mode === 'cores') {
      const cores = project ? effectiveCores(s, project) : s.cores
      c = activeTag && cores.includes(activeTag) ? [240, 175, 50] : grey
    } else if (mode === 'cambios') {
      if (project && isChanged(s, project)) c = [240, 130, 50]
      else if (blank) {
        c = grey
        flags |= FLAG.striped // pendiente / Sin nación: gris rayado
      } else c = [235, 235, 235]
    } else if (blank) c = WHITE
    else {
      if (!colorCache.has(owner))
        colorCache.set(owner, countryDrawColor(owner, project, game, opts.gameColors))
      c = colorCache.get(owner)!
    }
    if (activeTag && owner === activeTag && !blank) flags |= FLAG.active
    if (project && isChanged(s, project)) flags |= FLAG.changed
    if (s.id === selectedId) flags |= FLAG.selected
    if (opts.highlightPending && blank) flags |= FLAG.highlight
    rgba.set([c[0], c[1], c[2], flags], i * 4)
  })
  return { rgba, owners }
}
