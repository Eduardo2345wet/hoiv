// Banderas reales del juego: lector TGA, lectura de gfx/flags con caché, prioridad del mod,
// variante de la ideología gobernante y exportación de banderas
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { unzlibSync } from 'fflate'
import { readTga } from '../src/shared/tga'
import { encodePng } from '../src/shared/png'
import { readGameFlags } from '../src/main/gameFlags'
import { writeTGA } from '../src/renderer/src/export/images'
import { displayGameFlag, gameFlagOf } from '../src/renderer/src/countries/gameFlags'
import { flagSrc } from '../src/renderer/src/ui/FlagThumb'
import { setPlaceholderRenderers } from '../src/renderer/src/icons/renderer'
import {
  countryImageFiles,
  countryImagePaths,
  flagVariants,
  missingFlagSizes
} from '../src/renderer/src/export/countryExport'
import {
  resetFlagVariant,
  variantImage,
  isCustomFlag
} from '../src/renderer/src/countries/gameFlags'
import { addCountry } from '../src/renderer/src/countries/countryOps'
import { emptyProject } from './fixtures'
import { store } from '../src/renderer/src/store/appStore'
import { newCountry } from '../src/renderer/src/countries/countryOps'

/** Imagen de prueba 3×2 con píxeles distintos (RGBA, fila 0 arriba) */
const W = 3
const H = 2
const PIXELS = Uint8Array.from([
  255,
  0,
  0,
  255,
  0,
  255,
  0,
  255,
  0,
  0,
  255,
  255, // fila de arriba
  10,
  20,
  30,
  255,
  200,
  100,
  50,
  255,
  1,
  2,
  3,
  255 // fila de abajo
])

interface Opts {
  bpp: 24 | 32
  rle: boolean
  topOrigin: boolean
}

/** Construye un TGA a mano con las opciones dadas (para no depender de nuestro escritor) */
function makeTga(o: Opts, pixels = PIXELS): Uint8Array {
  const px = o.bpp / 8
  const bytes: number[] = []
  bytes.push(0, 0, o.rle ? 10 : 2, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  bytes.push(W & 255, W >> 8, H & 255, H >> 8, o.bpp)
  bytes.push((o.topOrigin ? 0x20 : 0) | (o.bpp === 32 ? 8 : 0))
  const order = o.topOrigin ? [0, 1] : [1, 0] // orden de las filas en el archivo
  const pix: number[][] = []
  for (const y of order)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      pix.push(
        px === 4
          ? [pixels[i + 2], pixels[i + 1], pixels[i], pixels[i + 3]]
          : [pixels[i + 2], pixels[i + 1], pixels[i]]
      )
    }
  if (!o.rle) for (const p of pix) bytes.push(...p)
  else {
    // un paquete repetido con el primer píxel ×2 si coincide, el resto en paquetes crudos
    let i = 0
    while (i < pix.length) {
      const same = i + 1 < pix.length && pix[i].join() === pix[i + 1].join()
      if (same) {
        bytes.push(0x80 | 1, ...pix[i])
        i += 2
      } else {
        bytes.push(0, ...pix[i])
        i += 1
      }
    }
  }
  return Uint8Array.from(bytes)
}

describe('lector TGA (parte 5)', () => {
  const combos: Opts[] = []
  for (const bpp of [24, 32] as const)
    for (const rle of [false, true])
      for (const topOrigin of [false, true]) combos.push({ bpp, rle, topOrigin })

  it('sin compresión y RLE, de 24 y 32 bits, con origen arriba y abajo: mismos píxeles', () => {
    expect(combos.length).toBe(8)
    for (const o of combos) {
      const img = readTga(makeTga(o))
      expect([img.width, img.height]).toEqual([W, H])
      const expected = Uint8Array.from(PIXELS)
      if (o.bpp === 24) for (let i = 3; i < expected.length; i += 4) expected[i] = 255
      expect(Array.from(img.rgba), JSON.stringify(o)).toEqual(Array.from(expected))
    }
  })

  it('RLE con píxeles repetidos', () => {
    const flat = new Uint8Array(W * H * 4)
    for (let i = 0; i < flat.length; i += 4) flat.set([9, 8, 7, 255], i)
    for (const o of combos.filter((c) => c.rle))
      expect(Array.from(readTga(makeTga(o, flat)).rgba)).toEqual(Array.from(flat))
  })

  it('lee lo que escribe nuestro escritor (32 bits, origen abajo)', () => {
    const img = readTga(writeTGA(W, H, PIXELS))
    expect(Array.from(img.rgba)).toEqual(Array.from(PIXELS))
  })

  it('archivos rotos dan un error claro (no se cuelgan)', () => {
    expect(() => readTga(new Uint8Array(5))).toThrow(/corto/)
    expect(() => readTga(makeTga({ bpp: 32, rle: false, topOrigin: true }).slice(0, 25))).toThrow(
      /incompletos/
    )
    const rle = makeTga({ bpp: 24, rle: true, topOrigin: true })
    expect(() => readTga(rle.slice(0, 22))).toThrow()
    const bad = makeTga({ bpp: 24, rle: false, topOrigin: true })
    bad[2] = 1
    expect(() => readTga(bad)).toThrow(/no soportado/)
  })
})

/** Decodifica un PNG RGBA de 8 bits generado por encodePng */
function decodePng(url: string): { w: number; h: number; rgba: Uint8Array } {
  const b = Buffer.from(url.split(',')[1], 'base64')
  expect(Array.from(b.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  let pos = 8
  const idat: Buffer[] = []
  while (pos < b.length) {
    const len = b.readUInt32BE(pos)
    if (b.toString('latin1', pos + 4, pos + 8) === 'IDAT')
      idat.push(b.subarray(pos + 8, pos + 8 + len))
    pos += 12 + len
  }
  const raw = unzlibSync(new Uint8Array(Buffer.concat(idat)))
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    rgba.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4)
  return { w, h, rgba }
}

describe('banderas del juego leídas de gfx/flags (parte 5)', () => {
  function fakeGame(): { game: string; cache: string } {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-flags-'))
    const w = (rel: string, data: Uint8Array): void => {
      fs.mkdirSync(path.dirname(path.join(game, rel)), { recursive: true })
      fs.writeFileSync(path.join(game, rel), data)
    }
    w('gfx/flags/MEX.tga', makeTga({ bpp: 32, rle: false, topOrigin: false }))
    w('gfx/flags/MEX_fascism.tga', makeTga({ bpp: 24, rle: true, topOrigin: true }))
    w('gfx/flags/GER.tga', writeTGA(W, H, PIXELS))
    w('gfx/flags/BAD.tga', Uint8Array.from([1, 2, 3, 4]))
    w('gfx/flags/medium/MEX.tga', writeTGA(W, H, PIXELS)) // otras carpetas no cuentan
    return { game, cache: fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-cache-')) }
  }

  it('decodifica las banderas a PNG, omite las ilegibles y lo registra', () => {
    const { game, cache } = fakeGame()
    const logs: string[] = []
    const f = readGameFlags(game, null, cache, (m) => logs.push(m))
    expect(Object.keys(f).sort()).toEqual(['GER', 'MEX'])
    expect(Object.keys(f.MEX).sort()).toEqual(['fascism', 'main'])
    const px = decodePng(f.GER.main!)
    expect([px.w, px.h]).toEqual([W, H])
    expect(Array.from(px.rgba)).toEqual(Array.from(PIXELS))
    expect(logs.length).toBe(1)
    expect(logs[0]).toMatch(/BAD\.tga/)
  })

  it('guarda las miniaturas en la caché y la segunda vez no vuelve a decodificar', () => {
    const { game, cache } = fakeGame()
    const first = readGameFlags(game, null, cache, () => {})
    expect(fs.readdirSync(cache).some((n) => n.startsWith('banderas-'))).toBe(true)
    const logs: string[] = []
    const second = readGameFlags(game, null, cache, (m) => logs.push(m))
    expect(second).toEqual(first)
    expect(logs).toEqual([]) // si hubiera decodificado, BAD.tga habría avisado otra vez
  })

  it('las banderas del mod base tienen prioridad sobre las del juego', () => {
    const { game, cache } = fakeGame()
    const mod = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-mod-'))
    fs.mkdirSync(path.join(mod, 'gfx', 'flags'), { recursive: true })
    fs.writeFileSync(
      path.join(mod, 'gfx', 'flags', 'MEX.tga'),
      writeTGA(1, 1, Uint8Array.from([5, 6, 7, 255]))
    )
    fs.writeFileSync(
      path.join(mod, 'gfx', 'flags', 'ZZZ.tga'),
      writeTGA(1, 1, Uint8Array.from([1, 1, 1, 255]))
    )
    const f = readGameFlags(game, { path: mod, name: 'Mod', replacePaths: [] }, cache, () => {})
    expect(Array.from(decodePng(f.MEX.main!).rgba)).toEqual([5, 6, 7, 255]) // la del mod
    expect(f.MEX.fascism).toBeDefined() // lo que el mod no trae sigue siendo del juego
    expect(f.ZZZ.main).toBeDefined() // un país que solo existe en el mod
  })

  it('PNG propio: el codificador produce archivos que se leen de vuelta', () => {
    const png = encodePng(2, 1, Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))
    const url = 'data:image/png;base64,' + Buffer.from(png).toString('base64')
    expect(Array.from(decodePng(url).rgba)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('qué bandera se muestra (parte 5)', () => {
  const flags = {
    MEX: { main: 'MEX.png', fascism: 'MEXf.png', democratic: 'MEXd.png' },
    FRA: { main: 'FRA.png' }
  }
  it('variante de la ideología gobernante, con respaldo a <TAG>.tga', () => {
    expect(displayGameFlag(flags, 'MEX', 'fascism')).toBe('MEXf.png')
    expect(displayGameFlag(flags, 'MEX', 'communism')).toBe('MEX.png') // no existe: la principal
    expect(displayGameFlag(flags, 'FRA', 'democratic')).toBe('FRA.png')
    expect(displayGameFlag(flags, 'MEX', undefined)).toBe('MEX.png')
    expect(displayGameFlag(flags, 'XXX', 'fascism')).toBeNull()
    expect(displayGameFlag(null, 'MEX', 'fascism')).toBeNull()
    expect(gameFlagOf(flags, 'MEX', 'neutrality')).toBeNull()
  })

  it('un país existente muestra la real; la personalizada gana; el del mod usa la suya', () => {
    store.set({
      gameFlags: flags,
      game: { countries: [], ideas: [], countryRuling: { MEX: 'fascism' } }
    })
    const mex = newCountry({ mode: 'existente', tag: 'MEX', name: 'México' })
    expect(flagSrc(mex)).toBe('MEXf.png')
    expect(flagSrc(mex, 'democratic')).toBe('MEXd.png')
    expect(flagSrc(mex, 'neutrality')).toBe('MEX.png') // sin esa variante: la principal del juego
    const custom = { ...mex, flags: { ...mex.flags, byIdeology: { fascism: 'mia.png' } } }
    expect(flagSrc(custom, 'fascism')).toBe('mia.png')
    setPlaceholderRenderers({ flag: () => 'relleno', portrait: () => 'x', plain: () => 'liso' })
    const nuevo = newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva' })
    expect(flagSrc(nuevo)).toBe('relleno') // relleno, nunca la del juego
    store.set({ gameFlags: null, game: null })
  })
})

describe('editar y exportar banderas (parte 6)', () => {
  const flags = {
    MEX: { main: 'MEX.png', fascism: 'MEXf.png', democratic: 'MEXd.png', neutrality: 'MEXn.png' }
  }
  const mexWith = (patch: object): ReturnType<typeof emptyProject> => {
    const p = emptyProject() // MEX es un país EXISTENTE del juego
    return {
      ...p,
      countries: p.countries.map((c) => ({ ...c, flags: { ...c.flags, ...patch } }))
    }
  }

  it('al editar un país del juego se parte de sus banderas reales (y se ve de dónde vienen)', () => {
    const c = emptyProject().countries[0]
    const ph = (): string => 'relleno'
    expect(variantImage(c, 'main', flags, ph)).toEqual({ src: 'MEX.png', source: 'juego' })
    expect(variantImage(c, 'fascism', flags, ph)).toEqual({ src: 'MEXf.png', source: 'juego' })
    // communism no existe en el juego: usa la principal del juego
    expect(variantImage(c, 'communism', flags, ph)).toEqual({ src: 'MEX.png', source: 'juego' })
    // sin banderas del juego: relleno
    expect(variantImage(c, 'main', null, ph).source).toBe('relleno')
    const mine = { ...c, flags: { ...c.flags, byIdeology: { fascism: 'mia.png' } } }
    expect(variantImage(mine, 'fascism', flags, ph)).toEqual({
      src: 'mia.png',
      source: 'personalizada'
    })
    expect(isCustomFlag(mine, 'fascism')).toBe(true)
    expect(isCustomFlag(mine, 'democratic')).toBe(false)
  })

  it('"Volver a la del juego" quita la personalizada', () => {
    const c = emptyProject().countries[0]
    const mine = { ...c, flags: { ...c.flags, main: 'a.png', byIdeology: { fascism: 'mia.png' } } }
    const a = resetFlagVariant(mine, 'fascism')
    expect(a.flags.byIdeology).toEqual({})
    expect(a.flags.main).toBe('a.png')
    const b = resetFlagVariant(mine, 'main')
    expect(b.flags.main).toBeNull()
    expect(variantImage(b, 'main', flags, () => 'x').source).toBe('juego')
  })

  it('país del juego con 1 variante personalizada: se exporta solo esa, en 3 tamaños', () => {
    const p = mexWith({ byIdeology: { fascism: 'data:fascismo' } })
    expect(flagVariants(p.countries[0])).toEqual([['MEX_fascism', 'data:fascismo']])
    expect(countryImagePaths(p).filter((x) => x.includes('flags'))).toEqual([
      'gfx/flags/MEX_fascism.tga',
      'gfx/flags/medium/MEX_fascism.tga',
      'gfx/flags/small/MEX_fascism.tga'
    ])
    expect(missingFlagSizes(p)).toEqual([])
    // La auto-revisión detecta si falta un tamaño
    expect(missingFlagSizes(p, ['gfx/flags/MEX_fascism.tga'])).toEqual([
      'gfx/flags/medium/MEX_fascism.tga',
      'gfx/flags/small/MEX_fascism.tga'
    ])
  })

  it('las TGA exportadas tienen el nombre del juego y los tamaños 82×52, 41×26 y 10×7', async () => {
    const p = mexWith({ byIdeology: { fascism: 'data:fascismo' } })
    const sizes: Record<string, number[]> = {}
    const files = await countryImageFiles(p, async (_png, w, h) => {
      const rgba = new Uint8Array(w * h * 4).fill(255)
      return { width: w, height: h, rgba }
    })
    for (const f of files.filter((x) => x.path.includes('flags'))) {
      const d = f.data!
      sizes[f.path] = [d[12] | (d[13] << 8), d[14] | (d[15] << 8)]
    }
    expect(sizes).toEqual({
      'gfx/flags/MEX_fascism.tga': [82, 52],
      'gfx/flags/medium/MEX_fascism.tga': [41, 26],
      'gfx/flags/small/MEX_fascism.tga': [10, 7]
    })
  })

  it('sin personalizar nada, un país del juego no exporta banderas; la principal sola exporta solo ella', () => {
    expect(countryImagePaths(mexWith({})).filter((x) => x.includes('flags'))).toEqual([])
    const only = mexWith({ main: 'data:principal' })
    expect(flagVariants(only.countries[0]).map(([n]) => n)).toEqual(['MEX'])
  })

  it('un país del MOD exporta sus 15 banderas (5 variantes × 3 tamaños)', () => {
    const p = addCountry(emptyProject(), {
      ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
      focusTreeId: null
    })
    const nvg = countryImagePaths(p).filter((x) => x.includes('flags/') && x.includes('NVG'))
    expect(nvg.length).toBe(15)
    expect(new Set(nvg.map((x) => x.split('/').pop())).size).toBe(5)
    expect(missingFlagSizes(p)).toEqual([])
  })
})
