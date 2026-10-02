// Plantillas de "Nuevo proyecto". La plantilla se elige al CREAR el proyecto y queda fija:
// decide la base del mapa (lienzo en blanco, mapa del juego, mapa de un mod) y qué pasa con lo
// que no se pinta. Para otra plantilla se crea OTRO proyecto (nunca se copian estados pintados).
import { emptySections } from './sections/types'
import {
  DEFAULT_MAP_SETTINGS,
  PROJECT_VERSION,
  type MapModRef,
  type MapSettings,
  type Project,
  type TemplateId
} from './types'

export type TemplateCategory = 'mapa' | 'contenido'

export interface TemplateInfo {
  id: TemplateId
  category: TemplateCategory
  name: string
  description: string
  /** Detalle largo de la vista previa */
  details: string[]
  /** Pestaña de la cinta con la que se abre el proyecto */
  opensIn: 'mapa' | 'focos'
}

export const CATEGORIES: [TemplateCategory, string][] = [
  ['mapa', 'Mapa'],
  ['contenido', 'Contenido']
]

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'blank',
    category: 'mapa',
    name: 'Lienzo en blanco',
    description: 'Tierra blanca: solo ves en color lo que pintes.',
    details: [
      'Los estados que no pintes conservan su dueño del juego al exportar.',
      'Solo se exportan los estados que pintes.'
    ],
    opensIn: 'mapa'
  },
  {
    id: 'blankNoNation',
    category: 'mapa',
    name: 'Lienzo en blanco + Sin nación',
    description: 'Lo que no pintes queda pendiente.',
    details: [
      'Un país técnico "Sin nación" se queda con todo lo no pintado.',
      'En el juego solo existen tus países. Pensado para empezar en 1936.'
    ],
    opensIn: 'mapa'
  },
  {
    id: 'game',
    category: 'mapa',
    name: 'Mapa del juego',
    description: 'Todos los países con sus colores reales.',
    details: ['Pintas encima de la situación de 1936 del juego.'],
    opensIn: 'mapa'
  },
  {
    id: 'mod',
    category: 'mapa',
    name: 'Mapa de un mod',
    description: 'Usa el mapa y los estados de otro mod instalado.',
    details: [
      'Sus archivos se cargan encima de los del juego.',
      'Tu mod dependerá de él (dependencies en descriptor.mod).'
    ],
    opensIn: 'mapa'
  },
  {
    id: 'content',
    category: 'contenido',
    name: 'Mod sin mapa',
    description: 'Solo focos, países y espíritus.',
    details: ['La pestaña Mapa queda disponible, pero sin cambios en los estados.'],
    opensIn: 'focos'
  }
]

export const templateInfo = (id: TemplateId): TemplateInfo =>
  TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[2]

/** Ajustes del mapa que corresponden a una plantilla */
export function mapSettingsFor(id: TemplateId, mod: MapModRef | null = null): MapSettings {
  const base: MapSettings = {
    ...DEFAULT_MAP_SETTINGS,
    noNation: { ...DEFAULT_MAP_SETTINGS.noNation }
  }
  if (id === 'blank') return { ...base, base: 'blank', unpainted: 'keep' }
  if (id === 'blankNoNation') return { ...base, base: 'blank', unpainted: 'noNation' }
  if (id === 'mod') return { ...base, base: 'mod', mod }
  return { ...base, base: 'game' }
}

/** Plantilla de un proyecto (los viejos la toman de la base que tenían guardada) */
export function templateOf(p: Pick<Project, 'template' | 'mapSettings'>): TemplateId {
  if (p.template) return p.template
  const ms = p.mapSettings
  if (ms.base === 'blank') return ms.unpainted === 'noNation' ? 'blankNoNation' : 'blank'
  if (ms.base === 'mod') return 'mod'
  if (ms.base === 'game') return 'game'
  return 'content'
}

/** Proyecto vacío de una plantilla: sin países ni árboles (se crean después) */
export function emptyProjectFor(
  name: string,
  template: TemplateId,
  mod: MapModRef | null = null
): Project {
  return {
    version: PROJECT_VERSION,
    template,
    modName: name,
    tag: '',
    countries: [],
    focusTrees: [],
    focuses: [],
    ideas: [],
    icons: [],
    countryFlags: [],
    stateEdits: {},
    mapSettings: mapSettingsFor(template, mod),
    ...emptySections()
  }
}
