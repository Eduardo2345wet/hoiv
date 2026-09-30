export interface ExportModPayload {
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  /** Abre "Guardar como"; devuelve la ruta elegida o null */
  saveProjectDialog: (content: string, defaultName?: string) => Promise<string | null>
  /** Guarda directamente en una ruta ya conocida */
  saveProjectToPath: (filePath: string, content: string) => Promise<boolean>
  openProjectDialog: () => Promise<{ path: string; content: string } | null>
  getDefaultModPath: () => Promise<string>
  exportMod: (
    payload: ExportModPayload
  ) => Promise<{ success: boolean; error?: string; modFolder?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
