// Prepara todos los archivos del mod y pide al proceso principal (Node) que
// los escriba. La interfaz nunca toca el disco directamente.
import type { Project } from '../types'
import { generateAllFocusTrees, generateLocalisation } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { safeFolderName } from '../../../shared/names'
import { planIconExport } from './gfx'
import { writeDDS } from './images'
import { pngToRGBA, pngToRGBAResized } from './imageCanvas'
import {
  countryImageFiles,
  countryImagePaths,
  countryTextFiles,
  type ImageReader
} from './countryExport'
import type { GameCatalog } from '../catalog/catalog'
import { store } from '../store/appStore'
import { patchStateHistory } from '../../../shared/statePatcher'

export interface ModFile {
  /** Ruta dentro de la carpeta del mod, con "/" */
  path: string
  text?: string
  /** Escribir con BOM UTF-8 (solo localización) */
  bom?: boolean
  data?: Uint8Array
}

/** Archivos extra (ideas, íconos .dds y .gfx). Recibe el decodificador para poder probarlo. */
export async function buildExtraFiles(
  project: Project,
  decode: (png: string) => Promise<{
    width: number
    height: number
    rgba: Uint8Array | Uint8ClampedArray
  }>,
  /** Lector de imágenes a un tamaño dado (banderas y retratos de los países) */
  read?: ImageReader,
  game: GameCatalog | null = null
): Promise<ModFile[]> {
  const mod = safeFolderName(project.modName)
  const files: ModFile[] = []
  // Un archivo por árbol de focos, con el tag de su país
  for (const t of generateAllFocusTrees(project))
    if (project.focuses.some((f) => f.treeId === t.treeId))
      files.push({ path: `common/national_focus/${t.tag}_focus.txt`, text: t.text })
  if (project.ideas.length)
    files.push({
      path: `common/ideas/${mod}_ideas.txt`,
      text: generateIdeas(project)
    })
  const plan = planIconExport(project)
  for (const d of plan.dds) {
    const asset = project.icons.find((a) => a.id === d.assetId)!
    const img = await decode(asset.png)
    files.push({
      path: d.path,
      data: writeDDS(img.width, img.height, img.rgba)
    })
  }
  if (plan.gfx) files.push({ path: plan.gfxPath, text: plan.gfx })
  // Países: textos (tags, countries, historia, OOB, personajes, localización) e imágenes
  files.push(...countryTextFiles(project, game))
  if (read) files.push(...(await countryImageFiles(project, read)))

  // Estados del mapa modificados (solo en el mapa real)
  const gamePath = store.get().gamePath
  if (project.stateEdits && Object.keys(project.stateEdits).length > 0 && gamePath && window.electronAPI) {
    for (const [stateIdStr, edit] of Object.entries(project.stateEdits)) {
      const stateId = parseInt(stateIdStr, 10)
      const state = game?.states?.find((s) => s.id === stateId)
      const fileName = state?.fileName || `${stateId}.txt`
      const originalText = await window.electronAPI.readStateFile(gamePath, fileName)
        if (originalText) {
          const patched = patchStateHistory(originalText, edit)
          if (patched.success && patched.patchedText) {
            files.push({
              path: `history/states/${fileName}`,
              text: patched.patchedText
            })
          }
        }
      }
    }
  }

  return files
}

/**
 * Rutas de TODOS los archivos que va a escribir el mod (sin leer imágenes),
 * para detectar dos archivos con el mismo nombre antes de exportar.
 */
export function plannedPaths(project: Project, game: GameCatalog | null = null): string[] {
  const mod = safeFolderName(project.modName)
  const paths = ['descriptor.mod', `localisation/english/${mod}_l_english.yml`]
  for (const t of generateAllFocusTrees(project))
    if (project.focuses.some((f) => f.treeId === t.treeId))
      paths.push(`common/national_focus/${t.tag}_focus.txt`)
  if (project.ideas.length) paths.push(`common/ideas/${mod}_ideas.txt`)
  const plan = planIconExport(project)
  paths.push(...plan.dds.map((d) => d.path))
  if (plan.gfx) paths.push(plan.gfxPath)
  paths.push(...countryTextFiles(project, game).map((f) => f.path))
  paths.push(...countryImagePaths(project))
  return paths
}

export async function exportMod(project: Project): Promise<{ ok: boolean; message: string }> {
  const api = window.electronAPI
  if (!api)
    return {
      ok: false,
      message: 'Esta función solo está disponible dentro de la app de escritorio.'
    }

  const folder = await api.selectFolder()
  if (!folder) return { ok: false, message: 'Exportación cancelada.' }

  const result = await api.exportMod({
    exportPath: folder,
    modName: project.modName,
    tag: project.tag,
    // Los árboles van en `files` (uno por país)
    focusTreeScript: '',
    locYaml: generateLocalisation(project),
    files: await buildExtraFiles(project, pngToRGBA, pngToRGBAResized, store.get().game)
  })
  if (!result.success) return { ok: false, message: result.error ?? 'Error desconocido' }
  return { ok: true, message: `Mod exportado en:\n${result.modFolder}` }
}
