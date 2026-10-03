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

/** Grupo de eventos: un namespace y un archivo (se genera solo a partir del nombre) */
export interface EventGroup {
  uid: string
  namespace: string
  name: string
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
  /** Sentencias que la app no entiende (de un mod importado): se exportan tal cual */
  extraText?: string
  flags: {
    triggeredOnly: boolean
    fireOnlyOnce: boolean
    major: boolean
    hidden: boolean
    minorFlavor: boolean
  }
}

/** Sonido (.wav) subido: bytes en base64 */
export interface SoundFile {
  name: string
  base64: string
}

/** Ventana grande propia (scripted GUI) con imagen, cita y sonido */
export interface SuperEvent {
  uid: string
  /** id con el prefijo del mod (por ejemplo mimod_caida); el efecto es <id>_show */
  id: string
  title: string
  quote: string
  author: string
  button: string
  image: EventPicture | null
  sound: SoundFile | null
  /** Quién la ve: todos los humanos, solo el país que la dispara o una lista */
  audience: 'all' | 'self' | 'list'
  countries: string[]
  /** true = si ya hay una abierta, la nueva espera su turno; false = la reemplaza */
  queue: boolean
  /** Grupo opcional para ordenar la lista ('' o ausente = sin grupo) */
  group?: string
}

/** Categoría de decisiones (common/decisions/categories) */
export interface DecisionCategory {
  uid: string
  id: string
  name: string
  description: string
  /** Ícono (se antepone GFX_decision_category_) */
  icon: IconRef | null
  /** Imagen grande de la categoría: solo se ve si la categoría tiene descripción */
  picture: IconRef | null
  priority: number
  visibleWhenEmpty: boolean
  /** Estados que se resaltan en el mapa al abrir la categoría (highlight_states) */
  highlightStates: number[]
  /** Centro del mapa al abrir la categoría (on_map_area); null = no se mueve */
  mapArea: { x: number; y: number; zoom: number } | null
}

export type DecisionKind = 'normal' | 'mission' | 'target-country' | 'target-state'

export interface DecisionCost {
  mode: 'none' | 'pp' | 'custom'
  /** Poder político (cost) */
  pp: number
  /** custom_cost_trigger: no cobra nada, hay que restarlo en complete_effect */
  customTrigger: BlockScript
  customText: string
  /** ai_hint_pp_cost */
  aiHintPp: number
}

export interface Decision {
  uid: string
  id: string
  categoryUid: string | null
  kind: DecisionKind
  name: string
  description: string
  icon: IconRef | null
  priority: number
  /** Países a los que aplica (genera allowed con tag); vacío = cualquiera */
  countries: string[]
  visible: BlockScript
  available: BlockScript
  complete: BlockScript
  remove: BlockScript
  timeout: BlockScript
  cancel: BlockScript
  cancelTrigger: BlockScript
  cost: DecisionCost
  daysReEnable: number
  fireOnlyOnce: boolean
  /** days_remove: duración del temporizador (0 = sin temporizador) */
  daysRemove: number
  /** Modificador (clave de modificador de país + valor) mientras corre el temporizador */
  modifiers: { key: string; value: number }[]
  /** Peso base de la IA y modificadores; 0 base = la IA nunca la elige */
  aiBase: number
  aiModifiers: { factor: number; trigger: BlockScript }[]
  /** Misiones */
  missionTimeoutDays: number
  selectableMission: boolean
  isGood: boolean
  activation: BlockScript
  /** Con objetivo */
  targetCountries: string[]
  targetStates: number[]
  targetTrigger: BlockScript
  onMapMode: string
  warWithOnComplete: string
  warWithOnRemove: string
  /** Sentencias que la app no entiende (de un mod importado): se exportan tal cual */
  extraText?: string
}

export type CharacterRole =
  'country_leader' | 'advisor' | 'corps_commander' | 'field_marshal' | 'navy_leader'

export type AdvisorSlot =
  'political_advisor' | 'theorist' | 'army_chief' | 'navy_chief' | 'air_chief' | 'high_command'

export interface Character {
  uid: string
  /** Id del personaje (también la clave de localización del nombre) */
  id: string
  name: string
  country: string
  roles: CharacterRole[]
  /** Retratos PNG (data URL) por tipo: civil (líder/asesor), ejército y armada */
  portraits: { civilian: string | null; army: string | null; navy: string | null }
  /** recruit_character al inicio de la partida */
  recruit: boolean
  leader: { ideology: string; traits: string[]; expire: string }
  advisor: {
    slot: AdvisorSlot
    /** idea_token único */
    ideaToken: string
    cost: number
    traits: string[]
    allowed: BlockScript
    canBeFired: boolean
  }
  army: {
    skill: number
    attack: number
    defense: number
    planning: number
    logistics: number
    traits: string[]
  }
  navy: {
    skill: number
    attack: number
    defense: number
    maneuvering: number
    coordination: number
    traits: string[]
  }
}

/** Situación inicial de un país (diplomacia, facciones, estabilidad…) */
export interface CountryStart {
  country: string
  /** Porcentajes 0–100 (null = no se toca lo que dice el juego) */
  stability: number | null
  warSupport: number | null
  convoys: number | null
  researchSlots: number | null
  ideas: string[]
  technologies: string[]
  /** Facción: name = crear una con este nombre; joins = unirse a la de ese país (tag) */
  faction: { name: string; joins: string | null } | null
  puppets: { tag: string; autonomy: string }[]
  guarantees: string[]
  /** Guerras al inicio (on_actions on_startup + declare_war_on) */
  wars: string[]
  /** 1936 (por defecto) o 1939: en 1939 todo va en un bloque con fecha */
  startDate: '1936' | '1939'
}

/** Plantilla de división: batallones en la cuadrícula de combate y compañías de apoyo */
export interface OobTemplate {
  name: string
  regiments: { type: string; x: number; y: number }[]
  /** Columna de apoyo: y = posición (x siempre 0) */
  support: { type: string; y: number }[]
}

export interface OobDivision {
  uid: string
  /** Nombre de la plantilla */
  template: string
  /** Provincia de TIERRA donde empieza */
  province: number
  /** Nombre propio; vacío = el del juego */
  name: string
  /** Número de orden (division_name ordenado); null = no se usa */
  ordinal: number | null
  /** Experiencia inicial 0–1 (start_experience_factor) */
  experience: number
  /** Equipo inicial 0–1 (start_equipment_factor) */
  equipment: number
}

/** Ejército inicial de un país */
export interface Oob {
  country: string
  templates: OobTemplate[]
  divisions: OobDivision[]
  /** Producción inicial opcional (instant_effect) */
  production: { equipment: string; factories: number }[]
}

/** Tecnología nueva dentro de una carpeta EXISTENTE de la pantalla de investigación (modo avanzado) */
export interface Technology {
  uid: string
  id: string
  name: string
  description: string
  /** Carpeta del juego (folder = { name = … }), ej. infantry_folder */
  folder: string
  /** Posición en la cuadrícula de la carpeta */
  x: number
  y: number
  /** research_cost */
  cost: number
  /** start_year */
  year: number
  /** Categorías (ej. infantry_weapons) */
  categories: string[]
  /** Qué desbloquea (tecnologías hijas): van en el path de ESTA tecnología */
  leadsTo: string[]
  /** Quién la desbloquea (líneas): si es del juego, se parchea su path con parche mínimo */
  prerequisites: string[]
}

/** Subideología nueva dentro de uno de los 4 grupos del juego */
export interface IdeologyDef {
  uid: string
  group: 'democratic' | 'communism' | 'fascism' | 'neutrality'
  id: string
  name: string
  description: string
  /** Color opcional de la subideología (r g b) */
  color: [number, number, number] | null
  /** Ícono opcional (PNG en data URL) */
  icon: string | null
}

export interface Bookmark {
  uid: string
  name: string
  description: string
  /** 1936.1.1.12 */
  date: string
  defaultCountry: string
  /** Es el escenario marcado como `default = yes` */
  isDefault: boolean
  picture: IconRef | null
  /** Países destacados de la pantalla de selección */
  featured: { tag: string; ideology: string; history: string; ideas: string[]; focuses: string[] }[]
}

/** Archivo subido (.ogg…): bytes en base64 */
export interface UploadedFile {
  name: string
  base64: string
}

export interface MusicTrack {
  uid: string
  /** Nombre de la canción (se vuelve el id con el prefijo del mod) */
  name: string
  /** Estación a la que se añade ('' = la estación propia del mod) */
  station: string
  ogg: UploadedFile | null
  /** Peso base (chance) */
  weight: number
  /** Condición simple: solo suena si se cumple (vacía = siempre) */
  condition: BlockScript
}

export interface LoadingScreen {
  uid: string
  name: string
  /** Imagen subida (PNG/JPG en data URL) o de mi biblioteca */
  image: IconRef | null
  upload: { name: string; png: string } | null
}

/** Idiomas del mod: el inglés es la base obligatoria */
export interface LanguageSetting {
  code: string
  /** Traducciones por clave de localización (si falta, se usa el texto en inglés) */
  strings?: Record<string, string>
}

/** Colecciones nuevas de Project, vacías por defecto */
export interface SectionData {
  events: GameEvent[]
  eventGroups: EventGroup[]
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
  eventGroups: [],
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
