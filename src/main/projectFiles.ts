// Crear la carpeta de un proyecto nuevo y leer proyectos por ruta. Nunca escribe en la carpeta
// del juego.
import fs from 'fs'
import path from 'path'
import { isGameInstallFolder } from './export'

/** Nombre de carpeta seguro: sin caracteres que Windows no permite */
export function safeFolderName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim() || 'proyecto'
  )
}

export type CreateResult = { ok: true; path: string; folder: string } | { ok: false; error: string }

/** Crea <parent>/<nombre>/ y escribe proyecto.json dentro. */
export function createProjectFolder(parent: string, name: string, json: string): CreateResult {
  if (!name.trim()) return { ok: false, error: 'Escribe un nombre para el proyecto.' }
  if (!parent.trim()) return { ok: false, error: 'Elige una carpeta.' }
  if (isGameInstallFolder(parent))
    return { ok: false, error: 'No se crean proyectos dentro de la carpeta del juego.' }
  const folder = path.join(parent, safeFolderName(name))
  try {
    if (fs.existsSync(folder) && fs.readdirSync(folder).length > 0)
      return { ok: false, error: `Ya existe la carpeta "${folder}" y no está vacía.` }
    fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, 'proyecto.json')
    fs.writeFileSync(file, json, 'utf-8')
    return { ok: true, path: file, folder }
  } catch (e) {
    return {
      ok: false,
      error: `No se pudo crear el proyecto: ${e instanceof Error ? e.message : e}`
    }
  }
}

export function readProjectFile(file: string): { path: string; content: string } | null {
  try {
    return { path: file, content: fs.readFileSync(file, 'utf-8') }
  } catch {
    return null
  }
}
