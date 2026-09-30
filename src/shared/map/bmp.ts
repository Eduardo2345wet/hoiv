// Lector propio de provinces.bmp: BITMAPINFOHEADER, 24 bits, sin compresión.
// Devuelve los píxeles RGB con las filas de ARRIBA hacia ABAJO.

export interface Bmp24 {
  width: number
  height: number
  /** RGB, 3 bytes por píxel, fila 0 = arriba */
  rgb: Uint8Array
}

export function parseBmp24(data: Uint8Array): Bmp24 {
  const fail = (msg: string): never => {
    throw new Error(`provinces.bmp no tiene el formato esperado: ${msg}`)
  }
  if (data.length < 54) fail('el archivo es demasiado corto')
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (data[0] !== 0x42 || data[1] !== 0x4d) fail('no empieza con "BM"')
  const pixelOffset = v.getUint32(10, true)
  const headerSize = v.getUint32(14, true)
  if (headerSize < 40)
    fail(`cabecera de ${headerSize} bytes (se esperaba BITMAPINFOHEADER de 40 o más)`)
  const width = v.getInt32(18, true)
  const rawHeight = v.getInt32(22, true)
  const planes = v.getUint16(26, true)
  const bpp = v.getUint16(28, true)
  const compression = v.getUint32(30, true)
  if (planes !== 1) fail(`planes = ${planes}`)
  if (bpp !== 24) fail(`tiene ${bpp} bits por píxel (se esperaban 24)`)
  if (compression !== 0)
    fail(`está comprimido (compresión ${compression}); se esperaba sin compresión`)
  if (width <= 0 || rawHeight === 0) fail('tamaño inválido')
  const height = Math.abs(rawHeight)
  // Altura positiva = filas de abajo hacia arriba
  const bottomUp = rawHeight > 0
  // Cada fila se rellena hasta múltiplo de 4 bytes
  const rowSize = Math.ceil((width * 3) / 4) * 4
  if (pixelOffset + rowSize * height > data.length) fail('faltan datos de píxeles')

  const rgb = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const srcRow = pixelOffset + (bottomUp ? height - 1 - y : y) * rowSize
    const dstRow = y * width * 3
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 3
      const d = dstRow + x * 3
      // En el archivo van en BGR
      rgb[d] = data[s + 2]
      rgb[d + 1] = data[s + 1]
      rgb[d + 2] = data[s]
    }
  }
  return { width, height, rgb }
}

/** Escribe un BMP de 24 bits de abajo hacia arriba (para pruebas) */
export function writeBmp24(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const out = new Uint8Array(54 + rowSize * height)
  const v = new DataView(out.buffer)
  out[0] = 0x42
  out[1] = 0x4d
  v.setUint32(2, out.length, true)
  v.setUint32(10, 54, true)
  v.setUint32(14, 40, true)
  v.setInt32(18, width, true)
  v.setInt32(22, height, true)
  v.setUint16(26, 1, true)
  v.setUint16(28, 24, true)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3
      out[row + x * 3] = rgb[s + 2]
      out[row + x * 3 + 1] = rgb[s + 1]
      out[row + x * 3 + 2] = rgb[s]
    }
  }
  return out
}
