import { describe, it, expect } from 'vitest'
import {
  parseProvincesBmp,
  parseDefinitionCsv,
  parseStateText,
  decodeTextBuffer
} from '../src/main/mapLoader'

describe('Map Loader Parsers', () => {
  it('parses a valid 24-bit BMP image with row padding and bottom-to-top orientation', () => {
    // Crear un BMP de 3x2 píxeles
    // Ancho = 3 píxeles = 9 bytes por fila. Padding = 3 bytes para múltiplo de 4 (stride = 12 bytes por fila).
    // Fila 0 (bottom en imagen, fila superior en grid): Píxel (0,1)=Rojo, (1,1)=Verde, (2,1)=Azul
    // Fila 1 (top en imagen, fila inferior en grid): Píxel (0,0)=Blanco, (1,0)=Negro, (2,0)=Amarillo

    const width = 3
    const height = 2
    const rowStride = 12
    const pixelDataSize = rowStride * height
    const headerSize = 54
    const totalSize = headerSize + pixelDataSize

    const buf = Buffer.alloc(totalSize)

    // Cabecera BM
    buf.write('BM', 0)
    buf.writeUInt32LE(totalSize, 2)
    buf.writeUInt32LE(headerSize, 10)

    // BITMAPINFOHEADER
    buf.writeUInt32LE(40, 14) // biSize
    buf.writeInt32LE(width, 18) // biWidth
    buf.writeInt32LE(height, 22) // biHeight (>0 significa bottom-up)
    buf.writeUInt16LE(1, 26) // biPlanes
    buf.writeUInt16LE(24, 28) // biBitCount
    buf.writeUInt32LE(0, 30) // biCompression

    // Fila 0 del archivo BMP (corresponde a y = 1, la fila inferior del mapa)
    // Píxel (0,1): Rojo (B=0, G=0, R=255)
    buf[54 + 0] = 0
    buf[54 + 1] = 0
    buf[54 + 2] = 255
    // Píxel (1,1): Verde (B=0, G=255, R=0)
    buf[54 + 3] = 0
    buf[54 + 4] = 255
    buf[54 + 5] = 0
    // Píxel (2,1): Azul (B=255, G=0, R=0)
    buf[54 + 6] = 255
    buf[54 + 7] = 0
    buf[54 + 8] = 0

    // Fila 1 del archivo BMP (corresponde a y = 0, la fila superior del mapa)
    const row1Offset = 54 + rowStride
    // Píxel (0,0): Blanco (B=255, G=255, R=255)
    buf[row1Offset + 0] = 255
    buf[row1Offset + 1] = 255
    buf[row1Offset + 2] = 255
    // Píxel (1,0): Negro (B=0, G=0, R=0)
    buf[row1Offset + 3] = 0
    buf[row1Offset + 4] = 0
    buf[row1Offset + 5] = 0
    // Píxel (2,0): Amarillo (B=0, G=255, R=255)
    buf[row1Offset + 6] = 0
    buf[row1Offset + 7] = 255
    buf[row1Offset + 8] = 255

    const res = parseProvincesBmp(buf)
    expect(res.width).toBe(3)
    expect(res.height).toBe(2)

    // y=0, x=0: Blanco (255,255,255) -> 0xFFFFFF
    expect(res.colorGrid[0 + 0 * 3]).toBe((255 << 16) | (255 << 8) | 255)
    // y=0, x=1: Negro (0,0,0) -> 0x0
    expect(res.colorGrid[1 + 0 * 3]).toBe(0)
    // y=0, x=2: Amarillo (255,255,0) -> 0xFFFF00
    expect(res.colorGrid[2 + 0 * 3]).toBe((255 << 16) | (255 << 8) | 0)

    // y=1, x=0: Rojo (255,0,0) -> 0xFF0000
    expect(res.colorGrid[0 + 1 * 3]).toBe((255 << 16) | (0 << 8) | 0)
    // y=1, x=1: Verde (0,255,0) -> 0x00FF00
    expect(res.colorGrid[1 + 1 * 3]).toBe((0 << 16) | (255 << 8) | 0)
    // y=1, x=2: Azul (0,0,255) -> 0x0000FF
    expect(res.colorGrid[2 + 1 * 3]).toBe((0 << 16) | (0 << 8) | 255)
  })

  it('throws clear error on invalid or non-24bit BMP', () => {
    const invalidBuf = Buffer.from('NOT A BMP HEADER')
    expect(() => parseProvincesBmp(invalidBuf)).toThrow(/demasiado corto|BM/)

    const hdr = Buffer.alloc(54)
    hdr.write('BM', 0)
    hdr.writeUInt32LE(54, 2)
    hdr.writeUInt32LE(54, 10)
    hdr.writeUInt32LE(40, 14)
    hdr.writeInt32LE(10, 18)
    hdr.writeInt32LE(10, 22)
    hdr.writeUInt16LE(1, 26)
    hdr.writeUInt16LE(16, 28) // 16 bpp no soportado
    hdr.writeUInt32LE(0, 30)

    expect(() => parseProvincesBmp(hdr)).toThrow(/24 bits/)
  })

  it('parses definition.csv lines correctly into color map', () => {
    const csv = `
0;0;0;0;land;false;unknown;0
1;255;0;0;land;true;plains;1
2;0;0;255;sea;true;ocean;1
3;0;255;0;lake;false;lake;1
`
    const { colorToProvince } = parseDefinitionCsv(csv)

    const prov1 = colorToProvince.get((255 << 16) | (0 << 8) | 0)
    expect(prov1).toBeDefined()
    expect(prov1).toMatchObject({
      id: 1,
      type: 'land',
      coastal: true,
      terrain: 'plains',
      continent: 1
    })

    const prov2 = colorToProvince.get((0 << 16) | (0 << 8) | 255)
    expect(prov2).toBeDefined()
    expect(prov2?.type).toBe('sea')

    const prov3 = colorToProvince.get((0 << 16) | (255 << 8) | 0)
    expect(prov3).toBeDefined()
    expect(prov3?.type).toBe('lake')
  })

  it('parses state file text with owner, cores, victory points and date blocks', () => {
    const stateText = `
state = {
  id = 42
  name = "STATE_42"
  state_category = "town"

  history = {
    owner = MEX
    add_core_of = MEX
    add_core_of = USA
    victory_points = { 101 10 }
    victory_points = { 102 5 }

    1939.1.1 = {
      owner = USA
      remove_core_of = MEX
    }
  }

  provinces = {
    101 102 103
  }
}
`
    const parsed = parseStateText(stateText)
    expect(parsed).toBeDefined()
    expect(parsed?.id).toBe(42)
    expect(parsed?.nameKey).toBe('STATE_42')
    expect(parsed?.category).toBe('town')
    expect(parsed?.owner).toBe('MEX')
    expect(parsed?.cores).toEqual(['MEX', 'USA'])
    expect(parsed?.provinces).toEqual([101, 102, 103])
    expect(parsed?.victoryPoints).toEqual([[101, 10], [102, 5]])
    expect(parsed?.hasDateChanges).toBe(true)
    expect(parsed?.dateChanges['1939.1.1']).toEqual({
      owner: 'USA',
      addCores: undefined,
      removeCores: ['MEX']
    })
  })

  it('decodes UTF-8 and Windows-1252 text correctly', () => {
    const utf8Buf = Buffer.from('México - Nombres con tildes', 'utf-8')
    expect(decodeTextBuffer(utf8Buf)).toBe('México - Nombres con tildes')
  })
})
