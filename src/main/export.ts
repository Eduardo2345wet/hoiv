// Escribe los archivos del mod en disco (se ejecuta en el proceso principal de Electron).
import fs from 'fs'
import path from 'path'
import { safeFolderName } from '../shared/names'

export interface ExportModPayload {
  /** Nombres de los mods de los que depende (dependencies = { … }) */
  dependencies?: string[]
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
  files?: { path: string; text?: string; bom?: boolean; data?: Uint8Array }[]
}

export interface ExportResult {
  success: boolean
  error?: string
  modFolder?: string
}

export { safeFolderName }

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
 * Todos los archivos del mod, en memoria (sin escribir): los usan la exportación a otra carpeta
 * y la sincronización con el juego, así los dos dejan EXACTAMENTE lo mismo. descriptor.mod va en
 * UTF-8 SIN BOM; el .yml, con BOM.
 */
export function buildModFiles(payload: ExportModPayload): BuiltMod | { error: string } {
  const { exportPath, modName, tag, focusTreeScript, locYaml } = payload
  const baseName = safeFolderName(modName)
  const modFolder = path.join(exportPath, baseName)
  const tags = `tags={\n\t"Alternative History"\n\t"National Focuses"\n}`
  // Base de mapa de otro mod: el nuestro depende de él (debe cargarse antes)
  // por verificar: el launcher de HOI4 respeta dependencies = { "Nombre" } para el orden de carga
  const deps = (payload.dependencies ?? []).filter(Boolean)
  const dependencies = deps.length
    ? `dependencies={\n${deps.map((d) => `\t"${escapeQuotes(d)}"`).join('\n')}\n}\n`
    : ''
  const descriptor = `version="1.0"\n${tags}\nname="${escapeQuotes(modName)}"\n${dependencies}supported_version="1.*"\n`
  const entries: ModEntry[] = [{ rel: 'descriptor.mod', bytes: Buffer.from(descriptor, 'utf-8') }]
  if (focusTreeScript)
    entries.push({
      rel: `common/national_focus/${tag || 'mod'}_focus.txt`,
      bytes: Buffer.from(focusTreeScript, 'utf-8')
    })
  entries.push({
    rel: `localisation/english/${baseName}_l_english.yml`,
    bytes: Buffer.from('\uFEFF' + locYaml, 'utf-8')
  })
  for (const f of payload.files ?? []) {
    const rel = f.path.replace(/\\/g, '/')
    if (rel.startsWith('/') || rel.split('/').includes('..') || /^[a-z]:/i.test(rel))
      return { error: `Ruta no permitida: ${f.path}` }
    entries.push({
      rel,
      bytes: f.data
        ? Buffer.from(f.data)
        : Buffer.from((f.bom ? '\uFEFF' : '') + (f.text ?? ''), 'utf-8')
    })
  }
  const absPath = modFolder.replace(/\\/g, '/')
  return { baseName, entries, outerMod: `${descriptor}path="${absPath}"\n` }
}

export async function handleExportMod(payload: ExportModPayload): Promise<ExportResult> {
  try {
    // (los proyectos nuevos no tienen un tag propio: los árboles van en `files`, uno por país)
    if (!payload.exportPath || !payload.modName) {
      return { success: false, error: 'Parámetros de exportación inválidos' }
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
    const modFolder = path.join(payload.exportPath, built.baseName)
    fs.mkdirSync(modFolder, { recursive: true })
    for (const e of built.entries) {
      const target = path.join(modFolder, ...e.rel.split('/'))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, e.bytes)
    }
    // NOMBRE.mod fuera de la carpeta, con la ruta absoluta (barras "/")
    fs.writeFileSync(
      path.join(payload.exportPath, `${built.baseName}.mod`),
      built.outerMod,
      'utf-8'
    )
    return { success: true, modFolder }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al exportar el mod'
    return { success: false, error: message }
  }
}
