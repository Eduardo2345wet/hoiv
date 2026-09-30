import type { ExportModPayload, ExportModResult } from '../shared/exportTypes'

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  saveProjectDialog: (content: string, defaultName?: string) => Promise<string | null>
  saveProject: (filePath: string, content: string) => Promise<boolean>
  openProjectDialog: () => Promise<{ path: string; content: string } | null>
  getDefaultModPath: () => Promise<string>
  exportMod: (payload: ExportModPayload) => Promise<ExportModResult>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
