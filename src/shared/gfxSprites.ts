// Sprites de interface/*.gfx: nombre, textura y cuadros (noOfFrames). Solo lectura de texto.
import { tokenizePdx } from './countryHistory'

export interface GfxSprite {
  name: string
  /** Ruta de la textura relativa a la carpeta del juego (con "/") */
  texture: string
  frames: number
}

const unquote = (v: string): string => (v.startsWith('"') ? v.replace(/^"|"$/g, '') : v)

/**
 * Los bloques `spriteType = { … }` de un .gfx. Lector TOLERANTE (el mismo de las historias): acepta
 * rutas con o sin comillas, la llave pegada al valor (`noOfFrames = 2}`), tabuladores, BOM, claves en
 * cualquier mayúscula y comentarios. Solo se leen las claves de primer nivel de cada bloque.
 */
export function parseGfxSprites(text: string): GfxSprite[] {
  const t = tokenizePdx(text)
  const out: GfxSprite[] = []
  for (let i = 0; i + 2 < t.length; i++) {
    if (t[i].v.toLowerCase() !== 'spritetype' || t[i + 1].v !== '=' || t[i + 2].v !== '{') continue
    const depth = t[i + 2].depth
    let name: string | undefined
    let tex: string | undefined
    let frames = 1
    let j = i + 3
    for (; j < t.length && !(t[j].v === '}' && t[j].depth === depth); j++) {
      if (t[j].depth !== depth + 1 || t[j + 1]?.v !== '=' || !t[j + 2]) continue
      const key = t[j].v.toLowerCase()
      const val = t[j + 2].v
      if (val === '{' || val === '}') continue
      if (key === 'name') name = unquote(val)
      else if (key === 'texturefile') tex = unquote(val)
      else if (key === 'noofframes') frames = Number(unquote(val)) || 1
    }
    i = j
    if (!name || !tex) continue
    out.push({
      name,
      texture: tex
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\//, ''),
      frames
    })
  }
  return out
}

/** Sprite de espíritu nacional (GFX_idea_<picture>) */
export const IDEA_PREFIX = 'GFX_idea_'
/** Sprite de ícono de foco (GFX_goal_<nombre>) */
export const GOAL_PREFIX = 'GFX_goal_'
/** Imagen de evento (GFX_report_event_<nombre>) */
export const EVENT_PREFIX = 'GFX_report_event_'
export const DECISION_PREFIX = 'GFX_decision_'
export const DECISION_CATEGORY_PREFIX = 'GFX_decision_category_'
export type SpriteKind = 'idea' | 'goal' | 'event' | 'decision' | 'decisionCategory'
export const prefixOf = (k: SpriteKind): string =>
  k === 'idea'
    ? IDEA_PREFIX
    : k === 'goal'
      ? GOAL_PREFIX
      : k === 'event'
        ? EVENT_PREFIX
        : k === 'decision'
          ? DECISION_PREFIX
          : DECISION_CATEGORY_PREFIX

/** ¿Es un sprite que se ofrece como ícono? (se descartan variantes de brillo y fondos) */
export function isPickable(name: string, kind: SpriteKind): boolean {
  if (!name.startsWith(prefixOf(kind))) return false
  if (kind === 'decision' && name.startsWith(DECISION_CATEGORY_PREFIX)) return false
  return !/_(shine|bg|frame|locked|disabled)$/i.test(name)
}
