// Catálogo de ideas del juego en la interfaz: se pide UNA sola vez y se guarda en memoria.
import type { GameIdea } from '../../../shared/ideasParse'

let loaded: { gamePath: string; promise: Promise<GameIdea[]> } | null = null
export const gameIdeasStats = { requests: 0 }

export function loadGameIdeas(gamePath: string | null): Promise<GameIdea[]> {
  if (!gamePath || typeof window === 'undefined' || !window.electronAPI) return Promise.resolve([])
  if (loaded?.gamePath === gamePath) return loaded.promise
  gameIdeasStats.requests++
  const promise = window.electronAPI.readIdeasCatalog(gamePath).catch(() => [] as GameIdea[])
  loaded = { gamePath, promise }
  return promise
}

/** Resumen corto de los modificadores de una idea (para la lista) */
export function modifierSummary(i: GameIdea): string {
  const rows = i.modifiers.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
  const n = i.extraModifierText ? i.extraModifierText.split('\n').length : 0
  return [...rows, ...(n ? [`+${n} más`] : [])].join(' · ')
}

/** Minúsculas sin acentos (para buscar) */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
