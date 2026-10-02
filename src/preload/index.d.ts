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
  gameModsDir?: string
  supportedVersion?: string
  replacePrevious?: boolean
}

export type MapModArg = { path: string; name: string; replacePaths: string[] }

export interface RecentProject {
  path: string
  name: string
  template: string
  date: string
}

export type ReviewData =
  | { status: 'ok' }
  | { status: 'missing-copy' }
  | { status: 'no-export' }
  | {
      status: 'diff'
      missing: string[]
      extra: string[]
      different: string[]
      mod: {
        missing: boolean
        pathDiffers: boolean
        versionDiffers: boolean
        contentDiffers: boolean
        current?: { path: string; supportedVersion: string }
      }
    }

export interface ExportInfo {
  /** Carpeta de mods de HOI4 (con "/"), exista o no: solo para mostrar y para el path del .mod */
  modsDir: string
  docsFound: boolean
  /** <Escritorio>/HOI4 Mod Studio - Exportados */
  defaultDir: string
  lastDir: string | null
  /** Versión del juego instalado ("1.19.*") o null si no se pudo leer */
  installedVersion: string | null
  /** supported_version de reserva (editable en Ajustes) */
  fallbackVersion: string
}

export interface Settings {
  recent?: RecentProject[]
  openTabs?: string[]
  restoreTabs?: boolean
  askWhereToSave?: boolean
  lastExportDir?: string
  supportedVersion?: string
  recentIdeas?: string[]
  recentStates?: number[]
  lightMode?: boolean
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
  /** Cuadrícula del árbol de focos leída del juego (focus_spacing, link_offsets, link_spacing) */
  focusGrid?: {
    spacing: { x: number; y: number }
    linkOffsets?: { x: number; y: number }
    linkSpacing?: { x: number; y: number }
  }
}

export interface ElectronAPI {
  selectFolder: (defaultPath?: string) => Promise<string | null>
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
  /** Datos para Exportar mod (rutas que solo se muestran: la app no escribe en el juego) */
  getExportInfo: () => Promise<ExportInfo>
  exportExists: (folder: string, modName: string) => Promise<boolean>
  /** Archivos del juego (minúsculas, con "/") para no pisarlos al exportar */
  listGameFiles: (gamePath: string) => Promise<string[]>
  getMemory: () => Promise<{
    main: number
    total: number
    processes: { type: string; bytes: number }[]
  }>
  cacheInfo: () => Promise<{ bytes: number; files: number }>
  clearCache: () => Promise<{ bytes: number; files: number }>
  /** Ideas del juego (common/ideas): se leen una vez y se guardan en caché */
  readIdeasCatalog: (gamePath: string) => Promise<import('../shared/ideasParse').GameIdea[]>
  /** SOLO LECTURA: compara la copia instalada en el juego con la última exportación */
  reviewInstalled: (
    modName: string
  ) => Promise<{ result: ReviewData; modsDir: string; slug: string; leftovers: string[] }>
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
