// Revisa el proyecto antes de exportar y devuelve avisos en español.
import type { Project } from '../types'
import { generateFocusTree } from '../generator/focusTree'

export type Severity = 'error' | 'aviso'
export interface Issue {
  severity: Severity
  message: string
  /** uid del foco afectado (para seleccionarlo al hacer clic) */
  focusUid?: string
}

export const TAG_REGEX = /^[A-Z][A-Z0-9]{2}$/
export const FORBIDDEN_TAGS = ['NOT', 'AND', 'TAG', 'OOB', 'LOG', 'NUM', 'RED']
export const ID_REGEX = /^[A-Za-z0-9_]+$/

/** Devuelve un mensaje de error si el tag no es válido, o null si está bien */
export function validateTag(tag: string): string | null {
  if (!TAG_REGEX.test(tag))
    return 'El tag debe tener 3 caracteres: una letra mayúscula seguida de 2 letras mayúsculas o números (ej. GER, MX1).'
  if (FORBIDDEN_TAGS.includes(tag)) return `"${tag}" es una palabra reservada del juego, elige otro tag.`
  return null
}

/** Cuenta llaves { } ignorando las que estén dentro de comillas */
export function checkBraces(text: string): string | null {
  let depth = 0
  let inQuotes = false
  let line = 1
  for (const ch of text) {
    if (ch === '\n') line++
    if (ch === '"') inQuotes = !inQuotes
    if (inQuotes) continue
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth < 0) return `Hay una llave "}" de más cerca de la línea ${line}.`
    }
  }
  if (depth > 0) return `Faltan ${depth} llave(s) "}" por cerrar.`
  return null
}

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = []
  const tagError = validateTag(project.tag)
  if (tagError) issues.push({ severity: 'error', message: tagError })
  if (!project.modName.trim()) issues.push({ severity: 'error', message: 'El mod no tiene nombre.' })
  if (project.focuses.length === 0)
    issues.push({ severity: 'error', message: 'El árbol no tiene ningún foco.' })

  const uids = new Set(project.focuses.map((f) => f.uid))
  const ids = new Set(project.focuses.map((f) => f.id))
  const seen = new Map<string, number>()
  const positions = new Map<string, string>()

  for (const f of project.focuses) {
    const label = f.name.trim() || f.id || '(sin id)'
    seen.set(f.id, (seen.get(f.id) ?? 0) + 1)

    if (!f.id.trim()) issues.push({ severity: 'error', message: 'Hay un foco sin id.', focusUid: f.uid })
    else if (!ID_REGEX.test(f.id))
      issues.push({
        severity: 'error',
        message: `El id "${f.id}" solo puede tener letras sin tildes, números y guion bajo (_).`,
        focusUid: f.uid
      })
    if (!f.name.trim())
      issues.push({ severity: 'error', message: `El foco "${f.id}" no tiene nombre.`, focusUid: f.uid })
    if (!(f.cost > 0))
      issues.push({ severity: 'error', message: `El foco "${label}" debe costar al menos 1 semana.`, focusUid: f.uid })

    for (const p of f.prerequisites)
      if (!uids.has(p))
        issues.push({
          severity: 'error',
          message: `El foco "${label}" tiene un prerrequisito que apunta a un foco borrado.`,
          focusUid: f.uid
        })
    for (const m of f.mutuallyExclusive)
      if (!uids.has(m))
        issues.push({
          severity: 'error',
          message: `El foco "${label}" es excluyente con un foco borrado.`,
          focusUid: f.uid
        })

    // Condiciones "completó el foco X" que apuntan a un id que no existe
    const script = f.scripts.available + f.scripts.bypass + f.scripts.reward
    for (const m of script.matchAll(/has_completed_focus = (\S+)/g))
      if (!ids.has(m[1]))
        issues.push({
          severity: 'aviso',
          message: `El foco "${label}" usa "completó el foco ${m[1]}", pero ese foco no existe.`,
          focusUid: f.uid
        })

    const pos = `${f.x},${f.y}`
    if (positions.has(pos))
      issues.push({
        severity: 'aviso',
        message: `Los focos "${positions.get(pos)}" y "${label}" están en la misma casilla.`,
        focusUid: f.uid
      })
    else positions.set(pos, label)

    if (!f.scripts.reward.trim())
      issues.push({ severity: 'aviso', message: `El foco "${label}" no tiene recompensa.`, focusUid: f.uid })
  }

  for (const [id, count] of seen)
    if (count > 1 && id) issues.push({ severity: 'error', message: `El id "${id}" está repetido ${count} veces.` })

  const braces = checkBraces(generateFocusTree(project))
  if (braces) issues.push({ severity: 'error', message: `Llaves desbalanceadas: ${braces}` })

  return issues
}
