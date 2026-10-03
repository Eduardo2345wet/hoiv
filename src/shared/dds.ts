// Decodificador de DDS en JavaScript puro (sin módulos nativos): solo lee el primer nivel de
// imagen y lo convierte a RGBA de 8 bits. Formatos: DXT1, DXT3, DXT5 y sin comprimir (con máscaras
// de color: A8R8G8B8, X8R8G8B8, R8G8B8…). Un formato no soportado (por ejemplo BC7) devuelve
// `unsupported` con el motivo, para mostrar una miniatura genérica sin romper nada.

export interface DdsImage {
  width: number
  height: number
  /** RGBA (4 bytes por píxel), filas de arriba hacia abajo */
  rgba: Uint8Array
}
export type DdsResult = { ok: true; image: DdsImage } | { ok: false; unsupported: string }

const MAGIC = 0x20534444 // "DDS "
const DDPF_ALPHAPIXELS = 0x1
const DDPF_ALPHA = 0x2
const DDPF_FOURCC = 0x4
const DDPF_RGB = 0x40
const DDPF_LUMINANCE = 0x20000

const fourCC = (s: string): number =>
  s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24)
const DXT1 = fourCC('DXT1')
const DXT3 = fourCC('DXT3')
const DXT5 = fourCC('DXT5')
const DX10 = fourCC('DX10')

/** 565 → [r, g, b] de 8 bits */
function rgb565(c: number, out: number[], o: number): void {
  const r = (c >> 11) & 31
  const g = (c >> 5) & 63
  const b = c & 31
  out[o] = (r << 3) | (r >> 2)
  out[o + 1] = (g << 2) | (g >> 4)
  out[o + 2] = (b << 3) | (b >> 2)
}

/** Bloque de color de DXT1 (BC1): 4 colores; `opaque` = DXT3/DXT5 (nunca usan el modo con transparencia) */
function colorBlock(src: Uint8Array, off: number, opaque: boolean): number[] {
  const c0 = src[off] | (src[off + 1] << 8)
  const c1 = src[off + 2] | (src[off + 3] << 8)
  const pal: number[] = new Array(16).fill(255)
  rgb565(c0, pal, 0)
  rgb565(c1, pal, 4)
  if (c0 > c1 || opaque) {
    for (let k = 0; k < 3; k++) {
      pal[8 + k] = Math.floor((2 * pal[k] + pal[4 + k]) / 3)
      pal[12 + k] = Math.floor((pal[k] + 2 * pal[4 + k]) / 3)
    }
  } else {
    for (let k = 0; k < 3; k++) {
      pal[8 + k] = Math.floor((pal[k] + pal[4 + k]) / 2)
      pal[12 + k] = 0
    }
    pal[15] = 0 // negro transparente
  }
  return pal
}

function decodeBlocks(
  src: Uint8Array,
  start: number,
  w: number,
  h: number,
  kind: 'dxt1' | 'dxt3' | 'dxt5'
): Uint8Array | null {
  const bw = Math.ceil(w / 4)
  const bh = Math.ceil(h / 4)
  const size = kind === 'dxt1' ? 8 : 16
  if (src.length < start + bw * bh * size) return null
  const out = new Uint8Array(w * h * 4)
  let p = start
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const colorOff = kind === 'dxt1' ? p : p + 8
      const pal = colorBlock(src, colorOff, kind !== 'dxt1')
      const bits =
        (src[colorOff + 4] |
          (src[colorOff + 5] << 8) |
          (src[colorOff + 6] << 16) |
          (src[colorOff + 7] << 24)) >>>
        0
      // Alfa de DXT3 (4 bits por píxel) y de DXT5 (2 valores y 6 interpolados)
      let alpha: number[] | null = null
      if (kind === 'dxt3') {
        alpha = []
        for (let i = 0; i < 16; i++) {
          const byte = src[p + (i >> 1)]
          const v = i & 1 ? byte >> 4 : byte & 15
          alpha.push(v * 17)
        }
      } else if (kind === 'dxt5') {
        const a0 = src[p]
        const a1 = src[p + 1]
        const tab: number[] = [a0, a1]
        if (a0 > a1) for (let k = 1; k <= 6; k++) tab.push(Math.floor(((7 - k) * a0 + k * a1) / 7))
        else {
          for (let k = 1; k <= 4; k++) tab.push(Math.floor(((5 - k) * a0 + k * a1) / 5))
          tab.push(0, 255)
        }
        // 48 bits de índices (3 por píxel)
        let lo = src[p + 2] | (src[p + 3] << 8) | (src[p + 4] << 16)
        let hi = src[p + 5] | (src[p + 6] << 8) | (src[p + 7] << 16)
        alpha = []
        for (let i = 0; i < 16; i++) {
          if (i < 8) {
            alpha.push(tab[lo & 7])
            lo >>= 3
          } else {
            alpha.push(tab[hi & 7])
            hi >>= 3
          }
        }
      }
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3)
        const y = by * 4 + (i >> 2)
        if (x >= w || y >= h) continue
        const idx = (bits >>> (2 * i)) & 3
        const o = (y * w + x) * 4
        out[o] = pal[idx * 4]
        out[o + 1] = pal[idx * 4 + 1]
        out[o + 2] = pal[idx * 4 + 2]
        out[o + 3] = alpha ? alpha[i] : pal[idx * 4 + 3]
      }
      p += size
    }
  return out
}

/** Sin comprimir con máscaras (16, 24 o 32 bits por píxel) */
function decodeMasked(
  src: Uint8Array,
  start: number,
  w: number,
  h: number,
  bits: number,
  masks: { r: number; g: number; b: number; a: number },
  hasAlpha: boolean
): Uint8Array | null {
  const bytes = bits / 8
  if (src.length < start + w * h * bytes) return null
  const chan = (mask: number): { shift: number; max: number } => {
    if (!mask) return { shift: 0, max: 0 }
    let shift = 0
    while (!((mask >>> shift) & 1)) shift++
    let len = 0
    while ((mask >>> (shift + len)) & 1) len++
    return { shift, max: len >= 32 ? 0xffffffff : (1 << len) - 1 }
  }
  const R = chan(masks.r)
  const G = chan(masks.g)
  const B = chan(masks.b)
  const A = chan(masks.a)
  const get = (v: number, c: { shift: number; max: number }, def: number): number =>
    c.max ? Math.round((((v >>> c.shift) & c.max) * 255) / c.max) : def
  const out = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    let v = 0
    for (let b = 0; b < bytes; b++) v |= src[start + i * bytes + b] << (8 * b)
    v >>>= 0
    out[i * 4] = get(v, R, 0)
    out[i * 4 + 1] = get(v, G, 0)
    out[i * 4 + 2] = get(v, B, 0)
    out[i * 4 + 3] = hasAlpha ? get(v, A, 255) : 255
  }
  return out
}

export function decodeDds(bytes: Uint8Array): DdsResult {
  if (bytes.length < 128) return { ok: false, unsupported: 'archivo demasiado corto' }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.getUint32(0, true) !== MAGIC) return { ok: false, unsupported: 'no es un DDS' }
  const height = dv.getUint32(12, true)
  const width = dv.getUint32(16, true)
  if (!width || !height || width > 8192 || height > 8192)
    return { ok: false, unsupported: 'tamaño no válido' }
  const flags = dv.getUint32(80, true)
  const cc = dv.getUint32(84, true)
  const bits = dv.getUint32(88, true)
  const masks = {
    r: dv.getUint32(92, true),
    g: dv.getUint32(96, true),
    b: dv.getUint32(100, true),
    a: dv.getUint32(104, true)
  }
  let start = 128
  const done = (rgba: Uint8Array | null): DdsResult =>
    rgba
      ? { ok: true, image: { width, height, rgba } }
      : { ok: false, unsupported: 'datos incompletos' }

  if (flags & DDPF_FOURCC) {
    if (cc === DXT1) return done(decodeBlocks(bytes, start, width, height, 'dxt1'))
    if (cc === DXT3) return done(decodeBlocks(bytes, start, width, height, 'dxt3'))
    if (cc === DXT5) return done(decodeBlocks(bytes, start, width, height, 'dxt5'))
    if (cc === DX10) {
      const dxgi = dv.getUint32(128, true)
      start = 148
      if (dxgi === 71 || dxgi === 72) return done(decodeBlocks(bytes, start, width, height, 'dxt1'))
      if (dxgi === 74 || dxgi === 75) return done(decodeBlocks(bytes, start, width, height, 'dxt3'))
      if (dxgi === 77 || dxgi === 78) return done(decodeBlocks(bytes, start, width, height, 'dxt5'))
      if (dxgi === 87 || dxgi === 88 || dxgi === 91)
        return done(
          decodeMasked(
            bytes,
            start,
            width,
            height,
            32,
            { r: 0xff0000, g: 0xff00, b: 0xff, a: 0xff000000 },
            dxgi !== 88
          )
        )
      if (dxgi === 28 || dxgi === 29)
        return done(
          decodeMasked(
            bytes,
            start,
            width,
            height,
            32,
            { r: 0xff, g: 0xff00, b: 0xff0000, a: 0xff000000 },
            true
          )
        )
      return { ok: false, unsupported: `formato DXGI ${dxgi} (por ejemplo BC7)` }
    }
    const name = String.fromCharCode(cc & 255, (cc >> 8) & 255, (cc >> 16) & 255, (cc >> 24) & 255)
    return { ok: false, unsupported: `formato ${name}` }
  }
  if (flags & DDPF_RGB && (bits === 16 || bits === 24 || bits === 32))
    return done(
      decodeMasked(bytes, start, width, height, bits, masks, !!(flags & DDPF_ALPHAPIXELS))
    )
  if (flags & DDPF_LUMINANCE && bits === 8) {
    if (bytes.length < start + width * height) return done(null)
    const out = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++)
      out.set([bytes[start + i], bytes[start + i], bytes[start + i], 255], i * 4)
    return done(out)
  }
  if (flags & DDPF_ALPHA && bits === 8) {
    if (bytes.length < start + width * height) return done(null)
    const out = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) out.set([255, 255, 255, bytes[start + i]], i * 4)
    return done(out)
  }
  return { ok: false, unsupported: 'formato de píxel no soportado' }
}

/**
 * Reduce una imagen RGBA a un alto máximo (promedio de cajas); `frames` > 1 = hoja con varios
 * cuadros en horizontal: se toma el primero.
 */
export function thumbnail(img: DdsImage, maxH: number, frames = 1): DdsImage {
  const fw = Math.max(1, Math.floor(img.width / Math.max(1, frames)))
  const fh = img.height
  const scale = Math.min(1, maxH / fh)
  const tw = Math.max(1, Math.round(fw * scale))
  const th = Math.max(1, Math.round(fh * scale))
  const out = new Uint8Array(tw * th * 4)
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor((y * fh) / th)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * fh) / th))
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor((x * fw) / tw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * fw) / tw))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * img.width + xx) * 4
          const al = img.rgba[o + 3]
          // Promedio ponderado por alfa para no ensuciar los bordes
          r += img.rgba[o] * al
          g += img.rgba[o + 1] * al
          b += img.rgba[o + 2] * al
          a += al
          n++
        }
      const o = (y * tw + x) * 4
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
      out[o + 3] = Math.round(a / n)
    }
  }
  return { width: tw, height: th, rgba: out }
}
