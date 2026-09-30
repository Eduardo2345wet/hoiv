// Puente seguro entre la interfaz (renderer) y el proceso principal.

import { contextBridge, ipcRenderer } from 'electron'
import type { ExportModPayload } from '../shared/exportTypes'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveProjectDialog: (content: string, defaultName?: string) =>
    ipcRenderer.invoke('save-project-dialog', content, defaultName),
  saveProject: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-project', filePath, content),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  getDefaultModPath: () => ipcRenderer.invoke('get-default-mod-path'),
  exportMod: (payload: ExportModPayload) => ipcRenderer.invoke('export-mod', payload)
})
