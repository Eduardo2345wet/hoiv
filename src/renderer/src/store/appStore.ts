// Store central de la app (sin librerías): el estado vive aquí y los
// componentes de React se suscriben con useApp(). Blockly también lo lee
// (por ejemplo, los menús de FieldCatalog consultan el proyecto actual).
import { useSyncExternalStore } from 'react'
import type { Project } from '../types'
import type { CatalogKind, GameCatalog } from '../catalog/catalog'

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

export interface AppState {
  project: Project | null
  filePath: string | null
  dirty: boolean
  /** uid del foco seleccionado (el que se edita en Blockly) */
  selectedUid: string | null
  pick: PickRequest | null
  prompt: PromptRequest | null
  /** Contenido del juego base leído de la carpeta de HOI4 (null = usar lista integrada) */
  game: GameCatalog | null
}

let state: AppState = {
  project: null,
  filePath: null,
  dirty: false,
  selectedUid: null,
  pick: null,
  prompt: null,
  game: null
}
const listeners = new Set<() => void>()

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

  /** Cambia el proyecto (marca "sin guardar") */
  updateProject(fn: (p: Project) => Project): void {
    if (!state.project) return
    const next = fn(state.project)
    if (next !== state.project) store.set({ project: next, dirty: true })
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
