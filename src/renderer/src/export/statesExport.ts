// Estados del mapa para la exportación: solo los modificados (distintos del original)
// y solo con el mapa REAL. El parche lo hace el proceso principal con los bytes del juego.
import type { Project } from '../types'
import type { MapData } from '../../../shared/map/types'
import { DATED_KEYS_TO_STRIP, exportCores, exportOwner, noNationActive } from '../map/noNation'
import type { ModFile } from './exportMod'
import type { GameCatalog } from '../catalog/catalog'
import { propsOf } from '../map/stateProps'
import type { StateProps } from '../../../shared/map/statePatch'
import { planTextPatchExport } from './textPatchExport'
import { planCapitalMoves, type CapitalMove } from '../map/capitals'

export interface StatePatchRequest {
  file: string
  targets: {
    id: number
    owner: string
    cores: string[]
    stripDated?: string[]
    props?: StateProps
  }[]
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
    const props = propsOf(project.stateEdits[s.id])
    if (!project.stateEdits[s.id] && !noNation) continue
    const owner = exportOwner(s, project)
    const cores = exportCores(s, project)
    const pending = noNation && !painted
    if (
      !pending &&
      !props &&
      owner === s.owner &&
      cores.join(',') === [...s.cores].sort().join(',')
    )
      continue
    const req = byFile.get(s.file) ?? { file: s.file, targets: [] }
    req.targets.push(
      pending
        ? { id: s.id, owner, cores, stripDated: DATED_KEYS_TO_STRIP, ...(props ? { props } : {}) }
        : { id: s.id, owner, cores, ...(props ? { props } : {}) }
    )
    byFile.set(s.file, req)
  }
  return [...byFile.values()]
}

export interface StateExportPlan {
  files: ModFile[]
  /** Errores por estado (parche imposible o verificación fallida) */
  errors: { file: string; id?: number; message: string }[]
  /** Capitales de países del juego que se mueven (para el informe al exportar) */
  moves?: CapitalMove[]
  /** Errores del parche de capitales: ese archivo no se exporta */
  capitalErrors?: { file: string; message: string }[]
  /** Errores de los parches de tecnologías e ideologías (ese archivo no se exporta) */
  textErrors?: { file: string; message: string }[]
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
  onProgress?: (p: { done: number; total: number }) => void,
  game: GameCatalog | null = null
): Promise<StateExportPlan> {
  if (!map || map.source !== 'real' || !gamePath || !window.electronAPI)
    return { files: [], errors: [] }
  // Con base de mod se parcha A PARTIR de los archivos del mod
  const mod = baseMod(project)
  const files: ModFile[] = []
  let errors: StateExportPlan['errors'] = []
  const requests = stateRequests(project, map)
  if (requests.length) {
    const off = onProgress ? window.electronAPI.onStatesProgress(onProgress) : null
    const res = await window.electronAPI
      .planStatePatches(gamePath, requests, mod)
      .finally(() => off?.())
    files.push(...res.files.map((f) => ({ path: f.path, data: f.data })))
    errors = res.errors
  }

  // Capitales perdidas de países del juego: parche mínimo de su history/countries original.
  // (Los que editó el asistente llevan su capital en su propio archivo: ver withMovedCapitals.)
  const moves = planCapitalMoves(project, map, game)
  const capitalErrors: { file: string; message: string }[] = []
  const reqs: { file: string; capital: number }[] = []
  for (const m of moves) {
    if (m.to === null) continue
    const c = project.countries.find((x) => x.tag === m.tag)
    if (c?.existing.historyEdited) continue
    const file = game?.historyFiles?.[m.tag]
    if (!file)
      capitalErrors.push({
        file: `${m.tag}`,
        message: 'No se encontró su archivo en history/countries de la carpeta del juego.'
      })
    else reqs.push({ file, capital: m.to })
  }
  if (reqs.length) {
    const res = await window.electronAPI.planCapitalPatches(gamePath, reqs, mod)
    files.push(...res.files.map((f) => ({ path: f.path, data: f.data })))
    capitalErrors.push(...res.errors)
  }
  // Tecnologías e ideologías: parches mínimos de archivos del juego (si el proyecto los pide)
  const text = await planTextPatchExport(project, gamePath, mod, game)
  files.push(...text.files)
  return { files, errors, moves, capitalErrors, textErrors: text.errors }
}
