// Prepara todos los archivos del mod y pide al proceso principal (Node) que
// los escriba. La interfaz nunca toca el disco directamente.
import type { Project } from '../types'
import { generateAllFocusTrees, generateLocalisation } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { safeFolderName } from '../../../shared/names'
import { planIconExport } from './gfx'
import { writeDDS } from './images'
import { pngToRGBA } from './imageCanvas'

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
  }>
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
  return files
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
    files: await buildExtraFiles(project, pngToRGBA)
  })
  if (!result.success) return { ok: false, message: result.error ?? 'Error desconocido' }
  return { ok: true, message: `Mod exportado en:\n${result.modFolder}` }
}
