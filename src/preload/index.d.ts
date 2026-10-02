import type { MapData } from '../shared/map/types'

export interface ModLayer {
  path: string
  name: string
  replacePaths: string[]
}
export interface InstalledMod extends ModLayer {
  source: 'documentos' | 'workshop'
  hasMap: boolean
  hasStates: boolean
}
export interface StatePatchRequestData {
  file: string
  targets: { id: number; owner: string; cores: string[]; stripDated?: string[] }[]
}

export interface ExportModPayload {
  /** Mods de los que depende el nuestro */
  dependencies?: string[]
  exportPath: string
  modName: string
  tag: string
  focusTreeScript: string
  locYaml: string
  /** Archivos extra: ideas, íconos .dds, .gfx (rutas relativas al mod, con "/") */
  files?: { path: string; text?: string; bom?: boolean; data?: Uint8Array }[]
}

export type MapModArg = { path: string; name: string; replacePaths: string[] }

export interface RecentProject {
  path: string
  name: string
  template: string
  date: string
}

export interface SyncModResult {
  status: 'ok' | 'needs-confirm' | 'error'
  error?: string
  modFolder?: string
  modFile?: string
  written: string[]
  removed: string[]
  unchanged: number
  unknown: string[]
  firstTime: boolean
}

export interface Settings {
  recent?: RecentProject[]
  openTabs?: string[]
  restoreTabs?: boolean
  askWhereToSave?: boolean
  /** Carpeta de instalación de HOI4 (opcional) */
  gamePath: string | null
  /** La encontró la app sola */
  gamePathAuto?: boolean
}

export interface DetectGameResult {
  gamePath: string | null
  auto: boolean
  via: string | null
  libraries?: string[]
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
  countryCapitals?: Record<string, number>
  countryRuling?: Record<string, string>
  focusIds?: string[]
  focusTreeTags?: Record<string, number>
  goalsShineShape?: string
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>
  /** Abre "Guardar como"; devuelve la ruta elegida o null */
  /** Guarda un PNG con "Guardar como": { path } si se guardó, { error } si falló, null si se canceló */
  saveImageDialog: (
    bytes: Uint8Array,
    defaultName?: string
  ) => Promise<{ path: string } | { error: string } | null>
  /** La ventana se quiere cerrar: la interfaz debe responder con ackCloseRequest y confirmClose */
  onCloseRequest: (cb: () => void) => () => void
  ackCloseRequest: () => Promise<void>
  confirmClose: () => Promise<void>
  /** Carpeta de mods de HOI4 en Documentos (null si HOI4 no ha creado sus datos) */
  getModDestination: () => Promise<{ docs: string | null; modsRoot: string | null }>
  isHoi4Running: () => Promise<boolean>
  /** Sincroniza el mod con la carpeta de mods (manifiesto, solo cambios, borra lo que ya no se genera) */
  syncMod: (payload: ExportModPayload, confirmForeign?: boolean) => Promise<SyncModResult>
  /** Abre una carpeta (o muestra un archivo) en el explorador */
  openFolder: (p: string) => Promise<boolean>
  /** Documentos/HOI4 Mod Studio/Proyectos */
  /** Banderas del juego: tag → variante → PNG (data URL) */
  readGameFlags: (
    gamePath: string,
    mod?: MapModArg | null
  ) => Promise<Record<string, Partial<Record<string, string>>>>
  getProjectsDir: () => Promise<string>
  createProject: (
    parent: string,
    name: string,
    json: string
  ) => Promise<{ ok: true; path: string; folder: string } | { ok: false; error: string }>
  openProjectPath: (file: string) => Promise<{ path: string; content: string } | null>
  saveProjectDialog: (content: string, defaultName?: string) => Promise<string | null>
  /** Guarda directamente en una ruta ya conocida */
  saveProjectToPath: (filePath: string, content: string) => Promise<boolean>
  openProjectDialog: () => Promise<{ path: string; content: string } | null>
  getDefaultModPath: () => Promise<string>
  getSettings: () => Promise<Settings>
  /** Busca HOI4 (registro de Windows, bibliotecas de Steam, rutas típicas) */
  detectGame: () => Promise<DetectGameResult>
  setSettings: (s: Partial<Settings>) => Promise<void>
  selectGameFolder: () => Promise<string | null>
  /** Lee países e ideas del juego (con caché); null si no hay carpeta o no es válida */
  readGameCatalog: (gamePath: string) => Promise<GameCatalogData | null>
  /** Archivo de historia de un país del juego (nombre exacto y contenido) */
  readCountryHistory: (
    gamePath: string,
    fileName: string
  ) => Promise<{ fileName: string; text: string } | null>
  /** Mods instalados (Documentos y Workshop) */
  listMods: (gamePath: string | null) => Promise<InstalledMod[]>
  /** Carga el mapa real (con progreso por onMapProgress); `mod` = base de otro mod */
  loadMap: (
    gamePath: string,
    mod?: ModLayer | null
  ) => Promise<{ ok: true; map: MapData } | { ok: false; error: string }>
  /** Progreso del parche de estados (exportación) */
  onStatesProgress: (cb: (p: { done: number; total: number }) => void) => () => void
  /** Suscribirse al progreso de carga del mapa; devuelve la función para desuscribirse */
  onMapProgress: (cb: (p: { pct: number; message: string }) => void) => () => void
  /** Parchea (sin escribir) los archivos de estado modificados y los verifica */
  planStatePatches: (
    gamePath: string,
    requests: StatePatchRequestData[],
    mod?: ModLayer | null
  ) => Promise<{
    files: { path: string; data: Uint8Array }[]
    errors: { file: string; id?: number; message: string }[]
  }>
  /** Parchea (sin escribir) la capital de history/countries de los países del juego que la perdieron */
  planCapitalPatches: (
    gamePath: string,
    requests: { file: string; capital: number }[],
    mod?: ModLayer | null
  ) => Promise<{
    files: { path: string; data: Uint8Array }[]
    errors: { file: string; message: string }[]
  }>
  exportMod: (
    payload: ExportModPayload
  ) => Promise<{ success: boolean; error?: string; modFolder?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
