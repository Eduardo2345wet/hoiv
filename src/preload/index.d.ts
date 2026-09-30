export interface ExportModPayload {
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  saveProjectDialog: (content: string, defaultName?: string) => Promise<boolean>
  openProjectDialog: () => Promise<{ path: string; content: string } | null>
  getDefaultModPath: () => Promise<string>
  exportMod: (payload: ExportModPayload) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
