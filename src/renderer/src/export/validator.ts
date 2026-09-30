// Validador: revisa el proyecto antes de exportar y avisa en español.
//   - 'error'  → impide exportar
//   - 'warning' → se puede exportar igualmente

import { validateTag } from '../../../shared/tag'
import type { Project } from '../model/project'

export interface Issue {
  level: 'error' | 'warning'
  message: string
  focusUid?: string
}

const ID_REGEX = /^[A-Za-z0-9_]+$/

/**
 * Comprueba si las llaves { } están balanceadas.
 * Ignora las llaves dentro de "comillas" y en comentarios (#).
 */
export function bracesBalanced(text: string): boolean {
  let depth = 0
  let inString = false
  let inComment = false
  for (const ch of text) {
    if (inComment) {
      if (ch === '\n') inComment = false
      continue
    }
    if (inString) {
      if (ch === '"' || ch === '\n') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '#') inComment = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

export function validateProject(
  project: Project,
  focusBlocks: Map<string, string>,
  fullScript: string
): Issue[] {
  const issues: Issue[] = []
  const error = (message: string, focusUid?: string): void => {
    issues.push({ level: 'error', message, focusUid })
  }
  const warning = (message: string, focusUid?: string): void => {
    issues.push({ level: 'warning', message, focusUid })
  }

  if (!project.modName.trim()) error('El mod no tiene nombre.')
  const tagError = validateTag(project.tag)
  if (tagError) error(tagError)
  if (project.foci.length === 0) error('El árbol no tiene ningún foco. Añade al menos uno.')

  const byUid = new Map(project.foci.map((f) => [f.uid, f]))
  const label = (uid: string): string => {
    const f = byUid.get(uid)
    return f ? `"${f.name || f.id}"` : '(desconocido)'
  }

  // Ids duplicados
  const seen = new Map<string, string>()
  for (const f of project.foci) {
    const prev = seen.get(f.id)
    if (prev) error(`El id "${f.id}" está repetido (focos ${label(prev)} y ${label(f.uid)}).`, f.uid)
    else seen.set(f.id, f.uid)
  }

  // Posiciones repetidas
  const cells = new Map<string, string>()

  for (const f of project.foci) {
    if (!f.id.trim()) error(`El foco ${label(f.uid)} no tiene id.`, f.uid)
    else if (!ID_REGEX.test(f.id)) {
      error(`El id "${f.id}" solo puede tener letras sin tilde, números y guion bajo (_).`, f.uid)
    }
    if (!f.name.trim()) error(`El foco "${f.id}" no tiene nombre.`, f.uid)
    if (!(f.cost > 0)) warning(`El foco ${label(f.uid)} tiene costo ${f.cost}; lo normal es 1 o más.`, f.uid)

    for (const p of f.prerequisites) {
      if (!byUid.has(p)) {
        error(`El foco ${label(f.uid)} tiene un prerrequisito que apunta a un foco borrado.`, f.uid)
      } else if (f.mutuallyExclusive.includes(p)) {
        warning(`${label(f.uid)} y ${label(p)} son a la vez prerrequisito y excluyentes: nunca se podrá elegir.`, f.uid)
      }
    }
    for (const m of f.mutuallyExclusive) {
      if (!byUid.has(m)) {
        error(`El foco ${label(f.uid)} es excluyente con un foco borrado.`, f.uid)
      }
    }

    const cell = `${f.x},${f.y}`
    const other = cells.get(cell)
    if (other) warning(`${label(other)} y ${label(f.uid)} están en la misma casilla (x=${f.x}, y=${f.y}).`, f.uid)
    else cells.set(cell, f.uid)

    const script = focusBlocks.get(f.uid)
    if (script !== undefined && !bracesBalanced(script)) {
      error(`El script del foco ${label(f.uid)} tiene llaves { } desbalanceadas.`, f.uid)
    }
  }

  // Ciclos de prerrequisitos (A necesita B y B necesita A)
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (uid: string): boolean => {
    if (state.get(uid) === 'visiting') return true
    if (state.get(uid) === 'done') return false
    state.set(uid, 'visiting')
    const cycle = (byUid.get(uid)?.prerequisites ?? []).some((p) => byUid.has(p) && visit(p))
    state.set(uid, 'done')
    return cycle
  }
  for (const f of project.foci) {
    if (!state.has(f.uid) && visit(f.uid)) {
      error(`Hay un ciclo de prerrequisitos que incluye a ${label(f.uid)}: ningún foco del ciclo se podrá hacer.`, f.uid)
    }
  }

  if (!bracesBalanced(fullScript)) error('El archivo de focos tiene llaves { } desbalanceadas.')

  return issues
}
