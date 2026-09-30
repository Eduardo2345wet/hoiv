// Escribe los archivos del mod en disco (se ejecuta en el proceso principal de Electron).
import fs from 'fs'
import path from 'path'
import { safeFolderName } from '../shared/names'

export interface ExportModPayload {
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

export async function handleExportMod(payload: ExportModPayload): Promise<ExportResult> {
  try {
    const { exportPath, modName, tag, focusTreeScript, locYaml } = payload

    if (!exportPath || !modName || !tag) {
      return { success: false, error: 'Parámetros de exportación inválidos' }
    }
    if (isGameInstallFolder(exportPath)) {
      return {
        success: false,
        error:
          'Esa carpeta pertenece a la instalación del juego. Elige Documentos/Paradox Interactive/Hearts of Iron IV/mod'
      }
    }

    const baseName = safeFolderName(modName)
    const modFolder = path.join(exportPath, baseName)
    fs.mkdirSync(modFolder, { recursive: true })

    const tags = `tags={\n\t"Alternative History"\n\t"National Focuses"\n}`
    const descriptor = `version="1.0"\n${tags}\nname="${escapeQuotes(modName)}"\nsupported_version="1.*"\n`

    // 1. NOMBRE/descriptor.mod (UTF-8 SIN BOM: Node no añade BOM con 'utf-8')
    fs.writeFileSync(path.join(modFolder, 'descriptor.mod'), descriptor, 'utf-8')

    // 2. NOMBRE.mod fuera de la carpeta, con la ruta absoluta (barras "/")
    const absPath = modFolder.replace(/\\/g, '/')
    fs.writeFileSync(
      path.join(exportPath, `${baseName}.mod`),
      `${descriptor}path="${absPath}"\n`,
      'utf-8'
    )

    // 3. common/national_focus/TAG_focus.txt (UTF-8 sin BOM)
    const focusDir = path.join(modFolder, 'common', 'national_focus')
    fs.mkdirSync(focusDir, { recursive: true })
    fs.writeFileSync(path.join(focusDir, `${tag}_focus.txt`), focusTreeScript, 'utf-8')

    // 4. localisation/english/NOMBRE_l_english.yml en UTF-8 CON BOM (﻿)
    const locDir = path.join(modFolder, 'localisation', 'english')
    fs.mkdirSync(locDir, { recursive: true })
    fs.writeFileSync(path.join(locDir, `${baseName}_l_english.yml`), '﻿' + locYaml, 'utf-8')

    // 5. Archivos extra (ideas, íconos .dds, .gfx). Solo rutas dentro del mod.
    for (const f of payload.files ?? []) {
      const rel = f.path.replace(/\\/g, '/')
      if (rel.startsWith('/') || rel.split('/').includes('..') || /^[a-z]:/i.test(rel))
        return { success: false, error: `Ruta no permitida: ${f.path}` }
      const target = path.join(modFolder, ...rel.split('/'))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      if (f.data) fs.writeFileSync(target, Buffer.from(f.data))
      else fs.writeFileSync(target, (f.bom ? '\uFEFF' : '') + (f.text ?? ''), 'utf-8')
    }

    return { success: true, modFolder }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al exportar el mod'
    return { success: false, error: message }
  }
}
