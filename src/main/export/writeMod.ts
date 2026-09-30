// Escribe los archivos del mod en disco (proceso principal de Electron).

import fs from 'fs'
import path from 'path'
import type { ExportModPayload, ExportModResult } from '../../shared/exportTypes'
import { modFolderName } from '../../shared/modName'
import { validateTag } from '../../shared/tag'

// Versión del juego que declara el mod. Si el lanzador avisa de "versión no compatible", cámbiala aquí.
export const SUPPORTED_VERSION = '1.16.*'

const GAME_EXECUTABLES = ['hoi4.exe', 'hoi4']

/**
 * ¿Es (o está dentro de) la carpeta de instalación del juego?
 * Nunca escribimos ahí: los mods van en Documentos/Paradox Interactive/Hearts of Iron IV/mod.
 */
export function isGameInstallFolder(dir: string): boolean {
  const normalized = path.resolve(dir)
  if (/[\\/]steamapps[\\/]common[\\/]/i.test(normalized + path.sep)) return true
  let current = normalized
  for (;;) {
    if (GAME_EXECUTABLES.some((exe) => fs.existsSync(path.join(current, exe)))) return true
    const parent = path.dirname(current)
    if (parent === current) return false
    current = parent
  }
}

/** Escapa comillas para los archivos .mod. */
const quote = (value: string): string => `"${value.replace(/\\/g, '/').replace(/"/g, "'")}"`

function descriptorBody(modName: string): string {
  return [
    `name=${quote(modName)}`,
    'tags={',
    '\t"Alternative History"',
    '\t"National Focuses"',
    '}',
    `supported_version=${quote(SUPPORTED_VERSION)}`
  ].join('\n')
}

/** Escribe un archivo de texto en UTF-8. Con bom=true añade la marca \uFEFF al principio. */
function writeText(file: string, content: string, bom: boolean): void {
  const clean = content.replace(/^\uFEFF/, '')
  fs.writeFileSync(file, (bom ? '\uFEFF' : '') + clean, { encoding: 'utf-8' })
}

export async function handleExportMod(payload: ExportModPayload): Promise<ExportModResult> {
  try {
    const { exportPath, modName, tag, focusTreeScript, locYaml } = payload

    if (!exportPath || !modName.trim()) {
      return { success: false, error: 'Falta la carpeta de destino o el nombre del mod.' }
    }
    const tagError = validateTag(tag)
    if (tagError) return { success: false, error: tagError }
    if (!fs.existsSync(exportPath) || !fs.statSync(exportPath).isDirectory()) {
      return { success: false, error: 'La carpeta de destino no existe.' }
    }
    if (isGameInstallFolder(exportPath)) {
      return {
        success: false,
        error:
          'Esa es la carpeta de instalación del juego. Elige Documentos/Paradox Interactive/Hearts of Iron IV/mod.'
      }
    }

    const baseName = modFolderName(modName)
    const modFolder = path.join(exportPath, baseName)
    fs.mkdirSync(modFolder, { recursive: true })

    // 1. NOMBRE.mod (fuera de la carpeta), UTF-8 SIN BOM.
    //    La ruta es absoluta para que funcione aunque la carpeta no sea la de mods por defecto.
    const rootModFile = path.join(exportPath, `${baseName}.mod`)
    writeText(rootModFile, `${descriptorBody(modName)}\npath=${quote(modFolder)}\n`, false)

    // 2. NOMBRE/descriptor.mod, UTF-8 SIN BOM.
    const descriptorFile = path.join(modFolder, 'descriptor.mod')
    writeText(descriptorFile, `${descriptorBody(modName)}\n`, false)

    // 3. common/national_focus/TAG_focus.txt
    const focusDir = path.join(modFolder, 'common', 'national_focus')
    fs.mkdirSync(focusDir, { recursive: true })
    const focusFile = path.join(focusDir, `${tag}_focus.txt`)
    writeText(focusFile, focusTreeScript, false)

    // 4. localisation/english/NOMBRE_l_english.yml, UTF-8 CON BOM (obligatorio para el juego).
    const locDir = path.join(modFolder, 'localisation', 'english')
    fs.mkdirSync(locDir, { recursive: true })
    const locFile = path.join(locDir, `${baseName}_l_english.yml`)
    writeText(locFile, locYaml, true)

    return {
      success: true,
      modFolder,
      files: [rootModFile, descriptorFile, focusFile, locFile]
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Error al exportar el mod: ${message}` }
  }
}
