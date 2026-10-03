// Miniaturas de sprites del juego en la interfaz: se piden por lotes y se guardan en memoria
// (las PNG viven en la caché de la app). `null` = formato no soportado (miniatura genérica).
import type { SpriteKind } from '../../../shared/gfxSprites'
import { useEffect, useState } from 'react'
import { store } from '../store/appStore'

const cache = new Map<string, string | null>()
const waiting = new Set<string>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
const lists = new Map<string, Promise<string[]>>()

export const spriteStats = { batches: 0 }

function flush(): void {
  timer = null
  const gamePath = store.get().gamePath
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const names = [...waiting].slice(0, 40)
  names.forEach((n) => waiting.delete(n))
  if (!names.length) return
  if (!gamePath || !api?.getSpriteThumbs) {
    for (const n of names) cache.set(n, null)
    listeners.forEach((l) => l())
  } else {
    spriteStats.batches++
    void api
      .getSpriteThumbs(gamePath, names)
      .catch(() => ({}) as Record<string, string | null>)
      .then((r) => {
        for (const n of names) cache.set(n, r[n] ?? null)
        listeners.forEach((l) => l())
      })
  }
  if (waiting.size) timer = setTimeout(flush, 10)
}

export function requestSprite(name: string): void {
  if (cache.has(name) || waiting.has(name)) return
  waiting.add(name)
  if (!timer) timer = setTimeout(flush, 20)
}

/** Miniatura de un sprite: undefined = cargando, null = genérica, string = imagen */
export function useSpriteThumb(name: string | null): string | null | undefined {
  const [, force] = useState(0)
  useEffect(() => {
    if (!name) return
    const l = (): void => force((n) => n + 1)
    listeners.add(l)
    requestSprite(name)
    return () => void listeners.delete(l)
  }, [name])
  return name ? cache.get(name) : null
}

/** Sprites que existen en el juego (con prefijo); se piden una sola vez por carpeta y tipo */
export function loadSprites(gamePath: string | null, kind: SpriteKind): Promise<string[]> {
  if (!gamePath || typeof window === 'undefined' || !window.electronAPI?.listGameSprites)
    return Promise.resolve([])
  const key = `${gamePath}|${kind}`
  let p = lists.get(key)
  if (!p) {
    p = window.electronAPI.listGameSprites(gamePath, kind).catch(() => [] as string[])
    lists.set(key, p)
    void window.electronAPI.prewarmSprites?.(gamePath, kind)
  }
  return p
}
