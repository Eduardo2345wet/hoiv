// Escribe los archivos del mod en disco (se ejecuta en el proceso principal de Electron).
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { modSlug, safeFolderName } from '../shared/names'
import { pathProblems } from '../shared/exportPaths'
import { DEFAULT_SUPPORTED_VERSION, hoi4ModsDir } from './exportInfo'

export interface ExportModPayload {
  /** Nombres de los mods de los que depende (dependencies = { … }) */
  dependencies?: string[]
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
  files?: { path: string; text?: string; bom?: boolean; data?: Uint8Array }[]
  /** Carpeta de mods de HOI4 donde el usuario COPIARÁ el mod (con "/"): va en el path del .mod */
  gameModsDir?: string
  /** supported_version del descriptor, ej. "1.19.*" */
  supportedVersion?: string
  /** El usuario aceptó reemplazar la exportación anterior de este mod en la carpeta elegida */
  replacePrevious?: boolean
}

/** Lo que se escribió en la última exportación (para "Revisar mod instalado") */
export interface ExportManifest {
  slug: string
  /** ruta relativa → sha1 */
  files: Record<string, string>
  mod: { path: string; supportedVersion: string; sha1: string }
}

export interface ExportResult {
  success: boolean
  error?: string
  modFolder?: string
  manifest?: ExportManifest
}

export const sha1 = (b: Buffer | string): string =>
  crypto.createHash('sha1').update(b).digest('hex')

/** Valor de una línea clave="valor" de un descriptor / .mod */
export const modValue = (text: string, key: string): string =>
  new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(text)?.[1] ?? ''

export { safeFolderName }

export const INVALID_NAME =
  'El nombre del mod no es válido; cámbialo en Archivo → Propiedades del proyecto'

/** ¿La carpeta es (o está dentro de) Documentos/Paradox Interactive/Hearts of Iron IV? */
export function isHoi4DocumentsFolder(folder: string): boolean {
  return /\/paradox interactive\/hearts of iron iv(\/|$)/i.test(folder.replace(/\\/g, '/'))
}

/** ¿Ya hay una exportación de este mod en la carpeta (la carpeta del mod o su .mod)? */
export function exportPreviousExists(exportPath: string, modName: string): boolean {
  const base = modSlug(modName)
  if (!base) return false
  return (
    fs.existsSync(path.join(exportPath, base)) ||
    fs.existsSync(path.join(exportPath, `${base}.mod`))
  )
}

/**
 * Detecta si la carpeta elegida es (o está dentro de) la instalación del juego.
 * NUNCA escribimos ahí: los mods van en Documentos/Paradox Interactive/Hearts of Iron IV/mod
 */
export function isGameInstallFolder(folder: string): boolean {
  const lower = folder.replace(/\\/g, '/').toLowerCase()
  if (lower.includes('/steamapps/common/')) return true
  let dir = folder
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'hoi4.exe')) || fs.existsSync(path.join(dir, 'hoi4')))
      return true
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return false
}

const escapeQuotes = (s: string): string => s.replace(/"/g, "'")

export interface ModEntry {
  /** Ruta relativa dentro de la carpeta del mod, con "/" */
  rel: string
  bytes: Buffer
}

export interface BuiltMod {
  baseName: string
  entries: ModEntry[]
  /** Texto del .mod de afuera (descriptor + path absoluto de la carpeta) */
  outerMod: string
}

/**
 * Todos los archivos del mod, en memoria (sin escribir). descriptor.mod va en UTF-8 SIN BOM;
 * el .yml, con BOM.
 */
export function buildModFiles(payload: ExportModPayload): BuiltMod | { error: string } {
  const { modName, tag, focusTreeScript, locYaml } = payload
  const baseName = modSlug(modName)
  if (!baseName) return { error: INVALID_NAME }
  const tags = `tags={\n\t"Alternative History"\n\t"National Focuses"\n}`
  // Base de mapa de otro mod: el nuestro depende de él (debe cargarse antes)
  // por verificar: el launcher de HOI4 respeta dependencies = { "Nombre" } para el orden de carga
  const deps = (payload.dependencies ?? []).filter(Boolean)
  const dependencies = deps.length
    ? `dependencies={\n${deps.map((d) => `\t"${escapeQuotes(d)}"`).join('\n')}\n}\n`
    : ''
  const descriptor = `version="1.0"\n${tags}\nname="${escapeQuotes(modName)}"\n${dependencies}supported_version="${payload.supportedVersion || DEFAULT_SUPPORTED_VERSION}"\n`
  const entries: ModEntry[] = [{ rel: 'descriptor.mod', bytes: Buffer.from(descriptor, 'utf-8') }]
  if (focusTreeScript)
    entries.push({
      rel: `common/national_focus/${tag || 'mod'}_focus.txt`,
      bytes: Buffer.from(focusTreeScript, 'utf-8')
    })
  // Sin textos (solo la cabecera) no se escribe: un proyecto vacío exporta solo el descriptor
  if (/^\s*[A-Za-z0-9_.-]+:\d*\s*"/m.test(locYaml))
    entries.push({
      rel: `localisation/english/${baseName}_l_english.yml`,
      bytes: Buffer.from('\uFEFF' + locYaml, 'utf-8')
    })
  for (const f of payload.files ?? []) {
    const rel = f.path.replace(/\\/g, '/')
    if (rel.startsWith('/') || rel.split('/').includes('..') || /^[a-z]:/i.test(rel))
      return { error: `Ruta no permitida: ${f.path}` }
    // Defensa en profundidad: la lista negra también se aplica aquí
    const bad = pathProblems(rel)[0]
    if (bad) return { error: bad }
    entries.push({
      rel,
      bytes: f.data
        ? Buffer.from(f.data)
        : Buffer.from((f.bom ? '\uFEFF' : '') + (f.text ?? ''), 'utf-8')
    })
  }
  // El .mod apunta a donde quedará el mod DESPUÉS de copiarlo a mano (no a la carpeta exportada)
  const modsDir = (
    payload.gameModsDir ||
    hoi4ModsDir(path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Hearts of Iron IV'))
  )
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  return { baseName, entries, outerMod: `${descriptor}path="${modsDir}/${baseName}"\n` }
}

export async function handleExportMod(payload: ExportModPayload): Promise<ExportResult> {
  try {
    // (los proyectos nuevos no tienen un tag propio: los árboles van en `files`, uno por país)
    if (!payload.exportPath || !payload.modName) {
      return { success: false, error: 'Parámetros de exportación inválidos' }
    }
    if (isHoi4DocumentsFolder(payload.exportPath)) {
      return {
        success: false,
        error:
          'La app nunca escribe en la carpeta de mods del juego. Elige otra carpeta (por ejemplo en el Escritorio) y copia el mod a mano.'
      }
    }
    if (isGameInstallFolder(payload.exportPath)) {
      return {
        success: false,
        error:
          'Esa carpeta pertenece a la instalación del juego. Elige Documentos/Paradox Interactive/Hearts of Iron IV/mod'
      }
    }
    const built = buildModFiles(payload)
    if ('error' in built) return { success: false, error: built.error }
    // Todo se normaliza con path.resolve: el mod es SIEMPRE una subcarpeta nueva de la carpeta
    // elegida, y nada se escribe ni se borra fuera de ella (ni de su .mod)
    const root = path.resolve(payload.exportPath)
    const modFolder = path.resolve(root, built.baseName)
    const outerFile = path.resolve(root, `${built.baseName}.mod`)
    if (
      path.dirname(modFolder) !== root ||
      path.basename(modFolder) !== built.baseName ||
      path.dirname(outerFile) !== root
    )
      return { success: false, error: INVALID_NAME }
    if (exportPreviousExists(payload.exportPath, payload.modName)) {
      if (!payload.replacePrevious)
        return {
          success: false,
          error: 'Ya hay una exportación anterior de este mod en esa carpeta.'
        }
      // Solo dentro de la carpeta elegida: la carpeta del mod y su .mod, completos
      fs.rmSync(modFolder, { recursive: true, force: true })
      fs.rmSync(outerFile, { force: true })
    }
    fs.mkdirSync(modFolder, { recursive: true })
    for (const e of built.entries) {
      const target = path.resolve(modFolder, ...e.rel.split('/'))
      if (!target.startsWith(modFolder + path.sep)) throw new Error(`Ruta no permitida: ${e.rel}`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, e.bytes)
    }
    // NOMBRE.mod fuera de la carpeta, con la ruta absoluta (barras "/")
    fs.writeFileSync(outerFile, built.outerMod, 'utf-8')
    const manifest: ExportManifest = {
      slug: built.baseName,
      files: Object.fromEntries(built.entries.map((e) => [e.rel, sha1(e.bytes)])),
      mod: {
        path: modValue(built.outerMod, 'path'),
        supportedVersion: modValue(built.outerMod, 'supported_version'),
        sha1: sha1(built.outerMod)
      }
    }
    return { success: true, modFolder, manifest }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al exportar el mod'
    return { success: false, error: message }
  }
}
