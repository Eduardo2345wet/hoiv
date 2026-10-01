// Lector de TGA propio (sin módulos nativos): color verdadero sin comprimir (tipo 2) y con
// RLE (tipo 10), de 24 y 32 bits. Respeta el bit de origen del descriptor (0x20 = las filas van
// de ARRIBA hacia abajo; si no, de abajo hacia arriba) y el de derecha a izquierda (0x10).
// Devuelve siempre RGBA con la fila 0 arriba.
export interface TgaImage {
  width: number
  height: number
  /** RGBA, fila 0 arriba */
  rgba: Uint8Array
}

export function readTga(bytes: Uint8Array): TgaImage {
  if (bytes.length < 18) throw new Error('TGA: archivo demasiado corto')
  const idLen = bytes[0]
  const cmapType = bytes[1]
  const type = bytes[2]
  const cmapLen = bytes[5] | (bytes[6] << 8)
  const cmapBits = bytes[7]
  const width = bytes[12] | (bytes[13] << 8)
  const height = bytes[14] | (bytes[15] << 8)
  const bpp = bytes[16]
  const desc = bytes[17]
  if (type !== 2 && type !== 10) throw new Error(`TGA: tipo ${type} no soportado (solo 2 y 10)`)
  if (bpp !== 24 && bpp !== 32) throw new Error(`TGA: ${bpp} bits no soportados (solo 24 y 32)`)
  if (width <= 0 || height <= 0) throw new Error('TGA: tamaño inválido')
  const px = bpp / 8
  const total = width * height
  let pos = 18 + idLen + (cmapType === 1 ? cmapLen * Math.ceil(cmapBits / 8) : 0)

  // 1. Píxeles en el orden del archivo (BGR[A] → RGBA)
  const raw = new Uint8Array(total * 4)
  const put = (i: number, src: number): void => {
    raw[i * 4] = bytes[src + 2]
    raw[i * 4 + 1] = bytes[src + 1]
    raw[i * 4 + 2] = bytes[src]
    raw[i * 4 + 3] = px === 4 ? bytes[src + 3] : 255
  }
  if (type === 2) {
    if (pos + total * px > bytes.length) throw new Error('TGA: datos incompletos')
    for (let i = 0; i < total; i++) put(i, pos + i * px)
  } else {
    let i = 0
    while (i < total) {
      if (pos >= bytes.length) throw new Error('TGA: datos RLE incompletos')
      const h = bytes[pos++]
      const n = (h & 0x7f) + 1
      if (i + n > total) throw new Error('TGA: paquete RLE fuera de rango')
      if (h & 0x80) {
        // Paquete repetido: un píxel n veces
        if (pos + px > bytes.length) throw new Error('TGA: datos RLE incompletos')
        for (let k = 0; k < n; k++) put(i + k, pos)
        pos += px
      } else {
        if (pos + n * px > bytes.length) throw new Error('TGA: datos RLE incompletos')
        for (let k = 0; k < n; k++) put(i + k, pos + k * px)
        pos += n * px
      }
      i += n
    }
  }

  // 2. Orientación: 0x20 = origen arriba (filas de arriba a abajo); si no, de abajo a arriba
  const topDown = (desc & 0x20) !== 0
  const rightToLeft = (desc & 0x10) !== 0
  if (topDown && !rightToLeft) return { width, height, rgba: raw }
  const out = new Uint8Array(total * 4)
  for (let y = 0; y < height; y++) {
    const sy = topDown ? y : height - 1 - y
    for (let x = 0; x < width; x++) {
      const sx = rightToLeft ? width - 1 - x : x
      out.set(raw.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * width + x) * 4)
    }
  }
  return { width, height, rgba: out }
}
