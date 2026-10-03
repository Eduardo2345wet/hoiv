// Sprites del juego (GFX_idea_* y GFX_goal_*) y sus miniaturas. Las imágenes se leen de la
// instalación del usuario; las miniaturas PNG viven SOLO en la caché (userData). No se copia ni se
// guarda nada del juego en el proyecto ni en el mod.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { parseGfxSprites, isPickable, type GfxSprite, type SpriteKind } from '../shared/gfxSprites'
import { decodeDds, thumbnail } from '../shared/dds'
import { encodePng } from './pngEncode'

export const THUMB_H = 64

interface Index {
  roots: string[]
  sprites: Map<string, GfxSprite>
}
const indexes = new Map<string, Index>()

function walk(dir: string, ext: string, out: string[] = []): string[] {
  try {
    for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, it.name)
      if (it.isDirectory()) walk(full, ext, out)
      else if (it.name.toLowerCase().endsWith(ext)) out.push(full)
    }
  } catch {
    // carpeta inexistente
  }
  return out
}

/** Carpetas donde buscar: el juego y cada DLC */
function rootsOf(gamePath: string): string[] {
  const roots = [gamePath]
  try {
    for (const d of fs.readdirSync(path.join(gamePath, 'dlc'), { withFileTypes: true }))
      if (d.isDirectory()) roots.push(path.join(gamePath, 'dlc', d.name))
  } catch {
    // sin DLC
  }
  return roots
}

export function spriteIndex(gamePath: string): Index {
  const hit = indexes.get(gamePath)
  if (hit) return hit
  const roots = rootsOf(gamePath)
  const sprites = new Map<string, GfxSprite>()
  for (const r of roots)
    for (const f of walk(path.join(r, 'interface'), '.gfx')) {
      let text = ''
      try {
        text = fs.readFileSync(f, 'utf-8')
      } catch {
        continue
      }
      for (const s of parseGfxSprites(text))
        if (!sprites.has(s.name)) sprites.set(s.name, { ...s, texture: s.texture })
    }
  const idx = { roots, sprites }
  indexes.set(gamePath, idx)
  return idx
}

/** Tamaño real de la textura de un sprite (cabecera del .dds), o null */
export function textureSize(gamePath: string, kind: SpriteKind): { w: number; h: number } | null {
  const idx = spriteIndex(gamePath)
  for (const name of listSprites(gamePath, kind)) {
    const sp = idx.sprites.get(name)
    if (!sp) continue
    for (const r of idx.roots) {
      const file = path.join(r, ...sp.texture.split('/'))
      try {
        const fd = fs.openSync(file, 'r')
        const buf = Buffer.alloc(32)
        fs.readSync(fd, buf, 0, 32, 0)
        fs.closeSync(fd)
        if (buf.readUInt32LE(0) === 0x20534444) {
          const h = buf.readUInt32LE(12)
          const w = buf.readUInt32LE(16)
          if (w > 0 && h > 0) return { w: Math.round(w / Math.max(1, sp.frames)), h }
        }
      } catch {
        // textura ausente
      }
    }
  }
  return null
}

export const forgetSpriteIndex = (gamePath: string): void => void indexes.delete(gamePath)

/** Nombres (con prefijo GFX_) de los sprites que se ofrecen como ícono, ordenados */
export function listSprites(gamePath: string, kind: SpriteKind): string[] {
  return [...spriteIndex(gamePath).sprites.keys()].filter((n) => isPickable(n, kind)).sort()
}

const dirFor = (cacheDir: string, gamePath: string): string =>
  path.join(
    cacheDir,
    'sprites',
    crypto.createHash('sha1').update(gamePath).digest('hex').slice(0, 10)
  )
const safe = (name: string): string => name.replace(/[^A-Za-z0-9_.-]/g, '_')

/** Miniatura de un sprite: data URL, o null si el formato no se puede leer (miniatura genérica) */
export function spriteThumb(gamePath: string, cacheDir: string, name: string): string | null {
  const dir = dirFor(cacheDir, gamePath)
  const png = path.join(dir, `${safe(name)}.png`)
  const none = path.join(dir, `${safe(name)}.none`)
  try {
    return `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`
  } catch {
    // aún sin generar
  }
  if (fs.existsSync(none)) return null
  const idx = spriteIndex(gamePath)
  const sp = idx.sprites.get(name)
  let result: Buffer | null = null
  if (sp) {
    for (const r of idx.roots) {
      const file = path.join(r, ...sp.texture.split('/'))
      if (!fs.existsSync(file) || !/\.dds$/i.test(file)) continue
      try {
        const dds = decodeDds(new Uint8Array(fs.readFileSync(file)))
        if (dds.ok) {
          const t = thumbnail(dds.image, THUMB_H, sp.frames)
          result = encodePng(t.rgba, t.width, t.height)
        }
      } catch {
        // textura ilegible: miniatura genérica
      }
      break
    }
  }
  try {
    fs.mkdirSync(dir, { recursive: true })
    if (result) fs.writeFileSync(png, result)
    else fs.writeFileSync(none, '')
  } catch {
    // sin espacio: se devuelve igual
  }
  return result ? `data:image/png;base64,${result.toString('base64')}` : null
}

/** Miniaturas de un lote de nombres */
export function spriteThumbs(
  gamePath: string,
  cacheDir: string,
  names: string[]
): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const n of names.slice(0, 80)) out[n] = spriteThumb(gamePath, cacheDir, n)
  return out
}

// Generación en segundo plano: por lotes pequeños, cediendo el control entre lote y lote para no
// congelar la aplicación.
const jobs = new Map<string, { done: number; total: number; running: boolean }>()
export function prewarm(
  gamePath: string,
  cacheDir: string,
  kind: SpriteKind
): { done: number; total: number } {
  const key = `${gamePath}|${kind}`
  const cur = jobs.get(key)
  if (cur?.running) return cur
  const names = listSprites(gamePath, kind)
  const job = { done: 0, total: names.length, running: true }
  jobs.set(key, job)
  const step = (): void => {
    const end = Math.min(names.length, job.done + 8)
    for (; job.done < end; job.done++) spriteThumb(gamePath, cacheDir, names[job.done])
    if (job.done < names.length) setTimeout(step, 4)
    else job.running = false
  }
  setTimeout(step, 0)
  return job
}
