// Tipos de datos del proyecto (lo que se guarda en proyecto.json)

/** Texto ya generado de las 3 ranuras de Blockly de un foco */
export interface FocusScripts {
  available: string
  bypass: string
  reward: string
}

export interface Focus {
  /** Identificador interno estable (no cambia aunque cambies el id) */
  uid: string
  /** id que verá el juego, ej. GER_rearmar_ejercito */
  id: string
  name: string
  description: string
  /** Costo en semanas (1 unidad = 7 días) */
  cost: number
  icon: string
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

export interface Project {
  version: 1
  modName: string
  tag: string
  focuses: Focus[]
}

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const EMPTY_SCRIPTS: FocusScripts = { available: '', bypass: '', reward: '' }
