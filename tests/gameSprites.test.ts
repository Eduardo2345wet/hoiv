import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseGfxSprites, isPickable } from '../src/shared/gfxSprites'
import { listSprites, spriteThumb, spriteThumbs, forgetSpriteIndex } from '../src/main/gameSprites'
import { encodePng } from '../src/main/pngEncode'

const cc = (s: string): number =>
  s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24)
function dds(w: number, h: number, fourcc: number, payload: number[]): Buffer {
  const b = Buffer.alloc(128)
  b.writeUInt32LE(0x20534444, 0)
  b.writeUInt32LE(h, 12)
  b.writeUInt32LE(w, 16)
  b.writeUInt32LE(4, 80)
  b.writeUInt32LE(fourcc, 84)
  return Buffer.concat([b, Buffer.from(payload)])
}
const red = [0, 0xf8, 0x1f, 0, 0, 0, 0, 0] // DXT1: c0 rojo, c1 azul, todo índice 0

describe('sprites del juego', () => {
  it('lee spriteType con noOfFrames y filtra los sprites ofrecibles', () => {
    const s = parseGfxSprites(`spriteTypes = {
  spriteType = { name = "GFX_idea_uno" texturefile = "gfx/interface/ideas/uno.dds" } # c
  spriteType = { name = "GFX_goal_a" texturefile = "gfx/interface/goals/a.dds" noOfFrames = 2 }
  spriteType = { name = "GFX_goal_a_shine" texturefile = "gfx/interface/goals/s.dds" }
}`)
    expect(s.map((x) => [x.name, x.frames])).toEqual([
      ['GFX_idea_uno', 1],
      ['GFX_goal_a', 2],
      ['GFX_goal_a_shine', 1]
    ])
    expect(isPickable('GFX_goal_a_shine', 'goal')).toBe(false)
    expect(isPickable('GFX_idea_uno', 'idea')).toBe(true)
    expect(isPickable('GFX_idea_uno', 'goal')).toBe(false)
  })

  it('genera la miniatura en la caché, no toca el juego y marca los formatos no soportados', () => {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-spr-'))
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-cache-'))
    fs.mkdirSync(path.join(game, 'interface'), { recursive: true })
    fs.mkdirSync(path.join(game, 'gfx/interface/ideas'), { recursive: true })
    fs.writeFileSync(
      path.join(game, 'interface/ideas.gfx'),
      `spriteTypes = {
 spriteType = { name = "GFX_idea_rojo" texturefile = "gfx/interface/ideas/rojo.dds" }
 spriteType = { name = "GFX_idea_raro" texturefile = "gfx/interface/ideas/raro.dds" }
 spriteType = { name = "GFX_idea_falta" texturefile = "gfx/interface/ideas/falta.dds" }
}`
    )
    fs.writeFileSync(path.join(game, 'gfx/interface/ideas/rojo.dds'), dds(4, 4, cc('DXT1'), red))
    fs.writeFileSync(path.join(game, 'gfx/interface/ideas/raro.dds'), dds(4, 4, cc('ATI2'), red))
    const snap = (): string => fs.readdirSync(game, { recursive: true }).join('|')
    const before = snap()
    forgetSpriteIndex(game)
    expect(listSprites(game, 'idea')).toEqual(['GFX_idea_falta', 'GFX_idea_raro', 'GFX_idea_rojo'])
    const t = spriteThumb(game, cache, 'GFX_idea_rojo')!
    expect(t.startsWith('data:image/png;base64,')).toBe(true)
    const png = Buffer.from(t.split(',')[1], 'base64')
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(4) // ancho
    expect(spriteThumb(game, cache, 'GFX_idea_raro')).toBeNull() // formato no soportado
    expect(spriteThumb(game, cache, 'GFX_idea_falta')).toBeNull() // textura ausente
    // segunda vez: sale de la caché
    expect(spriteThumb(game, cache, 'GFX_idea_rojo')).toBe(t)
    expect(Object.keys(spriteThumbs(game, cache, ['GFX_idea_rojo', 'GFX_idea_raro']))).toHaveLength(
      2
    )
    expect(snap()).toBe(before) // nada se escribió en la carpeta del juego
    expect(fs.readdirSync(cache, { recursive: true }).some((f) => String(f).endsWith('.png'))).toBe(
      true
    )
  })

  it('el PNG que se escribe es válido (cabecera, IDAT e IEND)', () => {
    const p = encodePng(new Uint8Array([255, 0, 0, 255]), 1, 1)
    expect(p.subarray(12, 16).toString()).toBe('IHDR')
    expect(p.subarray(-8, -4).toString()).toBe('IEND')
  })
})
