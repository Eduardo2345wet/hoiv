// Sprites de interface/*.gfx: nombre, textura y cuadros (noOfFrames). Solo lectura de texto.

export interface GfxSprite {
  name: string
  /** Ruta de la textura relativa a la carpeta del juego (con "/") */
  texture: string
  frames: number
}

/** Los bloques `spriteType = { … }` de un .gfx (lectura simple por llaves; ignora comentarios) */
export function parseGfxSprites(text: string): GfxSprite[] {
  const clean = text.replace(/^﻿/, '').replace(/#[^\n]*/g, '')
  const out: GfxSprite[] = []
  const re = /\bspriteType\s*=\s*\{/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    let i = m.index + m[0].length
    let depth = 1
    const start = i
    for (; i < clean.length && depth > 0; i++) {
      if (clean[i] === '{') depth++
      else if (clean[i] === '}') depth--
    }
    const body = clean.slice(start, i - 1)
    const name = /\bname\s*=\s*"?([A-Za-z0-9_.\-]+)"?/i.exec(body)?.[1]
    const tex = /\btexturefile\s*=\s*"([^"]+)"/i.exec(body)?.[1]
    if (!name || !tex) continue
    const frames = Number(/\bnoOfFrames\s*=\s*(\d+)/i.exec(body)?.[1] ?? 1) || 1
    out.push({ name, texture: tex.replace(/\\/g, '/'), frames })
    re.lastIndex = i
  }
  return out
}

/** Sprite de espíritu nacional (GFX_idea_<picture>) */
export const IDEA_PREFIX = 'GFX_idea_'
/** Sprite de ícono de foco (GFX_goal_<nombre>) */
export const GOAL_PREFIX = 'GFX_goal_'
export type SpriteKind = 'idea' | 'goal'
export const prefixOf = (k: SpriteKind): string => (k === 'idea' ? IDEA_PREFIX : GOAL_PREFIX)

/** ¿Es un sprite que se ofrece como ícono? (se descartan variantes de brillo y fondos) */
export function isPickable(name: string, kind: SpriteKind): boolean {
  if (!name.startsWith(prefixOf(kind))) return false
  return !/_(shine|bg|frame|locked|disabled)$/i.test(name)
}
