// Store central de la app (sin librerías): el estado vive aquí y los
// componentes de React se suscriben con useApp(). Blockly también lo lee
// (por ejemplo, los menús de FieldCatalog consultan el proyecto actual).
import { useSyncExternalStore } from 'react'
import type { Project } from '../types'
import { resetOwnerCounts } from '../map/mapOps'
import type { ToolId } from '../map/tools'
import type { ViewMode } from '../map/colors'
import type { LabelMode } from '../map/labelLayout'
import type { View } from '../map/renderer'
import type { CatalogKind, GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import type { GameFlags } from '../countries/gameFlags'
import { DEMO_COUNTRY_NAMES, generateDemoMap } from '../../../shared/map/demo'

/** Pedido genérico de "elige un elemento haciendo clic" (focos ahora, estados en el mapa después) */
export interface PickRequest {
  kind: CatalogKind
  /** uids que no se pueden elegir (ej. el foco que estoy editando) */
  exclude: string[]
  onPick: (uid: string) => void
  onCancel?: () => void
}

/** Diálogo de texto propio (Electron no soporta window.prompt) */
export interface PromptRequest {
  message: string
  defaultValue: string
  /** Devuelve un mensaje de error o null si el texto es válido */
  validate?: (text: string) => string | null
  callback: (value: string | null) => void
}

/** Opciones de un cambio del proyecto para el historial de deshacer */
export interface ChangeOptions {
  /**
   * Cambios continuos con la misma clave se agrupan en UN paso:
   * - arrastrar un foco: 'drag:<uid>' hasta que se llama a endGroup() al soltar
   * - escribir en un campo: 'field:<...>' hasta salir del campo o 500 ms sin teclear
   */
  group?: string
}

/** Máximo de pasos de deshacer */
export const HISTORY_LIMIT = 100
/** Tiempo sin teclear que cierra un grupo de escritura */
export const GROUP_IDLE_MS = 500

export interface Toast {
  id: number
  message: string
  /** Mostrar el botón "Deshacer" */
  undo: boolean
  kind: 'info' | 'error'
  /** Botón extra del aviso (p. ej. "Abrir carpeta") */
  action?: { label: string; run: () => void }
}

/** Tiempo que se ve un aviso */
export const TOAST_MS = 4000
let toastId = 0

// ======================= Pestañas de proyectos =======================
export type RibbonId = 'inicio' | 'mapa' | 'focos' | 'paises' | 'ideas' | 'iconos' | 'exportar'

/** Estado de la interfaz que es PROPIO de cada pestaña (nada se comparte entre pestañas) */
export interface TabUi {
  ribbon: RibbonId
  tool: ToolId
  focusTool: 'select' | 'prereq' | 'exclusive'
  mapMode: ViewMode
  labels: LabelMode
  capitals: boolean
  provinceBorders: boolean
  gameColors: boolean
  /** Opciones del Pincel */
  brushOpts: { giveCore: boolean; removePreviousCores: boolean }
  /** Vista del mapa (zoom y posición); null = ajustar al abrir */
  mapView: View | null
}

export const DEFAULT_TAB_UI: TabUi = {
  ribbon: 'inicio',
  tool: 'select',
  focusTool: 'select',
  mapMode: 'politico',
  labels: 'id',
  capitals: true,
  provinceBorders: false,
  gameColors: false,
  brushOpts: { giveCore: true, removePreviousCores: false },
  mapView: null
}

/** Todo lo que cambia de una pestaña a otra */
const TAB_KEYS = [
  'project',
  'past',
  'future',
  'filePath',
  'dirty',
  'selectedUid',
  'activeTreeId',
  'activeTag',
  'recentTags',
  'pendingView',
  'selectedStateId',
  'ui'
] as const
type TabKey = (typeof TAB_KEYS)[number]
export type TabSnapshot = Pick<AppState, TabKey>

export interface TabRec {
  id: string
  /** Estado guardado mientras la pestaña NO es la activa */
  snap: TabSnapshot
}

let tabSeq = 0
const blankTab = (): TabSnapshot => ({
  project: null,
  past: [],
  future: [],
  filePath: null,
  dirty: false,
  selectedUid: null,
  activeTreeId: null,
  activeTag: null,
  recentTags: [],
  pendingView: false,
  selectedStateId: null,
  ui: { ...DEFAULT_TAB_UI }
})

/** Mapas ya cargados, COMPARTIDOS entre pestañas (clave: 'demo', 'game' o 'mod:<carpeta>') */
const mapCache = new Map<string, MapData>()
const flagCache = new Map<string, GameFlags>()

export interface AppState {
  /** Pestañas abiertas; la activa guarda su estado vivo en los campos de abajo */
  tabs: TabRec[]
  activeTabId: string | null
  /** Interfaz de la pestaña activa */
  ui: TabUi
  /** Banderas reales del juego (compartidas entre pestañas); null = todavía no / sin juego */
  gameFlags: GameFlags | null
  /** Datos de la barra de estado que publica el mapa (no son de una pestaña) */
  mapStatus: { hover: string; zoom: number; engine: string }
  project: Project | null
  /** Historial (snapshots del proyecto; son inmutables, así que comparten memoria) */
  past: Project[]
  future: Project[]
  filePath: string | null
  dirty: boolean
  /** uid del foco seleccionado (el que se edita en Blockly) */
  selectedUid: string | null
  /** Árbol de focos que se está editando (no entra en el historial) */
  activeTreeId: string | null
  pick: PickRequest | null
  prompt: PromptRequest | null
  /** Contenido del juego base leído de la carpeta de HOI4 (null = usar lista integrada) */
  game: GameCatalog | null
  /** Carpeta del juego configurada (null = sin juego) */
  gamePath: string | null
  /** Cómo se obtuvo la carpeta del juego */
  gameDetect: { searching: boolean; auto: boolean; via: string | null }
  // ---- Mapa (no se guarda en el proyecto ni en el historial) ----
  map: MapData | null
  /** Qué mapa está cargado: 'demo', 'game' o 'mod:<carpeta>' */
  mapKey: string | null
  /** Carga en curso del mapa real: porcentaje y mensaje */
  mapLoading: { pct: number; message: string } | null
  mapError: string | null
  /** País activo del mapa (el pincel, por tag) y estado seleccionado */
  activeTag: string | null
  /** Últimos países usados como pincel */
  recentTags: string[]
  /** "Ver pendientes": resaltar los estados sin pintar (modo Sin nación) */
  pendingView: boolean
  selectedStateId: number | null
  /** Avisos pequeños que se cierran solos (nunca ventanas durante el pintado) */
  toasts: Toast[]
  /** Pedido para centrar la vista del mapa en un estado (lo consume el mapa) */
  focusStateRequest: { id: number; n: number } | null
  /** Ventanas generales (no son de una pestaña) */
  newProjectDialog: { name: string } | null
  propsDialog: boolean
  /** Pedido de abrir el asistente de un país (lo consume el editor) */
  wizardRequest: { uid?: string; step?: number; n: number } | null
  settingsDialog: boolean
  /** Pregunta con varios botones (guardar / no guardar / cancelar…) */
  ask: AskRequest | null
  /** Selector universal de país abierto */
  countryPicker: { title: string; resolve: (r: CountryPick | null) => void } | null
}

/** Resultado del selector universal de país */
export type CountryPick = { tag: string } | { create: 'quick' | 'wizard' }

export interface AskRequest {
  title: string
  message: string
  /** Texto adicional en lista (por ejemplo, los proyectos con cambios) */
  items?: string[]
  buttons: { label: string; value: string; primary?: boolean }[]
  resolve: (value: string) => void
}

let state: AppState = {
  tabs: [],
  activeTabId: null,
  ui: { ...DEFAULT_TAB_UI },
  mapStatus: { hover: '', zoom: 1, engine: '' },
  gameFlags: null,
  project: null,
  past: [],
  future: [],
  filePath: null,
  dirty: false,
  selectedUid: null,
  activeTreeId: null,
  pick: null,
  prompt: null,
  game: null,
  gamePath: null,
  gameDetect: { searching: false, auto: false, via: null },
  map: null,
  mapKey: null,
  mapLoading: null,
  mapError: null,
  activeTag: null,
  recentTags: [],
  pendingView: false,
  selectedStateId: null,
  focusStateRequest: null,
  newProjectDialog: null,
  propsDialog: false,
  wizardRequest: null,
  settingsDialog: false,
  ask: null,
  countryPicker: null,
  toasts: []
}
const listeners = new Set<() => void>()
// Grupo abierto del historial (no forma parte del estado visible)
let openGroup: { key: string; time: number } | null = null
let catalogMemo: { game: GameCatalog | null; map: MapData; value: GameCatalog } | null = null

function freshSnapshot(project: Project, filePath: string | null, ribbon: RibbonId): TabSnapshot {
  const tree = project.focusTrees[0]?.id ?? null
  return {
    ...blankTab(),
    project,
    filePath,
    activeTreeId: tree,
    selectedUid: project.focuses.find((f) => f.treeId === tree)?.uid ?? null,
    ui: { ...DEFAULT_TAB_UI, ribbon }
  }
}

export const store = {
  get: (): AppState => state,
  set(patch: Partial<AppState>): void {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  /** Cambia el proyecto (marca "sin guardar") y lo registra en el historial */
  updateProject(fn: (p: Project) => Project, opts: ChangeOptions = {}): void {
    if (!state.project) return
    const next = fn(state.project)
    if (next === state.project) return
    const now = Date.now()
    const g = openGroup
    const sameGroup =
      !!opts.group &&
      !!g &&
      g.key === opts.group &&
      (opts.group.startsWith('drag:') || now - g.time < GROUP_IDLE_MS)
    openGroup = opts.group ? { key: opts.group, time: now } : null
    if (sameGroup) {
      // Mismo paso: no se guarda un snapshot nuevo
      store.set({ project: next, dirty: true, future: [] })
      return
    }
    const past = [...state.past, state.project].slice(-HISTORY_LIMIT)
    store.set({ project: next, dirty: true, past, future: [] })
  },

  /** Cierra el grupo abierto (al soltar un arrastre o salir de un campo) */
  endGroup(): void {
    openGroup = null
  },

  /**
   * Cambios de Blockly: tienen su propio deshacer, así que NO van al historial de la app.
   * Para que deshacer otra cosa no borre lo hecho en los bloques, el nuevo estado de los
   * bloques se copia también en los snapshots que tenían los mismos bloques de antes.
   */
  updateBlocks(uid: string, patch: Partial<Project['focuses'][number]>): void {
    const p = state.project
    if (!p) return
    const prev = p.focuses.find((f) => f.uid === uid)
    if (!prev) return
    const apply = (snap: Project): Project =>
      snap.focuses.some((f) => f.uid === uid && f.blocks === prev.blocks)
        ? {
            ...snap,
            focuses: snap.focuses.map((f) =>
              f.uid === uid && f.blocks === prev.blocks ? { ...f, ...patch } : f
            )
          }
        : snap
    store.set({
      project: { ...p, focuses: p.focuses.map((f) => (f.uid === uid ? { ...f, ...patch } : f)) },
      past: state.past.map(apply),
      future: state.future.map(apply),
      dirty: true
    })
  },

  canUndo: (): boolean => state.past.length > 0,
  canRedo: (): boolean => state.future.length > 0,
  undo(): void {
    if (!state.project || !state.past.length) return
    openGroup = null
    const prev = state.past[state.past.length - 1]
    store.set({
      project: prev,
      past: state.past.slice(0, -1),
      future: [state.project, ...state.future],
      dirty: true
    })
  },
  redo(): void {
    if (!state.project || !state.future.length) return
    openGroup = null
    const [next, ...rest] = state.future
    store.set({ project: next, past: [...state.past, state.project], future: rest, dirty: true })
  },

  /**
   * Abre un proyecto en la pestaña ACTIVA (el historial empieza vacío); si no hay pestañas,
   * crea una. Con `null` cierra la pestaña activa.
   */
  openProject(project: Project | null, filePath: string | null): void {
    openGroup = null
    if (!project) {
      if (state.activeTabId) store.closeTab(state.activeTabId)
      return
    }
    resetOwnerCounts()
    const snap = freshSnapshot(project, filePath, state.ui.ribbon)
    if (!state.activeTabId) {
      const id = `t${++tabSeq}`
      store.set({ tabs: [{ id, snap }], activeTabId: id, ...snap })
      return
    }
    store.set({ ...snap, ui: { ...snap.ui, ribbon: state.ui.ribbon } })
  },

  /** Abre un proyecto en una pestaña NUEVA (o activa la que ya lo tenía abierto) */
  openInNewTab(project: Project, filePath: string | null, ribbon?: RibbonId): string {
    openGroup = null
    if (filePath) {
      const same = store.listTabs().find((t) => t.filePath === filePath)
      if (same) {
        store.switchTab(same.id)
        return same.id
      }
    }
    resetOwnerCounts()
    store.saveActiveTab()
    const id = `t${++tabSeq}`
    const snap = freshSnapshot(project, filePath, ribbon ?? 'inicio')
    store.set({ tabs: [...state.tabs, { id, snap }], activeTabId: id, ...snap })
    void store.ensureMap()
    return id
  },

  /** Guarda el estado vivo en la ficha de la pestaña activa */
  saveActiveTab(): void {
    const id = state.activeTabId
    if (!id) return
    const snap = {} as Record<string, unknown>
    for (const k of TAB_KEYS) snap[k] = state[k]
    state = {
      ...state,
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, snap: snap as TabSnapshot } : t))
    }
  },

  switchTab(id: string): void {
    if (id === state.activeTabId) return
    const target = state.tabs.find((t) => t.id === id)
    if (!target) return
    openGroup = null
    resetOwnerCounts()
    store.saveActiveTab()
    store.set({ activeTabId: id, ...target.snap, pick: null })
    void store.ensureMap()
  },

  /** Pestaña siguiente (+1) o anterior (−1), dando la vuelta */
  cycleTab(dir: number): void {
    const n = state.tabs.length
    if (n < 2) return
    const i = state.tabs.findIndex((t) => t.id === state.activeTabId)
    store.switchTab(state.tabs[(i + dir + n) % n].id)
  },

  /** Cierra una pestaña (la interfaz ya preguntó si había cambios sin guardar) */
  closeTab(id: string): void {
    const idx = state.tabs.findIndex((t) => t.id === id)
    if (idx < 0) return
    resetOwnerCounts()
    openGroup = null
    const rest = state.tabs.filter((t) => t.id !== id)
    if (id !== state.activeTabId) return store.set({ tabs: rest })
    const next = rest[Math.min(idx, rest.length - 1)]
    if (!next) store.set({ tabs: [], activeTabId: null, ...blankTab(), pick: null })
    else store.set({ tabs: rest, activeTabId: next.id, ...next.snap, pick: null })
    void store.ensureMap()
  },

  /** Lista de pestañas con sus datos visibles (la activa lee el estado vivo) */
  listTabs(): {
    id: string
    name: string
    dirty: boolean
    filePath: string | null
    active: boolean
  }[] {
    return state.tabs.map((t) => {
      const live = t.id === state.activeTabId
      const src = live ? state : t.snap
      return {
        id: t.id,
        name: src.project?.modName ?? '—',
        dirty: src.dirty,
        filePath: src.filePath,
        active: live
      }
    })
  },

  /** Cambia la interfaz propia de la pestaña activa */
  setUi(patch: Partial<TabUi>): void {
    store.set({ ui: { ...state.ui, ...patch } })
  },

  /**
   * Catálogo del juego + lo que aporta el mapa cargado (estados con nombre y dueño,
   * y los países ficticios del mapa de demostración).
   */
  catalogGame(): GameCatalog | null {
    const { game, map } = state
    if (!map) return game
    // Memo: el mismo objeto mientras no cambien el juego ni el mapa (lo usa useApp)
    if (catalogMemo && catalogMemo.game === game && catalogMemo.map === map)
      return catalogMemo.value
    const states = map.states.map((s) => ({ id: s.id, name: s.name, owner: s.owner }))
    const countries =
      map.source === 'demo'
        ? [...(game?.countries ?? []), ...Object.entries(DEMO_COUNTRY_NAMES)]
        : (game?.countries ?? [])
    const value: GameCatalog = { ideas: [], ...game, countries, states }
    catalogMemo = { game, map, value }
    return value
  },

  /** Carga el mapa: el REAL si hay carpeta del juego, si no el de DEMOSTRACIÓN */
  async loadMap(forceDemo = false, forceReload = false): Promise<void> {
    const api = typeof window === 'undefined' ? undefined : window.electronAPI
    const gamePath = state.gamePath
    const key = forceDemo ? 'demo' : store.desiredMapKey()
    // Los mapas se COMPARTEN entre pestañas: el que ya se cargó no se vuelve a leer
    const cached = !forceDemo || key === 'demo' ? mapCache.get(key) : undefined
    if (cached && !forceReload) {
      store.set({ map: cached, mapKey: key, mapLoading: null, mapError: null })
      return
    }
    if (key === 'demo' || !gamePath || !api) {
      const demo = mapCache.get('demo') ?? generateDemoMap()
      mapCache.set('demo', demo)
      store.set({ map: demo, mapKey: 'demo', mapLoading: null, mapError: null })
      return
    }
    const mod = key.startsWith('mod:') ? (state.project?.mapSettings.mod ?? null) : null
    store.set({
      mapLoading: { pct: 0, message: mod ? `Preparando (mod: ${mod.name})…` : 'Preparando…' },
      mapError: null
    })
    const off = api.onMapProgress((p) => store.set({ mapLoading: p }))
    try {
      const res = await api.loadMap(gamePath, mod)
      if (res.ok) {
        mapCache.set(key, res.map)
        store.set({ map: res.map, mapKey: key, mapLoading: null })
      } else store.set({ mapLoading: null, mapError: res.error })
    } finally {
      off()
    }
    // Si mientras cargaba se cambió de pestaña, cargar el mapa de la pestaña de ahora
    if (state.map && state.mapKey !== store.desiredMapKey()) void store.ensureMap()
  },

  /** Qué mapa corresponde a la base del proyecto: demo (sin juego), juego o un mod */
  desiredMapKey(): string {
    if (!state.gamePath || typeof window === 'undefined' || !window.electronAPI) return 'demo'
    const ms = state.project?.mapSettings
    if (ms?.base === 'mod' && ms.mod) return `mod:${ms.mod.path}`
    return 'game'
  },

  /**
   * Lee las banderas del juego (una vez por juego/mod; compartidas entre pestañas). Si el
   * proyecto usa un mod como base, las banderas del mod tienen prioridad.
   */
  async loadFlags(): Promise<void> {
    const api = typeof window === 'undefined' ? undefined : window.electronAPI
    const gamePath = state.gamePath
    if (!api?.readGameFlags || !gamePath) return store.set({ gameFlags: null })
    const mod = state.project?.mapSettings.mod ?? null
    const key = `${gamePath}|${mod?.path ?? ''}`
    const hit = flagCache.get(key)
    if (hit) return store.set({ gameFlags: hit })
    try {
      const flags = (await api.readGameFlags(gamePath, mod)) as GameFlags
      flagCache.set(key, flags)
      if (state.gamePath === gamePath) store.set({ gameFlags: flags })
    } catch (e) {
      console.warn('No se pudieron leer las banderas del juego:', e)
    }
  },

  /** Olvida los mapas en memoria (al cambiar la carpeta del juego) */
  clearMapCache(): void {
    mapCache.clear()
    flagCache.clear()
  },

  /** Carga el mapa si el que hay no corresponde a la base actual */
  async ensureMap(): Promise<void> {
    if (state.mapLoading) return
    if (!state.map || state.mapKey !== store.desiredMapKey()) await store.loadMap()
    void store.loadFlags()
  },

  /** Aviso pequeño que se cierra solo (con "Deshacer" opcional) */
  toast(
    message: string,
    opts: { undo?: boolean; kind?: Toast['kind']; action?: Toast['action'] } = {}
  ): void {
    const t: Toast = {
      id: ++toastId,
      message,
      undo: !!opts.undo,
      kind: opts.kind ?? 'info',
      action: opts.action
    }
    // Como mucho 3 a la vez: el más viejo se va
    store.set({ toasts: [...state.toasts.slice(-2), t] })
    setTimeout(() => store.dismissToast(t.id), opts.action ? TOAST_MS * 2.5 : TOAST_MS)
  },
  dismissToast(id: number): void {
    if (state.toasts.some((t) => t.id === id))
      store.set({ toasts: state.toasts.filter((t) => t.id !== id) })
  },

  /** Centrar el mapa en un estado */
  focusState(id: number): void {
    store.set({
      focusStateRequest: { id, n: (state.focusStateRequest?.n ?? 0) + 1 },
      selectedStateId: id
    })
  },

  // ---- Modo selección genérico ----
  startPick(req: PickRequest): void {
    state.pick?.onCancel?.()
    store.set({ pick: req })
  },
  finishPick(uid: string): void {
    const p = state.pick
    if (!p || p.exclude.includes(uid)) return
    store.set({ pick: null })
    p.onPick(uid)
  },
  cancelPick(): void {
    const p = state.pick
    store.set({ pick: null })
    p?.onCancel?.()
  },

  /** Abre el selector universal de país (CountryPicker); null si se cierra */
  pickCountry(title = 'Elegir país'): Promise<CountryPick | null> {
    return new Promise((resolve) => store.set({ countryPicker: { title, resolve } }))
  },
  answerCountryPick(r: CountryPick | null): void {
    const a = state.countryPicker
    store.set({ countryPicker: null })
    a?.resolve(r)
  },

  /** Pregunta con botones; devuelve el `value` del botón elegido ('' si se cierra) */
  askUser(req: Omit<AskRequest, 'resolve'>): Promise<string> {
    return new Promise((resolve) => store.set({ ask: { ...req, resolve } }))
  },
  answerAsk(value: string): void {
    const a = state.ask
    store.set({ ask: null })
    a?.resolve(value)
  },

  // ---- Diálogo de texto ----
  openPrompt(req: PromptRequest): void {
    store.set({ prompt: req })
  },
  closePrompt(value: string | null): void {
    const p = state.prompt
    store.set({ prompt: null })
    p?.callback(value)
  }
}

/** Hook de React: devuelve una parte del estado y redibuja cuando cambia */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state))
}

// Solo en desarrollo y en las pruebas de navegador: deja el store a mano (window.__hoiStore)
if (
  typeof window !== 'undefined' &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
)
  (window as unknown as { __hoiStore: typeof store }).__hoiStore = store
