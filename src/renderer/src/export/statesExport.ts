// Estados del mapa para la exportación: solo los modificados (distintos del original)
// y solo con el mapa REAL. El parche lo hace el proceso principal con los bytes del juego.
import type { Project } from '../types'
import type { MapData } from '../../../shared/map/types'
import { effectiveCores, effectiveOwner } from '../map/mapOps'
import type { ModFile } from './exportMod'

export interface StatePatchRequest {
  file: string
  targets: { id: number; owner: string; cores: string[] }[]
}

/** Agrupa por archivo los estados con cambios reales */
export function stateRequests(project: Project, map: MapData): StatePatchRequest[] {
  const byFile = new Map<string, StatePatchRequest>()
  for (const s of map.states) {
    if (!project.stateEdits[s.id]) continue
    const owner = effectiveOwner(s, project)
    const cores = effectiveCores(s, project)
    if (owner === s.owner && cores.join(',') === [...s.cores].sort().join(',')) continue
    const req = byFile.get(s.file) ?? { file: s.file, targets: [] }
    req.targets.push({ id: s.id, owner, cores })
    byFile.set(s.file, req)
  }
  return [...byFile.values()]
}

export interface StateExportPlan {
  files: ModFile[]
  /** Errores por estado (parche imposible o verificación fallida) */
  errors: { file: string; id?: number; message: string }[]
}

/** Mod usado como base del mapa (o null) */
export function baseMod(project: Project): Project['mapSettings']['mod'] {
  return project.mapSettings?.base === 'mod' ? project.mapSettings.mod : null
}

/** Pide al proceso principal los archivos parchados (sin escribirlos todavía) */
export async function planStateExport(
  project: Project,
  map: MapData | null,
  gamePath: string | null
): Promise<StateExportPlan> {
  if (!map || map.source !== 'real' || !gamePath || !window.electronAPI)
    return { files: [], errors: [] }
  const requests = stateRequests(project, map)
  if (!requests.length) return { files: [], errors: [] }
  // Con base de mod se parcha A PARTIR de los archivos del mod
  const mod = baseMod(project)
  const res = await window.electronAPI.planStatePatches(gamePath, requests, mod)
  return { files: res.files.map((f) => ({ path: f.path, data: f.data })), errors: res.errors }
}
