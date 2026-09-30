// Tipos de datos del proyecto (lo que se guarda en proyecto.json)

/** Versión actual del formato de proyecto.json (ver migrate.ts) */
export const PROJECT_VERSION = 2

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

export interface Project {
  version: number
  modName: string
  tag: string
  focuses: Focus[]
  ideas: Idea[]
  icons: IconAsset[]
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
