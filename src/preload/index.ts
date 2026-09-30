import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveProjectDialog: (content: string, defaultName?: string) =>
    ipcRenderer.invoke('save-project-dialog', content, defaultName),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  getDefaultModPath: () => ipcRenderer.invoke('get-default-mod-path'),
  exportMod: (payload: any) => ipcRenderer.invoke('export-mod', payload)
})
