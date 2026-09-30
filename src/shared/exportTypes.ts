// Tipos compartidos entre la interfaz y el proceso principal para exportar el mod.

export interface ExportModPayload {
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
}

export interface ExportModResult {
  success: boolean
  error?: string
  modFolder?: string
  files?: string[]
}
