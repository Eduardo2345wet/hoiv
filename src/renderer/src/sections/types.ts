// Modelos de las secciones nuevas (eventos, decisiones, personajes…). Viven DENTRO de Project
// (proyecto.json): nada global, nada de demostración. Cada sección amplía su modelo en su etapa.
import type { IconRef } from '../types'

/** Una cadena de efectos o condiciones hecha con bloques: estado de Blockly + el texto generado */
export interface BlockScript {
  blocks: unknown | null
  code: string
}
export const emptyScript = (): BlockScript => ({ blocks: null, code: '' })

/** Imagen de un evento: del juego, de mi biblioteca (icons) o subida directamente */
export type EventPicture =
  | { kind: 'game'; gfx: string }
  | { kind: 'asset'; assetId: string }
  | { kind: 'upload'; png: string; name: string }

export interface EventVariant {
  text: string
  trigger: BlockScript
}

export interface EventOption {
  uid: string
  name: string
  trigger: BlockScript
  effects: BlockScript
  /** ai_chance base (proporcional); 0 = la IA nunca la elige por azar */
  aiBase: number
}

export interface GameEvent {
  uid: string
  type: 'country_event' | 'news_event' | 'state_event'
  namespace: string
  number: number
  /** Países a los que aplica (tags); vacío = el que lo dispare */
  countries: string[]
  title: string
  description: string
  /** Variantes condicionales: la primera cuyo trigger se cumpla se muestra (la base va al final) */
  titleVariants: EventVariant[]
  descVariants: EventVariant[]
  picture: EventPicture | null
  trigger: BlockScript
  immediate: BlockScript
  after: BlockScript
  options: EventOption[]
  /** mean_time_to_happen en días (0 = ninguno) */
  mtthDays: number
  /** timeout_days (0 = el valor por defecto del juego, 13) */
  timeoutDays: number
  flags: {
    triggeredOnly: boolean
    fireOnlyOnce: boolean
    major: boolean
    hidden: boolean
    minorFlavor: boolean
  }
}

export interface SuperEvent {
  uid: string
  id: string
  title: string
  quote: string
  author: string
  button: string
  image: IconRef | null
  sound: string | null
}

export interface DecisionCategory {
  uid: string
  id: string
  name: string
  description: string
  icon: IconRef | null
  priority: number
}

export interface Decision {
  uid: string
  id: string
  categoryUid: string | null
  kind: 'normal' | 'mission' | 'target-country' | 'target-state'
  name: string
  description: string
  icon: IconRef | null
  countries: string[]
  visible: BlockScript
  available: BlockScript
  complete: BlockScript
  cost: number
}

export type CharacterRole =
  'country_leader' | 'advisor' | 'corps_commander' | 'field_marshal' | 'navy_leader'

export interface Character {
  uid: string
  id: string
  name: string
  country: string
  roles: CharacterRole[]
  portrait: IconRef | null
  recruit: boolean
}

/** Situación inicial de un país (diplomacia, facciones, estabilidad…) */
export interface CountryStart {
  country: string
  stability: number | null
  warSupport: number | null
  faction: { name: string; joins: string | null } | null
  puppets: { tag: string; autonomy: string }[]
  guarantees: string[]
}

/** Ejército inicial de un país */
export interface Oob {
  country: string
  templates: {
    name: string
    regiments: { type: string; x: number; y: number }[]
    support: string[]
  }[]
  divisions: { template: string; province: number; name: string }[]
}

export interface Technology {
  uid: string
  id: string
  folder: string
  cost: number
  year: number
  leadsTo: string[]
}

export interface IdeologyDef {
  uid: string
  group: 'democratic' | 'communism' | 'fascism' | 'neutrality'
  id: string
  name: string
}

export interface Bookmark {
  uid: string
  name: string
  description: string
  date: string
  defaultCountry: string
  picture: IconRef | null
}

export interface MusicTrack {
  uid: string
  name: string
  file: string
  weight: number
}

export interface LoadingScreen {
  uid: string
  name: string
  image: IconRef | null
}

/** Idiomas del mod: el inglés es la base obligatoria */
export interface LanguageSetting {
  code: string
}

/** Colecciones nuevas de Project, vacías por defecto */
export interface SectionData {
  events: GameEvent[]
  superEvents: SuperEvent[]
  decisionCategories: DecisionCategory[]
  decisions: Decision[]
  characters: Character[]
  countryStart: CountryStart[]
  oobs: Oob[]
  technologies: Technology[]
  ideologies: IdeologyDef[]
  bookmarks: Bookmark[]
  music: MusicTrack[]
  loadingScreens: LoadingScreen[]
  languages: LanguageSetting[]
}

export const emptySections = (): SectionData => ({
  events: [],
  superEvents: [],
  decisionCategories: [],
  decisions: [],
  characters: [],
  countryStart: [],
  oobs: [],
  technologies: [],
  ideologies: [],
  bookmarks: [],
  music: [],
  loadingScreens: [],
  languages: [{ code: 'english' }]
})

/** Claves de las colecciones (para migrar y para los contadores del Navegador) */
export const SECTION_KEYS = Object.keys(emptySections()) as (keyof SectionData)[]
