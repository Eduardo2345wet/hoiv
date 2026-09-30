// Validación de los cambios del mapa (estados)
import type { Issue, MapContext } from '../export/validator'
import type { Project } from '../types'

export function validateMap(project: Project, ctx: MapContext): Issue[] {
  const issues: Issue[] = []
  void project
  // Parche imposible de aplicar con seguridad (el archivo NO se exporta)
  for (const e of ctx.patchErrors ?? [])
    issues.push({
      severity: 'error',
      message: `No se puede exportar history/states/${e.file}: ${e.message}`,
      stateId: e.id
    })
  return issues
}
