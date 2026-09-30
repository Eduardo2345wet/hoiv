// Catálogo central: dado un tipo, devuelve las opciones disponibles leyendo
// el estado actual del proyecto (lo del mod) y el contenido del juego base.
import type { Project } from '../types'
import { BUILTIN_COUNTRIES, BUILTIN_IDEAS } from './builtin'

export type CatalogKind = 'focus' | 'idea' | 'countryFlag' | 'country' | 'state'

export interface CatalogOption {
  id: string
  etiqueta: string
  origen: 'mod' | 'juego'
  /** uid interno (solo para cosas del mod que lo tienen: focos, espíritus) */
  uid?: string
}

/** Contenido leído de la carpeta del juego (common/country_tags y common/ideas) */
export interface GameCatalog {
  countries: [string, string][]
  ideas: [string, string][]
}

/** Marcas usadas en cualquier set_country_flag del proyecto + las creadas a mano */
export function projectFlags(project: Project): string[] {
  const set = new Set(project.countryFlags)
  for (const f of project.focuses) {
    const s = f.scripts.available + f.scripts.bypass + f.scripts.reward
    for (const m of s.matchAll(/set_country_flag = ([A-Za-z0-9_.]+)/g)) set.add(m[1])
  }
  return [...set].sort()
}

export function getCatalogOptions(
  kind: CatalogKind,
  project: Project | null,
  game: GameCatalog | null = null
): CatalogOption[] {
  const mod: CatalogOption[] = []
  let base: [string, string][] = []
  if (project) {
    switch (kind) {
      case 'focus':
        for (const f of project.focuses)
          mod.push({
            id: f.id,
            etiqueta: f.name || f.id,
            origen: 'mod',
            uid: f.uid
          })
        break
      case 'idea':
        for (const i of project.ideas)
          mod.push({
            id: i.id,
            etiqueta: i.name || i.id,
            origen: 'mod',
            uid: i.uid
          })
        break
      case 'countryFlag':
        for (const fl of projectFlags(project)) mod.push({ id: fl, etiqueta: fl, origen: 'mod' })
        break
      case 'country':
        mod.push({
          id: project.tag,
          etiqueta: `${project.modName} (mi país)`,
          origen: 'mod'
        })
        break
      case 'state':
        // Preparado para elegir estados en el mapa más adelante
        break
    }
  }
  if (kind === 'country') base = game?.countries?.length ? game.countries : BUILTIN_COUNTRIES
  if (kind === 'idea') base = game?.ideas?.length ? game.ideas : BUILTIN_IDEAS

  const seen = new Set(mod.map((o) => o.id))
  const fromGame = base
    .filter(([id]) => !seen.has(id))
    .map(([id, etiqueta]): CatalogOption => ({
      id,
      etiqueta,
      origen: 'juego'
    }))
  // Orden: primero lo del mod, luego lo del juego
  return [...mod, ...fromGame]
}

/** ¿Existe este id en el mod o en el juego? */
export function isKnownId(
  kind: CatalogKind,
  id: string,
  project: Project | null,
  game: GameCatalog | null = null
): boolean {
  return getCatalogOptions(kind, project, game).some((o) => o.id === id)
}
