// Pide al proceso principal los parches mínimos de archivos del juego (tecnologías e ideologías).
// Nunca se escribe un archivo de interfaz: solo common/technologies y common/ideologies, partiendo
// siempre de los bytes originales del usuario.
import type { Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import { registerPatchPath } from './registry'
import { textPatchRequests } from '../sections/technologies'
import type { ModFile } from './exportMod'

export async function planTextPatchExport(
  project: Project,
  gamePath: string | null,
  mod: Project['mapSettings']['mod'],
  game: GameCatalog | null
): Promise<{ files: ModFile[]; errors: { file: string; message: string }[] }> {
  const reqs = textPatchRequests(project, game)
  if (!reqs.length) return { files: [], errors: [] }
  if (!gamePath || !window.electronAPI)
    return {
      files: [],
      errors: [
        {
          file: 'tecnologías/ideologías',
          message: 'Hace falta la carpeta del juego para parchar sus archivos.'
        }
      ]
    }
  const res = await window.electronAPI.planTextPatches(gamePath, reqs, mod)
  for (const f of res.files) registerPatchPath(f.path)
  return { files: res.files.map((f) => ({ path: f.path, data: f.data })), errors: res.errors }
}
