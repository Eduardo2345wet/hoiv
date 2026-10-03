// Decodificador DDS: imágenes mínimas creadas aquí (fixtures) con los píxeles esperados.
import { describe, expect, it } from 'vitest'
import { decodeDds, thumbnail } from '../src/shared/dds'

const cc = (s: string): number =>
  s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24)

function header(
  w: number,
  h: number,
  pf: {
    flags: number
    fourcc?: number
    bits?: number
    r?: number
    g?: number
    b?: number
    a?: number
  },
  dx10?: number
): Uint8Array {
  const buf = new Uint8Array(128 + (dx10 !== undefined ? 20 : 0))
  const dv = new DataView(buf.buffer)
  dv.setUint32(0, 0x20534444, true)
  dv.setUint32(4, 124, true)
  dv.setUint32(12, h, true)
  dv.setUint32(16, w, true)
  dv.setUint32(76, 32, true)
  dv.setUint32(80, pf.flags, true)
  dv.setUint32(84, pf.fourcc ?? 0, true)
  dv.setUint32(88, pf.bits ?? 0, true)
  dv.setUint32(92, pf.r ?? 0, true)
  dv.setUint32(96, pf.g ?? 0, true)
  dv.setUint32(100, pf.b ?? 0, true)
  dv.setUint32(104, pf.a ?? 0, true)
  if (dx10 !== undefined) dv.setUint32(128, dx10, true)
  return buf
}
const cat = (...parts: number[][] | Uint8Array[]): Uint8Array => {
  const arr = (parts as ArrayLike<number>[]).flatMap((p) => [...p])
  return new Uint8Array(arr)
}
const px = (img: { width: number; rgba: Uint8Array }, x: number, y: number): number[] => [
  ...img.rgba.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)
]

// Bloque de color: rojo (0xF800) y azul (0x001F); índices por fila: 0 1 2 3 en cada fila
const COLOR = (c0: number, c1: number): number[] => {
  const row = 0b11100100 // píxeles 0..3 con índices 0, 1, 2, 3
  return [c0 & 255, c0 >> 8, c1 & 255, c1 >> 8, row, row, row, row]
}

describe('decodificador DDS (S: íconos del juego)', () => {
  it('DXT1: cuatro colores del bloque (rojo, azul y sus mezclas)', () => {
    const dds = cat(header(4, 4, { flags: 0x4, fourcc: cc('DXT1') }), COLOR(0xf800, 0x001f))
    const r = decodeDds(dds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(px(r.image, 0, 0)).toEqual([255, 0, 0, 255])
    expect(px(r.image, 1, 0)).toEqual([0, 0, 255, 255])
    expect(px(r.image, 2, 3)).toEqual([170, 0, 85, 255])
    expect(px(r.image, 3, 2)).toEqual([85, 0, 170, 255])
  })

  it('DXT1 con transparencia: índice 3 es transparente cuando c0 <= c1', () => {
    const dds = cat(header(4, 4, { flags: 0x4, fourcc: cc('DXT1') }), COLOR(0x001f, 0xf800))
    const r = decodeDds(dds)
    if (!r.ok) throw new Error(r.unsupported)
    expect(px(r.image, 2, 0)).toEqual([127, 0, 127, 255]) // mezcla al 50 %
    expect(px(r.image, 3, 0)[3]).toBe(0)
  })

  it('DXT3: alfa de 4 bits por píxel', () => {
    const alpha = [0x8f, 0, 0, 0, 0, 0, 0, 0] // píxel 0 = 0xF → 255, píxel 1 = 0x8 → 136
    const dds = cat(header(4, 4, { flags: 0x4, fourcc: cc('DXT3') }), alpha, COLOR(0xf800, 0x001f))
    const r = decodeDds(dds)
    if (!r.ok) throw new Error(r.unsupported)
    expect(px(r.image, 0, 0)).toEqual([255, 0, 0, 255])
    expect(px(r.image, 1, 0)).toEqual([0, 0, 255, 136])
    expect(px(r.image, 2, 0)[3]).toBe(0)
  })

  it('DXT5: alfa interpolado entre a0 y a1', () => {
    const idx = 0 | (1 << 3) | (2 << 6) | (3 << 9)
    const alpha = [255, 0, idx & 255, (idx >> 8) & 255, (idx >> 16) & 255, 0, 0, 0]
    const dds = cat(header(4, 4, { flags: 0x4, fourcc: cc('DXT5') }), alpha, COLOR(0xf800, 0x001f))
    const r = decodeDds(dds)
    if (!r.ok) throw new Error(r.unsupported)
    expect(px(r.image, 0, 0)[3]).toBe(255)
    expect(px(r.image, 1, 0)[3]).toBe(0)
    expect(px(r.image, 2, 0)[3]).toBe(218)
    expect(px(r.image, 3, 0)[3]).toBe(182)
  })

  it('sin comprimir: A8R8G8B8, X8R8G8B8 y R8G8B8', () => {
    const argb = cat(
      header(2, 1, { flags: 0x41, bits: 32, r: 0xff0000, g: 0xff00, b: 0xff, a: 0xff000000 }),
      [30, 20, 10, 40, 1, 2, 3, 255]
    )
    const a = decodeDds(argb)
    if (!a.ok) throw new Error(a.unsupported)
    expect(px(a.image, 0, 0)).toEqual([10, 20, 30, 40])
    expect(px(a.image, 1, 0)).toEqual([3, 2, 1, 255])
    const xrgb = cat(
      header(1, 1, { flags: 0x40, bits: 32, r: 0xff0000, g: 0xff00, b: 0xff }),
      [30, 20, 10, 7]
    )
    const x = decodeDds(xrgb)
    if (!x.ok) throw new Error(x.unsupported)
    expect(px(x.image, 0, 0)).toEqual([10, 20, 30, 255])
    const rgb24 = cat(
      header(1, 2, { flags: 0x40, bits: 24, r: 0xff0000, g: 0xff00, b: 0xff }),
      [30, 20, 10, 60, 50, 40]
    )
    const t = decodeDds(rgb24)
    if (!t.ok) throw new Error(t.unsupported)
    expect(px(t.image, 0, 0)).toEqual([10, 20, 30, 255])
    expect(px(t.image, 0, 1)).toEqual([40, 50, 60, 255])
  })

  it('un formato no soportado (BC7, ATI2) o un archivo roto da "unsupported" sin lanzar errores', () => {
    const bc7 = decodeDds(
      cat(header(4, 4, { flags: 0x4, fourcc: cc('DX10') }, 98), new Array(16).fill(0))
    )
    expect(bc7).toMatchObject({ ok: false })
    expect((bc7 as { unsupported: string }).unsupported).toMatch(/BC7/)
    expect(
      decodeDds(cat(header(4, 4, { flags: 0x4, fourcc: cc('ATI2') }), new Array(16).fill(0)))
    ).toMatchObject({ ok: false })
    expect(decodeDds(new Uint8Array(10))).toMatchObject({ ok: false })
    expect(decodeDds(new Uint8Array(200))).toMatchObject({ ok: false })
    // DXT1 con datos incompletos
    expect(decodeDds(cat(header(8, 8, { flags: 0x4, fourcc: cc('DXT1') }), [0, 0]))).toMatchObject({
      ok: false
    })
  })

  it('BC1/BC3 con cabecera DX10 también se leen', () => {
    const dds = cat(header(4, 4, { flags: 0x4, fourcc: cc('DX10') }, 71), COLOR(0xf800, 0x001f))
    const r = decodeDds(dds)
    if (!r.ok) throw new Error(r.unsupported)
    expect(px(r.image, 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('la miniatura toma el primer cuadro de una hoja y reduce el alto', () => {
    // 4×2 con 2 cuadros: izquierda rojo, derecha verde
    const rgba = new Uint8Array(4 * 2 * 4)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 4; x++)
        rgba.set(x < 2 ? [255, 0, 0, 255] : [0, 255, 0, 255], (y * 4 + x) * 4)
    const t = thumbnail({ width: 4, height: 2, rgba }, 1, 2)
    expect(t.width).toBe(1)
    expect(t.height).toBe(1)
    expect([...t.rgba]).toEqual([255, 0, 0, 255])
    // sin reducir cuando ya cabe
    const same = thumbnail({ width: 4, height: 2, rgba }, 64, 1)
    expect([same.width, same.height]).toEqual([4, 2])
  })
})
