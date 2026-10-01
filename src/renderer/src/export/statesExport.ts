// Estados del mapa para la exportación: solo los modificados (distintos del original)
// y solo con el mapa REAL. El parche lo hace el proceso principal con los bytes del juego.
import type { Project } from '../types'
import type { MapData } from '../../../shared/map/types'
import { DATED_KEYS_TO_STRIP, exportCores, exportOwner, noNationActive } from '../map/noNation'
import type { ModFile } from './exportMod'

export interface StatePatchRequest {
  file: string
  targets: { id: number; owner: string; cores: string[]; stripDated?: string[] }[]
}

/**
 * Agrupa por archivo los estados con cambios reales. En el modo Sin nación, además, TODOS los
 * estados no pintados pasan al país técnico (sin cores del juego y sin cambios con fecha).
 */
export function stateRequests(project: Project, map: MapData): StatePatchRequest[] {
  const byFile = new Map<string, StatePatchRequest>()
  const noNation = noNationActive(project)
  for (const s of map.states) {
    const painted = !!project.stateEdits[s.id]?.owner
    if (!project.stateEdits[s.id] && !noNation) continue
    const owner = exportOwner(s, project)
    const cores = exportCores(s, project)
    const pending = noNation && !painted
    if (!pending && owner === s.owner && cores.join(',') === [...s.cores].sort().join(',')) continue
    const req = byFile.get(s.file) ?? { file: s.file, targets: [] }
    req.targets.push(
      pending
        ? { id: s.id, owner, cores, stripDated: DATED_KEYS_TO_STRIP }
        : { id: s.id, owner, cores }
    )
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
  gamePath: string | null,
  /** Progreso (el modo Sin nación toca casi todos los archivos de estado) */
  onProgress?: (p: { done: number; total: number }) => void
): Promise<StateExportPlan> {
  if (!map || map.source !== 'real' || !gamePath || !window.electronAPI)
    return { files: [], errors: [] }
  const requests = stateRequests(project, map)
  if (!requests.length) return { files: [], errors: [] }
  // Con base de mod se parcha A PARTIR de los archivos del mod
  const mod = baseMod(project)
  const off = onProgress ? window.electronAPI.onStatesProgress(onProgress) : null
  const res = await window.electronAPI
    .planStatePatches(gamePath, requests, mod)
    .finally(() => off?.())
  return { files: res.files.map((f) => ({ path: f.path, data: f.data })), errors: res.errors }
}
