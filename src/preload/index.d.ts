import type { MapData } from '../shared/map/types'

export interface ExportModPayload {
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
  /** Archivos extra: ideas, íconos .dds, .gfx (rutas relativas al mod, con "/") */
  files?: { path: string; text?: string; bom?: boolean; data?: Uint8Array }[]
}

export interface Settings {
  /** Carpeta de instalación de HOI4 (opcional) */
  gamePath: string | null
}

export interface GameCatalogData {
  countries: [string, string][]
  ideas: [string, string][]
  states?: { id: number; name: string; owner: string }[]
  subideologies?: Record<string, string[]>
  graphicalCultures?: string[]
  graphicalCultures2d?: string[]
  historyFiles?: Record<string, string>
  countryColors?: Record<string, [number, number, number]>
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  /** Abre "Guardar como"; devuelve la ruta elegida o null */
  saveProjectDialog: (content: string, defaultName?: string) => Promise<string | null>
  /** Guarda directamente en una ruta ya conocida */
  saveProjectToPath: (filePath: string, content: string) => Promise<boolean>
  openProjectDialog: () => Promise<{ path: string; content: string } | null>
  getDefaultModPath: () => Promise<string>
  getSettings: () => Promise<Settings>
  setSettings: (s: Settings) => Promise<void>
  selectGameFolder: () => Promise<string | null>
  /** Lee países e ideas del juego (con caché); null si no hay carpeta o no es válida */
  readGameCatalog: (gamePath: string) => Promise<GameCatalogData | null>
  /** Archivo de historia de un país del juego (nombre exacto y contenido) */
  readCountryHistory: (
    gamePath: string,
    fileName: string
  ) => Promise<{ fileName: string; text: string } | null>
  /** Carga el mapa real (con progreso por onMapProgress) */
  loadMap: (gamePath: string) => Promise<{ ok: true; map: MapData } | { ok: false; error: string }>
  /** Suscribirse al progreso de carga del mapa; devuelve la función para desuscribirse */
  onMapProgress: (cb: (p: { pct: number; message: string }) => void) => () => void
  exportMod: (
    payload: ExportModPayload
  ) => Promise<{ success: boolean; error?: string; modFolder?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
