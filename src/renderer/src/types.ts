// Tipos de datos del proyecto (lo que se guarda en proyecto.json)

/** Versión actual del formato de proyecto.json (ver migrate.ts) */
export const PROJECT_VERSION = 8

/** Texto ya generado de las 3 ranuras de Blockly de un foco */
export interface FocusScripts {
  available: string
  bypass: string
  reward: string
}

// ---------------- Íconos ----------------
export type IconTarget = 'focus' | 'idea'
export type IconColor = 'acero' | 'oliva' | 'azul' | 'rojo' | 'dorado' | 'negro'

/** "Receta" de un ícono dibujado con emoji: permite volver a dibujarlo sin perder calidad */
export interface EmojiRecipe {
  emoji: string
  color: IconColor
}

/** Imagen guardada en la biblioteca del proyecto (PNG base64 ya al tamaño final) */
export interface IconAsset {
  id: string
  /** Nombre legible (se usa también para el nombre del .dds) */
  name: string
  target: IconTarget
  /** data:image/png;base64,... */
  png: string
  width: number
  height: number
  /** La imagen original era más chica que el tamaño final (se verá borrosa) */
  small?: boolean
  recipe?: EmojiRecipe
}

/** A qué apunta el ícono de un foco o espíritu */
export type IconRef = { kind: 'game'; gfx: string } | { kind: 'asset'; assetId: string }

export interface Focus {
  /** Identificador interno estable (no cambia aunque cambies el id) */
  uid: string
  /** Árbol de focos al que pertenece */
  treeId: string
  /** id que verá el juego, ej. GER_rearmar_ejercito */
  id: string
  name: string
  description: string
  /** Costo en semanas (1 unidad = 7 días) */
  cost: number
  icon: IconRef
  /** true = ícono elegido automáticamente por la app (se actualiza al renombrar) */
  iconAuto: boolean
  /** Posición en la cuadrícula */
  x: number
  y: number
  /** uids de los focos prerrequisito (línea normal) */
  prerequisites: string[]
  /** uids de los focos mutuamente excluyentes (línea roja) */
  mutuallyExclusive: string[]
  /** Estado guardado del espacio de trabajo de Blockly */
  blocks: unknown | null
  /** Script generado de cada ranura (cache para vista previa y exportación) */
  scripts: FocusScripts
}

/** Una fila "modificador + valor" de un espíritu nacional */
export interface IdeaModifier {
  key: string
  /** Tal como lo escribe el usuario (si el modificador es %, 10 = +10%) */
  value: number
}

/** Espíritu nacional (idea de tipo country) */
export interface Idea {
  uid: string
  id: string
  /** true = el id se sigue generando desde el nombre */
  idAuto: boolean
  name: string
  description: string
  modifiers: IdeaModifier[]
  icon: IconRef | null
  iconAuto: boolean
}

// ======================= Países =======================

export type Ideology = 'democratic' | 'fascism' | 'communism' | 'neutrality'
export const IDEOLOGIES: Ideology[] = ['democratic', 'fascism', 'communism', 'neutrality']
export const IDEOLOGY_LABELS: Record<Ideology, string> = {
  democratic: 'Democracia',
  fascism: 'Fascismo',
  communism: 'Comunismo',
  neutrality: 'No alineado'
}

/** Nombre, nombre con artículo (TAG_DEF) y adjetivo (TAG_ADJ) */
export interface CountryNames {
  name: string
  def: string
  adj: string
}

export interface Party {
  short: string
  long: string
}

export interface Leader {
  uid: string
  /** Parte del id del personaje: TAG_<id> */
  id: string
  name: string
  ideology: Ideology
  subideology: string
  /** PNG base64 156×210; null = retrato de relleno */
  portrait: string | null
  portraitSmall?: boolean
}

export interface CountryPolitics {
  ruling: Ideology
  /** Enteros que suman 100 */
  popularities: Record<Ideology, number>
  electionsAllowed: boolean
  electionFrequency: number
  /** "1932.1.1" */
  lastElection: string
  parties: Record<Ideology, Party>
}

export interface CountryFlags {
  /** PNG base64 82×52; null = bandera de relleno */
  main: string | null
  mainSmall?: boolean
  /** Banderas por ideología (las vacías usan la principal) */
  byIdeology: Partial<Record<Ideology, string>>
}

/** Datos de un país EXISTENTE que se leen del juego */
export interface ExistingCountryInfo {
  /** Cambiar el nombre en el juego (localización en replace/) */
  renameInGame: boolean
  /** Nombre EXACTO del archivo de historia del juego, ej. "MEX - Mexico.txt" */
  historyFile: string | null
  /** Contenido original del archivo de historia (para copiar lo que no toqué) */
  historyText: string | null
  /** El usuario cambió capital, política o líder */
  historyEdited: boolean
}

export interface Country {
  uid: string
  mode: 'nuevo' | 'existente'
  tag: string
  names: CountryNames
  /** Nombres por ideología (vacío = usa el normal) */
  ideologyNames: Record<Ideology, CountryNames>
  /** RGB 0–255 */
  color: [number, number, number]
  graphicalCulture: string
  graphicalCulture2d: string
  politics: CountryPolitics
  /** Id de estado (null = sin elegir) */
  capital: number | null
  flags: CountryFlags
  leaders: Leader[]
  focusTreeId: string | null
  existing: ExistingCountryInfo
  /** País TÉCNICO "Sin nación" (relleno de lo pendiente): lo mantiene la app */
  technical?: boolean
  /**
   * País del juego "ligero": solo tag + referencia, para que un árbol de focos tenga dueño.
   * No exporta historia, banderas, personajes ni localización. Al editarlo con el asistente
   * deja de ser ligero.
   */
  light?: boolean
}

export interface FocusTree {
  id: string
  name: string
}

// ======================= Mapa =======================

export type MapBaseKind = 'blank' | 'game' | 'mod'

/** Mod usado como base del mapa */
export interface MapModRef {
  /** Carpeta del mod */
  path: string
  /** Nombre de su descriptor.mod (va en dependencies = { … }) */
  name: string
  replacePaths: string[]
}

export interface MapSettings {
  /** Punto de partida del mapa; null = todavía no se eligió (se pregunta una vez) */
  base: MapBaseKind | null
  mod: MapModRef | null
  /** Lienzo en blanco: qué pasa al exportar con los estados que no pinté */
  unpainted: 'keep' | 'noNation'
  /** País técnico "Sin nación" (dueño de lo pendiente) */
  noNation: {
    tag: string
    name: string
    /** Conservar los cores del juego en los estados pendientes */
    keepGameCores: boolean
  }
  /** Al exportar, mover la capital de un país del juego al que le quité el estado de su capital */
  moveLostCapitals: boolean
  /** Capital elegida a mano para un país del juego (tag → estado); gana sobre la automática */
  capitalChoices: Record<string, number>
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  base: null,
  mod: null,
  unpainted: 'keep',
  noNation: { tag: '', name: 'Sin nación', keepGameCores: false },
  moveLostCapitals: true,
  capitalChoices: {}
}

/** Cambios a un estado del mapa (lo único que se guarda del mapa: nunca el mapa entero) */
export interface StateEdit {
  owner?: string
  addCores?: string[]
  removeCores?: string[]
}

/** Plantilla con la que se CREÓ el proyecto (queda fija; ver templates.ts) */
export type TemplateId = 'blank' | 'blankNoNation' | 'game' | 'mod' | 'content'

export interface Project {
  version: number
  /** Avisos que el usuario decidió ignorar (clave estable de cada aviso) */
  ignoredIssues?: string[]
  /** Plantilla de creación. Los proyectos viejos la toman de la base del mapa que tenían. */
  template?: TemplateId
  modName: string
  /** Tag con el que se creó el mod (compatibilidad); los países mandan */
  tag: string
  countries: Country[]
  focusTrees: FocusTree[]
  focuses: Focus[]
  ideas: Idea[]
  icons: IconAsset[]
  /** Cambios de estados por id de estado */
  stateEdits: Record<string, StateEdit>
  /** Base del mapa y modo de los estados no pintados */
  mapSettings: MapSettings
  /** Marcas creadas a mano con "+ Crear nueva…" (además de las usadas en set_country_flag) */
  countryFlags: string[]
}

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const EMPTY_SCRIPTS: FocusScripts = {
  available: '',
  bypass: '',
  reward: ''
}
