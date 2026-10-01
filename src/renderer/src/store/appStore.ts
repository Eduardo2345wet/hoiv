// Store central de la app (sin librerías): el estado vive aquí y los
// componentes de React se suscriben con useApp(). Blockly también lo lee
// (por ejemplo, los menús de FieldCatalog consultan el proyecto actual).
import { useSyncExternalStore } from 'react'
import type { Project } from '../types'
import type { CatalogKind, GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
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
}

/** Tiempo que se ve un aviso */
export const TOAST_MS = 4000
let toastId = 0

export interface AppState {
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
  // ---- Mapa (no se guarda en el proyecto ni en el historial) ----
  map: MapData | null
  /** Qué mapa está cargado: 'demo', 'game' o 'mod:<carpeta>' */
  mapKey: string | null
  /** Carga en curso del mapa real: porcentaje y mensaje */
  mapLoading: { pct: number; message: string } | null
  mapError: string | null
  /** País activo del mapa (tag) y estado seleccionado */
  activeTag: string | null
  selectedStateId: number | null
  /** Avisos pequeños que se cierran solos (nunca ventanas durante el pintado) */
  toasts: Toast[]
  /** Pedido para centrar la vista del mapa en un estado (lo consume el mapa) */
  focusStateRequest: { id: number; n: number } | null
}

let state: AppState = {
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
  map: null,
  mapKey: null,
  mapLoading: null,
  mapError: null,
  activeTag: null,
  selectedStateId: null,
  focusStateRequest: null,
  toasts: []
}
const listeners = new Set<() => void>()
// Grupo abierto del historial (no forma parte del estado visible)
let openGroup: { key: string; time: number } | null = null
let catalogMemo: { game: GameCatalog | null; map: MapData; value: GameCatalog } | null = null

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

  /** Abre otro proyecto: el historial empieza vacío */
  openProject(project: Project | null, filePath: string | null): void {
    openGroup = null
    const tree = project?.focusTrees[0]?.id ?? null
    store.set({
      project,
      filePath,
      dirty: false,
      past: [],
      future: [],
      activeTreeId: tree,
      selectedUid: project?.focuses.find((f) => f.treeId === tree)?.uid ?? null
    })
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
  async loadMap(forceDemo = false): Promise<void> {
    const api = window.electronAPI
    const gamePath = state.gamePath
    const key = forceDemo ? 'demo' : store.desiredMapKey()
    if (key === 'demo' || !gamePath || !api) {
      store.set({ map: generateDemoMap(), mapKey: 'demo', mapLoading: null, mapError: null })
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
      if (res.ok) store.set({ map: res.map, mapKey: key, mapLoading: null })
      else store.set({ mapLoading: null, mapError: res.error })
    } finally {
      off()
    }
  },

  /** Qué mapa corresponde a la base del proyecto: demo (sin juego), juego o un mod */
  desiredMapKey(): string {
    if (!state.gamePath || !window.electronAPI) return 'demo'
    const ms = state.project?.mapSettings
    if (ms?.base === 'mod' && ms.mod) return `mod:${ms.mod.path}`
    return 'game'
  },

  /** Carga el mapa si el que hay no corresponde a la base actual */
  async ensureMap(): Promise<void> {
    if (state.mapLoading) return
    if (!state.map || state.mapKey !== store.desiredMapKey()) await store.loadMap()
  },

  /** Aviso pequeño que se cierra solo (con "Deshacer" opcional) */
  toast(message: string, opts: { undo?: boolean; kind?: Toast['kind'] } = {}): void {
    const t: Toast = { id: ++toastId, message, undo: !!opts.undo, kind: opts.kind ?? 'info' }
    // Como mucho 3 a la vez: el más viejo se va
    store.set({ toasts: [...state.toasts.slice(-2), t] })
    setTimeout(() => store.dismissToast(t.id), TOAST_MS)
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
