// Escritores de imágenes para el juego, en TypeScript puro (sin librerías nativas).
// Reutilizable para íconos, banderas (TGA) y retratos de líderes.
// Entrada: píxeles RGBA de arriba hacia abajo (como los da canvas.getImageData).

/** DDS sin comprimir, 32 bits BGRA (lo que lee HOI4 para íconos) */
export function writeDDS(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray
): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('Tamaño de píxeles incorrecto')
  const out = new Uint8Array(128 + width * height * 4)
  const v = new DataView(out.buffer)
  // "DDS "
  out.set([0x44, 0x44, 0x53, 0x20], 0)
  const le = (off: number, val: number): void => v.setUint32(off, val >>> 0, true)
  le(4, 124) // tamaño de la cabecera
  le(8, 0x100f) // CAPS | HEIGHT | WIDTH | PITCH | PIXELFORMAT
  le(12, height)
  le(16, width)
  le(20, width * 4) // pitch
  le(24, 0) // depth
  le(28, 0) // mipmaps
  // 11 DWORD reservados (32..75) quedan en 0
  // Pixel format (76..107)
  le(76, 32) // tamaño
  le(80, 0x41) // RGB | ALPHAPIXELS
  le(84, 0) // fourCC
  le(88, 32) // bits por píxel
  le(92, 0x00ff0000) // R
  le(96, 0x0000ff00) // G
  le(100, 0x000000ff) // B
  le(104, 0xff000000) // A
  le(108, 0x1000) // caps: TEXTURE
  // caps2..4 y reservado (112..127) en 0
  for (let i = 0, o = 128; i < rgba.length; i += 4, o += 4) {
    out[o] = rgba[i + 2] // B
    out[o + 1] = rgba[i + 1] // G
    out[o + 2] = rgba[i] // R
    out[o + 3] = rgba[i + 3] // A
  }
  return out
}

/**
 * TGA de 32 bits SIN compresión (banderas), igual que las del juego base:
 * cabecera de 18 bytes, descriptor 0x08 (8 bits de alfa, origen abajo-izquierda)
 * y las filas guardadas de ABAJO hacia ARRIBA (así no salen de cabeza aunque el
 * juego ignore el bit de origen).
 */
export function writeTGA(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray
): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('Tamaño de píxeles incorrecto')
  const out = new Uint8Array(18 + width * height * 4)
  out[0] = 0 // idLength
  out[1] = 0 // colorMapType
  out[2] = 2 // imageType: color verdadero sin comprimir
  // 3..7: especificación del mapa de color en 0; 8..11: origen X/Y en 0
  out[12] = width & 0xff
  out[13] = (width >> 8) & 0xff
  out[14] = height & 0xff
  out[15] = (height >> 8) & 0xff
  out[16] = 32 // bits por píxel
  out[17] = 0x08 // 8 bits de alfa, origen abajo-izquierda
  let o = 18
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      out[o++] = rgba[i + 2] // B
      out[o++] = rgba[i + 1] // G
      out[o++] = rgba[i] // R
      out[o++] = rgba[i + 3] // A
    }
  }
  return out
}
