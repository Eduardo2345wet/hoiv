// Puente seguro entre la interfaz (renderer) y Node (proceso principal)
import { contextBridge, ipcRenderer } from 'electron'
import type { ExportModPayload } from './index.d'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveProjectDialog: (content: string, defaultName?: string) =>
    ipcRenderer.invoke('save-project-dialog', content, defaultName),
  saveImageDialog: (bytes: Uint8Array, defaultName?: string) =>
    ipcRenderer.invoke('save-image-dialog', bytes, defaultName),
  onCloseRequest: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('app-close-request', listener)
    return () => ipcRenderer.removeListener('app-close-request', listener)
  },
  ackCloseRequest: () => ipcRenderer.invoke('app-close-ack'),
  confirmClose: () => ipcRenderer.invoke('app-close-confirmed'),
  getProjectsDir: () => ipcRenderer.invoke('get-projects-dir'),
  createProject: (parent: string, name: string, json: string) =>
    ipcRenderer.invoke('create-project', parent, name, json),
  openProjectPath: (file: string) => ipcRenderer.invoke('open-project-path', file),
  saveProjectToPath: (filePath: string, content: string) =>
    ipcRenderer.invoke('save-project-to-path', filePath, content),
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  getDefaultModPath: () => ipcRenderer.invoke('get-default-mod-path'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  detectGame: () => ipcRenderer.invoke('detect-game'),
  setSettings: (s: unknown) => ipcRenderer.invoke('set-settings', s),
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  readGameCatalog: (gamePath: string) => ipcRenderer.invoke('read-game-catalog', gamePath),
  readCountryHistory: (gamePath: string, fileName: string) =>
    ipcRenderer.invoke('read-country-history', gamePath, fileName),
  readGameFlags: (gamePath: string, mod?: unknown) =>
    ipcRenderer.invoke('read-game-flags', gamePath, mod ?? null),
  listMods: (gamePath: string | null) => ipcRenderer.invoke('list-mods', gamePath),
  loadMap: (gamePath: string, mod?: unknown) =>
    ipcRenderer.invoke('load-map', gamePath, mod ?? null),
  onMapProgress: (cb: (p: { pct: number; message: string }) => void) => {
    const listener = (_: unknown, p: { pct: number; message: string }): void => cb(p)
    ipcRenderer.on('map-progress', listener)
    return () => ipcRenderer.removeListener('map-progress', listener)
  },
  planStatePatches: (gamePath: string, requests: unknown, mod?: unknown) =>
    ipcRenderer.invoke('plan-state-patches', gamePath, requests, mod ?? null),
  onStatesProgress: (cb: (p: { done: number; total: number }) => void) => {
    const listener = (_: unknown, p: { done: number; total: number }): void => cb(p)
    ipcRenderer.on('states-progress', listener)
    return () => ipcRenderer.removeListener('states-progress', listener)
  },
  exportMod: (payload: ExportModPayload) => ipcRenderer.invoke('export-mod', payload)
})
