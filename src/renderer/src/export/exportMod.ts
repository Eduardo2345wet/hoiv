// Prepara los textos del mod y pide al proceso principal (Node) que
// escriba los archivos. La interfaz nunca toca el disco directamente.
import type { Project } from '../types'
import { generateFocusTree, generateLocalisation } from '../generator/focusTree'

export async function exportMod(project: Project): Promise<{ ok: boolean; message: string }> {
  const api = window.electronAPI
  if (!api) return { ok: false, message: 'Esta función solo está disponible dentro de la app de escritorio.' }

  const folder = await api.selectFolder()
  if (!folder) return { ok: false, message: 'Exportación cancelada.' }

  const result = await api.exportMod({
    exportPath: folder,
    modName: project.modName,
    tag: project.tag,
    focusTreeScript: generateFocusTree(project),
    locYaml: generateLocalisation(project)
  })
  if (!result.success) return { ok: false, message: result.error ?? 'Error desconocido' }
  return { ok: true, message: `Mod exportado en:\n${result.modFolder}` }
}
