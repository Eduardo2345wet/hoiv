// Catálogo de ideas del juego en la interfaz: se pide UNA sola vez y se guarda en memoria.
import type { GameIdea } from '../../../shared/ideasParse'
import { MODIFIER_NAMES, describeGameModifier, modifierLabel } from './modifiers'

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

/** Modificadores de una idea del juego en español: "Estabilidad +10 %" (sin nombres en inglés) */
export function modifierLines(i: GameIdea): { rows: string[]; others: number } {
  const rows: string[] = []
  let others = 0
  for (const [k, v] of i.modifiers) {
    // v ya viene como lo escribe el usuario (% × 100)
    const d = MODIFIER_NAMES[k]
    const label = modifierLabel(k)
    if (!label) others++
    else rows.push(`${label} ${v > 0 ? '+' : ''}${v}${d?.percent ? ' %' : ''}`)
  }
  for (const line of (i.extraModifierText ?? '').split('\n')) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(-?[\d.]+)\s*$/.exec(line)
    const text = m ? describeGameModifier(m[1], Number(m[2])) : null
    if (text) rows.push(text)
    else if (line.trim()) others++
  }
  return { rows, others }
}

/** Resumen corto en una línea (para la lista) */
export function modifierSummary(i: GameIdea): string {
  const { rows, others } = modifierLines(i)
  const shown = rows.slice(0, 2)
  const extra = rows.length - shown.length + others
  return [...shown, ...(extra > 0 ? [`+${extra} más`] : [])].join(' · ')
}

/** Minúsculas sin acentos (para buscar) */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
