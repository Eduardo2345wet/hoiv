// Puente seguro entre la interfaz (renderer) y Node (proceso principal)
import { contextBridge, ipcRenderer } from 'electron'
import type { ExportModPayload } from './index.d'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveProjectDialog: (content: string, defaultName?: string) =>
    ipcRenderer.invoke('save-project-dialog', content, defaultName),
  saveProjectToPath: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-project-to-path', filePath, content),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  getDefaultModPath: () => ipcRenderer.invoke('get-default-mod-path'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (s: unknown) => ipcRenderer.invoke('set-settings', s),
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  readGameCatalog: (gamePath: string) => ipcRenderer.invoke('read-game-catalog', gamePath),
  readCountryHistory: (gamePath: string, fileName: string) =>
    ipcRenderer.invoke('read-country-history', gamePath, fileName),
  exportMod: (payload: ExportModPayload) => ipcRenderer.invoke('export-mod', payload)
})
