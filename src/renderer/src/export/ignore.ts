// Avisos ignorados: se guardan en el proyecto (por clave estable). Los errores no se ignoran.
import type { Project } from '../types'
import type { Issue } from './validator'

export const issueKey = (i: Issue): string => i.key ?? `${i.severity}|${i.message}`

export const isIgnored = (p: Project, i: Issue): boolean =>
  i.severity === 'aviso' && !!p.ignoredIssues?.includes(issueKey(i))

export function ignoreIssue(p: Project, i: Issue): Project {
  if (i.severity !== 'aviso' || isIgnored(p, i)) return p
  return { ...p, ignoredIssues: [...(p.ignoredIssues ?? []), issueKey(i)] }
}

export function unignoreIssue(p: Project, i: Issue): Project {
  return { ...p, ignoredIssues: (p.ignoredIssues ?? []).filter((k) => k !== issueKey(i)) }
}

export function splitIgnored(p: Project, issues: Issue[]): { shown: Issue[]; hidden: Issue[] } {
  const shown: Issue[] = []
  const hidden: Issue[] = []
  for (const i of issues) (isIgnored(p, i) ? hidden : shown).push(i)
  return { shown, hidden }
}

/** Tipo de aviso para agrupar: el explícito o uno deducido de a qué apunta */
export function kindOf(i: Issue): string {
  if (i.kind) return i.kind
  if (i.focusUid) return 'Focos'
  if (i.countryUid) return 'Países'
  if (i.stateId || i.goPending) return 'Mapa'
  return 'General'
}
