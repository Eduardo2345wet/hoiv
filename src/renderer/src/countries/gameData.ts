// Datos del juego base para países cuando NO hay carpeta de HOI4.
// Todo lo marcado "// por verificar" no se pudo comprobar contra la wiki ni los archivos
// del juego (el acceso estaba bloqueado). Con la carpeta del juego configurada se leen los reales.
import type { Ideology } from '../types'

/** Subideologías por ideología (common/ideologies) */
export const BUILTIN_SUBIDEOLOGIES: Record<Ideology, string[]> = {
  democratic: ['conservatism', 'liberalism', 'socialism'],
  neutrality: ['despotism', 'oligarchism', 'anarchism', 'moderatism', 'centrism'],
  // por verificar: IDs exactos de las subideologías comunistas
  communism: ['marxism', 'leninism', 'stalinism', 'anti_revisionism', 'anarchist_communism'],
  // por verificar
  fascism: ['nazism', 'fascism_ideology']
}

// por verificar: valores de graphical_culture del juego base
export const BUILTIN_GRAPHICAL_CULTURES = [
  'western_european_gfx',
  'eastern_european_gfx',
  'middle_eastern_gfx',
  'asian_gfx',
  'southamerican_gfx',
  'commonwealth_gfx',
  'african_gfx'
]

// por verificar: valores de graphical_culture_2d del juego base
export const BUILTIN_GRAPHICAL_CULTURES_2D = [
  'western_european_2d',
  'eastern_european_2d',
  'middle_eastern_2d',
  'asian_2d',
  'southamerican_2d',
  'commonwealth_2d',
  'african_2d'
]

// por verificar: conjunto mínimo de tecnologías para poder usar la plantilla de infantería
export const BASIC_TECHNOLOGIES = [
  'infantry_weapons',
  'infantry_weapons1',
  'tech_support',
  'tech_engineers'
]

// por verificar contra un OOB del juego: plantilla básica de infantería (sin divisiones desplegadas)
export const BASIC_DIVISION_TEMPLATE = `division_template = {
\tname = "Infantry Division"
\tregiments = {
\t\tinfantry = { x = 0 y = 0 }
\t\tinfantry = { x = 0 y = 1 }
\t\tinfantry = { x = 1 y = 0 }
\t\tinfantry = { x = 1 y = 1 }
\t}
}
`

/** Fecha de fin del líder */
export const LEADER_EXPIRE = '1965.1.1.1'

/** Nombres de partido por defecto (editables) */
export const DEFAULT_PARTIES: Record<Ideology, { short: string; long: string }> = {
  democratic: { short: 'Demócratas', long: 'Partido Demócrata' },
  fascism: { short: 'Nacionalistas', long: 'Partido Nacionalista' },
  communism: { short: 'Comunistas', long: 'Partido Comunista' },
  neutrality: { short: 'Independientes', long: 'Gobierno Independiente' }
}
