// Modelo de datos del proyecto (lo que se guarda en proyecto.json).

import { validateTag } from '../../../shared/tag'
import { DEFAULT_ICON } from './icons'

/** Estado serializado de Blockly (lo genera Blockly.serialization.workspaces.save). */
export type BlocklyState = { [key: string]: unknown }

export interface Focus {
  /** Identificador interno y estable. Las conexiones usan este valor, así renombrar el id no rompe nada. */
  uid: string
  /** Id que verá el juego (ej: GER_industria). */
  id: string
  name: string
  description: string
  /** Costo en unidades del juego: 1 unidad = 7 días. */
  cost: number
  icon: string
  /** Posición en la cuadrícula del árbol. */
  x: number
  y: number
  /** uids de los focos que hay que completar antes. */
  prerequisites: string[]
  /** 'all' = hay que completar todos; 'any' = basta con uno. */
  prerequisiteMode: 'all' | 'any'
  /** uids de los focos mutuamente excluyentes con este. */
  mutuallyExclusive: string[]
  /** Bloques de Blockly (requisitos, saltar si, recompensa). */
  blocks: BlocklyState | null
}

export interface Project {
  format: 'hoi4-mod-studio'
  version: 1
  modName: string
  tag: string
  foci: Focus[]
}

export const PROJECT_FORMAT = 'hoi4-mod-studio'

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function createProject(modName: string, tag: string): Project {
  return { format: PROJECT_FORMAT, version: 1, modName: modName.trim(), tag, foci: [] }
}

/** Busca un id libre del estilo TAG_foco_1, TAG_foco_2... */
export function nextFocusId(project: Project): string {
  const used = new Set(project.foci.map((f) => f.id))
  let n = project.foci.length + 1
  while (used.has(`${project.tag}_foco_${n}`)) n++
  return `${project.tag}_foco_${n}`
}

/** Busca la primera casilla libre empezando por (x, y), hacia la derecha. */
export function freeCell(project: Project, x: number, y: number): { x: number; y: number } {
  const taken = new Set(project.foci.map((f) => `${f.x},${f.y}`))
  let cx = Math.max(0, x)
  while (taken.has(`${cx},${y}`)) cx++
  return { x: cx, y: Math.max(0, y) }
}

export function addFocus(project: Project, x: number, y: number): { project: Project; focus: Focus } {
  const cell = freeCell(project, x, y)
  const focus: Focus = {
    uid: newUid(),
    id: nextFocusId(project),
    name: 'Nuevo foco',
    description: '',
    cost: 10,
    icon: DEFAULT_ICON,
    x: cell.x,
    y: cell.y,
    prerequisites: [],
    prerequisiteMode: 'all',
    mutuallyExclusive: [],
    blocks: null
  }
  return { project: { ...project, foci: [...project.foci, focus] }, focus }
}

export function updateFocus(project: Project, uid: string, changes: Partial<Focus>): Project {
  return { ...project, foci: project.foci.map((f) => (f.uid === uid ? { ...f, ...changes } : f)) }
}

/** Borra un foco y limpia las conexiones que apuntaban a él. */
export function removeFocus(project: Project, uid: string): Project {
  return {
    ...project,
    foci: project.foci
      .filter((f) => f.uid !== uid)
      .map((f) => ({
        ...f,
        prerequisites: f.prerequisites.filter((p) => p !== uid),
        mutuallyExclusive: f.mutuallyExclusive.filter((m) => m !== uid)
      }))
  }
}

/** Añade o quita el prerrequisito "parent -> child". */
export function togglePrerequisite(project: Project, parentUid: string, childUid: string): Project {
  if (parentUid === childUid) return project
  return {
    ...project,
    foci: project.foci.map((f) => {
      if (f.uid !== childUid) return f
      const has = f.prerequisites.includes(parentUid)
      return {
        ...f,
        prerequisites: has
          ? f.prerequisites.filter((p) => p !== parentUid)
          : [...f.prerequisites, parentUid]
      }
    })
  }
}

/** Añade o quita la exclusión mutua entre dos focos (se guarda en ambos). */
export function toggleMutuallyExclusive(project: Project, aUid: string, bUid: string): Project {
  if (aUid === bUid) return project
  const a = project.foci.find((f) => f.uid === aUid)
  const has = !!a?.mutuallyExclusive.includes(bUid)
  return {
    ...project,
    foci: project.foci.map((f) => {
      if (f.uid !== aUid && f.uid !== bUid) return f
      const other = f.uid === aUid ? bUid : aUid
      const list = f.mutuallyExclusive.filter((m) => m !== other)
      return { ...f, mutuallyExclusive: has ? list : [...list, other] }
    })
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

/** Lee un proyecto.json. Lanza un Error con mensaje en español si no es válido. */
export function parseProject(text: string): Project {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('El archivo no es un proyecto de HOI4 Mod Studio.')
  }
  const raw = data as Partial<Project>
  if (raw.format !== PROJECT_FORMAT || !Array.isArray(raw.foci)) {
    throw new Error('El archivo no es un proyecto de HOI4 Mod Studio.')
  }
  if (typeof raw.modName !== 'string' || typeof raw.tag !== 'string') {
    throw new Error('Al proyecto le falta el nombre del mod o el tag.')
  }
  const tagError = validateTag(raw.tag)
  if (tagError) throw new Error(tagError)

  const foci: Focus[] = raw.foci.map((f: Partial<Focus>, i) => ({
    uid: typeof f.uid === 'string' && f.uid ? f.uid : newUid(),
    id: typeof f.id === 'string' ? f.id : `${raw.tag}_foco_${i + 1}`,
    name: typeof f.name === 'string' ? f.name : '',
    description: typeof f.description === 'string' ? f.description : '',
    cost: typeof f.cost === 'number' ? f.cost : 10,
    icon: typeof f.icon === 'string' && f.icon ? f.icon : DEFAULT_ICON,
    x: typeof f.x === 'number' ? f.x : 0,
    y: typeof f.y === 'number' ? f.y : 0,
    prerequisites: Array.isArray(f.prerequisites) ? f.prerequisites : [],
    prerequisiteMode: f.prerequisiteMode === 'any' ? 'any' : 'all',
    mutuallyExclusive: Array.isArray(f.mutuallyExclusive) ? f.mutuallyExclusive : [],
    blocks: f.blocks && typeof f.blocks === 'object' ? f.blocks : null
  }))
  return { format: PROJECT_FORMAT, version: 1, modName: raw.modName, tag: raw.tag, foci }
}
