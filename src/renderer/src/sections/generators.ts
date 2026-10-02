// Cada sección aporta un generador puro (Project → ModFile[]) al exportador. Los generadores se
// registran aquí (uno por sección); ninguno escribe fuera del registro de rutas.
import type { Project } from '../types'
import type { ModFile } from '../export/exportMod'
import { modPrefix, PathRegistry, type PathIssue, type RegistryContext } from '../export/registry'

export interface SectionGenerator {
  /** Nombre de la sección (propietario de sus rutas en el registro) */
  id: string
  generate(project: Project): ModFile[]
}

const generators: SectionGenerator[] = []

/** Registra el generador de una sección (idempotente por id) */
export function registerSectionGenerator(g: SectionGenerator): void {
  const i = generators.findIndex((x) => x.id === g.id)
  if (i >= 0) generators[i] = g
  else generators.push(g)
}
export const sectionGeneratorIds = (): string[] => generators.map((g) => g.id)

/** Archivos de todas las secciones + los problemas del registro (duplicados, lista negra…) */
export function sectionFiles(
  project: Project,
  ctx: RegistryContext = {}
): { files: ModFile[]; issues: PathIssue[] } {
  const reg = new PathRegistry(ctx, modPrefix(project))
  for (const g of generators)
    for (const f of g.generate(project)) reg.add(g.id, f, { requirePrefix: true })
  return { files: reg.files, issues: reg.issues }
}
