import fs from 'fs'
import path from 'path'

export interface ExportModPayload {
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
}

export async function handleExportMod(payload: ExportModPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { exportPath, modName, tag, focusTreeScript, locYaml } = payload

    if (!exportPath || !modName || !tag) {
      return { success: false, error: 'Parámetros de exportación inválidos' }
    }

    const baseName = modName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    
    // Crear directorio del mod si no existe
    const modFolder = path.join(exportPath, baseName)
    if (!fs.existsSync(modFolder)) {
      fs.mkdirSync(modFolder, { recursive: true })
    }

    // 1. NOMBRE.mod fuera (UTF-8 sin BOM)
    const rootModFile = path.join(exportPath, `${baseName}.mod`)
    const modContent = `name="${modName}"
path="mod/${baseName}"
user_dir="${baseName}"
supported_version="1.14.*"
tags={
	"Alternative History"
	"National Focuses"
}`
    fs.writeFileSync(rootModFile, modContent, 'utf-8')

    // 2. NOMBRE/descriptor.mod (UTF-8 sin BOM)
    const descriptorFile = path.join(modFolder, 'descriptor.mod')
    const descriptorContent = `name="${modName}"
supported_version="1.14.*"
tags={
	"Alternative History"
	"National Focuses"
}`
    fs.writeFileSync(descriptorFile, descriptorContent, 'utf-8')

    // 3. common/national_focus/TAG_focus.txt
    const nationalFocusDir = path.join(modFolder, 'common', 'national_focus')
    fs.mkdirSync(nationalFocusDir, { recursive: true })
    const focusFile = path.join(nationalFocusDir, `${tag}_focus.txt`)
    fs.writeFileSync(focusFile, focusTreeScript, 'utf-8')

    // 4. localisation/english/NOMBRE_l_english.yml en UTF-8 CON BOM (\ufeff)
    const locDir = path.join(modFolder, 'localisation', 'english')
    fs.mkdirSync(locDir, { recursive: true })
    const locFile = path.join(locDir, `${baseName}_l_english.yml`)
    
    // Garantizar BOM \ufeff al inicio
    const bomLocContent = '\uFEFF' + locYaml
    fs.writeFileSync(locFile, bomLocContent, 'utf-8')

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido al exportar el mod' }
  }
}
