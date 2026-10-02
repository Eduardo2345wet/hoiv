// Registro de rutas del exportador: cada archivo tiene UN propietario. Dos generadores con la misma
// ruta, una ruta de la lista negra o una carpeta fuera de la lista blanca son errores de
// exportación (nunca se sobrescribe nada en silencio).
import type { Project } from '../types'
import { safeFolderName } from '../../../shared/names'
import type { ModFile } from './exportMod'

export interface PathIssue {
  path: string
  message: string
}

export {
  registerPatchPath,
  isRegisteredPatch,
  pathProblems,
  type RegistryContext
} from '../../../shared/exportPaths'
import { pathProblems, type RegistryContext } from '../../../shared/exportPaths'

/** Acumula los archivos de todos los generadores, cada uno con su propietario */
export class PathRegistry {
  private owners = new Map<string, string>()
  readonly files: ModFile[] = []
  readonly issues: PathIssue[] = []
  constructor(
    private readonly ctx: RegistryContext = {},
    private readonly prefix?: string
  ) {}

  add(owner: string, file: ModFile, opts: { requirePrefix?: boolean } = {}): void {
    const key = file.path.toLowerCase()
    const prev = this.owners.get(key)
    if (prev) {
      this.issues.push({
        path: file.path,
        message: `Dos generadores escriben ${file.path} (${prev} y ${owner}). Cambia un nombre para que no se pisen.`
      })
      return
    }
    for (const m of pathProblems(file.path, this.ctx, opts.requirePrefix ? this.prefix : undefined))
      this.issues.push({ path: file.path, message: m })
    this.owners.set(key, owner)
    this.files.push(file)
  }
}

/** Prefijo del mod que llevan los archivos nuevos de las secciones */
export const modPrefix = (p: Project): string => safeFolderName(p.modName)
