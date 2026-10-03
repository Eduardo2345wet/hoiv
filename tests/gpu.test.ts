// Pruebas con el motor REAL (WebGL2) en Chromium: la exportación a PNG, los colores exactos del
// estilo y el ancho de las líneas con devicePixelRatio. Si no hay navegador (ni Playwright), se
// saltan. Se usa HOI4_TEST_CHROMIUM, un Chromium de /opt/pw-browsers, o Edge/Chrome instalados.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { build } from 'esbuild'
import { chromium, type Browser, type Page } from 'playwright-core'

const ARGS = [
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-gl=angle',
  '--use-angle=swiftshader-webgl',
  '--enable-unsafe-swiftshader'
]

function findChromium(): string | undefined {
  if (process.env.HOI4_TEST_CHROMIUM) return process.env.HOI4_TEST_CHROMIUM
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  try {
    for (const d of fs
      .readdirSync(root)
      .filter((x) => x.startsWith('chromium-'))
      .sort()
      .reverse()) {
      const exe = path.join(root, d, 'chrome-linux', 'chrome')
      if (fs.existsSync(exe)) return exe
    }
  } catch {
    // sin carpeta de navegadores
  }
  return undefined
}

let browser: Browser | null = null
let page: Page | null = null

beforeAll(async () => {
  const exe = findChromium()
  const attempts = exe
    ? [{ executablePath: exe, args: ARGS }]
    : [
        { channel: 'msedge', args: ARGS },
        { channel: 'chrome', args: ARGS }
      ]
  for (const a of attempts) {
    try {
      browser = await chromium.launch(a)
      break
    } catch {
      // probar con el siguiente
    }
  }
  if (!browser) return
  const out = await build({
    entryPoints: [path.join(__dirname, 'browser', 'harness.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    logLevel: 'silent'
  })
  page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addScriptTag({ content: out.outputFiles[0].text })
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

const hex = (c: number[]): string =>
  '#' +
  c
    .slice(0, 3)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
const SEA = [0x44, 0x6b, 0xa3]
const LAND = [255, 255, 255]

type RowOpts = {
  owners: number[]
  scale: number
  vx: number
  dpr: number
  y: number
  x0: number
  x1: number
}
type RowResult = { rows: number[][]; engine: string; width: number; height: number }

/** Llama a una función del arnés dentro de la página */
const call = <T>(method: string, ...args: unknown[]): Promise<T> =>
  page!.evaluate(
    ([m, a]) =>
      (window as unknown as { __hq: Record<string, (...x: unknown[]) => unknown> }).__hq[
        m as string
      ](...(a as unknown[])),
    [method, args] as [string, unknown[]]
  ) as Promise<T>

/** Cobertura de una línea (0–1 por píxel): (fondo − color) / (fondo − color de la línea) */
const coverage = (px: number[], line: number): number => (255 - px[0]) / (255 - line)
const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0)

/** Mapa de control 64×32 con el borde A|B en x = 32: a escala 10, en x = 320 */
const rowAt = (o: Partial<RowOpts>): Promise<RowResult> =>
  call<RowResult>('controlRow', {
    owners: [0, 0],
    scale: 10,
    vx: 0,
    dpr: 1,
    y: 200,
    x0: 300,
    x1: 340,
    ...o
  })

describe('motor WebGL2 en Chromium (partes 5 y 7)', () => {
  it('las texturas grandes se liberan fuera del mapa y se restauran idénticas; el modo ligero usa la mitad', async ({
    skip
  }) => {
    if (!page) skip()
    const r = await call<{
      bytes: number
      released: number
      restored: number
      lightBytes: number
      before: number[]
      after: number[]
    }>('memCycle')
    expect(r.bytes).toBe(256 * 128 * 3) // R16UI + R8
    expect(r.released).toBe(0)
    expect(r.restored).toBe(r.bytes)
    expect(r.after).toEqual(r.before)
    expect(r.before[0]).toBeGreaterThan(100) // dibuja de verdad (estado A rojizo)
    expect(r.lightBytes).toBeLessThanOrEqual(r.bytes / 3)
  })

  it('hay motor WebGL2', async ({ skip }) => {
    if (!page) skip()
    expect((await rowAt({})).engine).toBe('webgl2')
  })

  it('PNG 1×: 5632×2048, mar #446BA3 y tierra #FFFFFF exactos', async ({ skip }) => {
    if (!page) skip()
    const r = await call<{
      width: number
      height: number
      sea: number[]
      land: number[]
      inside: boolean
    }>('exportDemo', '1x', false)
    expect([r.width, r.height]).toEqual([5632, 2048])
    expect(hex(r.sea)).toBe('#446BA3')
    expect(r.inside).toBe(true)
    expect(hex(r.land)).toBe('#FFFFFF')
  }, 180_000)

  it('PNG con etiquetas: mismo tamaño y mismos colores de mar y tierra', async ({ skip }) => {
    if (!page) skip()
    const r = await call<{ width: number; height: number; sea: number[] }>('exportDemo', '1x', true)
    expect([r.width, r.height]).toEqual([5632, 2048])
    expect(hex(r.sea)).toBe('#446BA3')
  }, 180_000)

  it('PNG 2×: 11264×4096 con los mismos colores, de una pasada o por mosaico según la GPU', async ({
    skip
  }) => {
    if (!page) skip()
    // El límite REAL de este equipo: muchas GPU solo dibujan hasta 8192 px por lado, y en ellas la
    // imagen 2× (11264 de ancho) tiene que salir por pedazos. Sea cual sea el límite, sale completa.
    const limit = await call<number | null>('gpuSide')
    const r = await call<{ width: number; height: number; sea: number[]; tiles: number }>(
      'exportDemo',
      '2x',
      false
    )
    expect([r.width, r.height]).toEqual([11264, 4096])
    expect(hex(r.sea)).toBe('#446BA3')
    const tile = Math.min(limit ?? 4096, 4096)
    const needsTiles = limit !== null && limit < 11264
    expect(r.tiles).toBe(needsTiles ? Math.ceil(11264 / tile) * Math.ceil(4096 / tile) : 1)
  }, 240_000)

  it('el mosaico sale igual que dibujar todo de una vez (también con cuadros que sobran)', async ({
    skip
  }) => {
    if (!page) skip()
    // 1500×900 en cuadros de 512: 3×2 cuadros, los de la orilla recortados
    for (const side of [512, 700]) {
      const r = await call<{
        different: number
        maxJump: number
        wholeTiles: number
        tiledTiles: number
      }>('tileCompare', side)
      expect(r.wholeTiles).toBe(1)
      expect(r.tiledTiles).toBe(Math.ceil(1500 / side) * Math.ceil(900 / side))
      expect(r.different).toBe(0)
    }
  }, 240_000)

  it('si no cabe avisa con el mayor tamaño posible, y ese tamaño sí sale', async ({ skip }) => {
    if (!page) skip()
    const r = await call<{
      isSizeError: boolean
      message: string
      fit: { factor: number; width: number; height: number } | null
      retry: { width: number; height: number } | null
    }>('tooBig')
    // Pidió 3000×2000 = 6 000 000 px con un máximo de 4 000 000
    expect(r.isSizeError).toBe(true)
    expect(r.fit).not.toBeNull()
    expect(r.fit!.factor).toBeLessThan(1)
    expect(r.fit!.width * r.fit!.height).toBeLessThanOrEqual(4_000_000)
    expect(r.fit!.width / r.fit!.height).toBeCloseTo(1.5, 2) // misma composición
    expect(r.message).toContain(`${r.fit!.width}×${r.fit!.height}`)
    expect(r.retry).toEqual({ width: r.fit!.width, height: r.fit!.height })
  }, 240_000)

  it('PNG de la vista actual: el tamaño de la pantalla', async ({ skip }) => {
    if (!page) skip()
    const r = await call<{ width: number; height: number }>('exportDemo', 'view', false)
    expect([r.width, r.height]).toEqual([1000, 600])
  }, 120_000)

  it('frontera de estado: 1 px de #BFBFBF, con tierra #FFFFFF a los lados', async ({ skip }) => {
    if (!page) skip()
    // vx = 0.5: la línea cae justo sobre el píxel 320 → cobertura total, color EXACTO
    const r = await rowAt({ vx: 0.5 })
    const at = (x: number): string => hex(r.rows[x - 300])
    expect(at(319)).toBe('#FFFFFF')
    expect(at(320)).toBe('#BFBFBF')
    expect(at(321)).toBe('#FFFFFF')
    // En una posición cualquiera el ancho total sigue siendo 1 px
    const r2 = await rowAt({ vx: 0 })
    expect(sum(r2.rows.map((p) => coverage(p, 0xbf)))).toBeCloseTo(1, 1)
  })

  it('con DPR 2 la línea sigue midiendo 1 px CSS (2 px del dispositivo, mismo color)', async ({
    skip
  }) => {
    if (!page) skip()
    const r = await rowAt({ dpr: 2, x0: 630, x1: 650 })
    expect(r.width).toBe(1280)
    const cols = r.rows.map((p, i) => [630 + i, hex(p)] as const)
    const line = cols.filter(([, c]) => c === '#BFBFBF').map(([x]) => x)
    expect(line).toEqual([639, 640]) // 2 píxeles del dispositivo = 1 px CSS
    expect(cols.filter(([, c]) => c !== '#BFBFBF').every(([, c]) => c === '#FFFFFF')).toBe(true)
    // DPR 3: 3 píxeles del dispositivo
    const r3 = await rowAt({ dpr: 3, x0: 950, x1: 970 })
    expect(sum(r3.rows.map((p) => coverage(p, 0xbf)))).toBeCloseTo(3, 1)
  })

  it('en zoom muy profundo la línea sigue midiendo 1 px (no se engorda)', async ({ skip }) => {
    if (!page) skip()
    for (const scale of [1, 4, 24, 24.37]) {
      // La frontera (x = 32 del mapa) se lleva al centro de la pantalla; y dentro de la tierra
      const r = await rowAt({
        scale,
        vx: 320 - 32 * scale,
        x0: 314,
        x1: 326,
        y: Math.min(200, Math.round(18 * scale))
      })
      expect(sum(r.rows.map((p) => coverage(p, 0xbf)))).toBeCloseTo(1, 1)
    }
  })

  it('color de la frontera según los dueños, sin recalcular la geometría', async ({ skip }) => {
    if (!page) skip()
    const width = async (owners: number[], line: number): Promise<number> =>
      sum((await rowAt({ owners })).rows.map((p) => coverage(p, line)))
    // Mismo dueño: gris claro de 1 px
    expect(await width([1, 1], 0xbf)).toBeCloseTo(1, 1)
    // Sin pintar o pintado contra sin pintar: gris claro
    expect(await width([0, 0], 0xbf)).toBeCloseTo(1, 1)
    expect(await width([0, 2], 0xbf)).toBeCloseTo(1, 1)
    // Países distintos y pintados: gris oscuro #6E6E6E de 1.75 px
    expect(await width([1, 2], 0x6e)).toBeCloseTo(1.75, 1)
    const dark = await rowAt({ owners: [1, 2], vx: 0.5 })
    // El centro de una línea de 1.75 px cubre del todo el píxel 320
    expect(hex(dark.rows[320 - 300])).toBe('#6E6E6E')
  })

  it('la costa no lleva línea: solo un cambio de color suave de mar a tierra', async ({ skip }) => {
    if (!page) skip()
    // Costa en y = 4 (40 px a escala 10); columna dentro del mapa (x = 100)
    const col = await call<number[][]>('coastColumn', 100, 20, 60)
    const sea = SEA
    const t = (p: number[]): number => (p[0] - sea[0]) / (255 - sea[0])
    for (const p of col) {
      // Cada píxel es una mezcla de mar y tierra: los tres canales dan la misma fracción
      const f = t(p)
      expect(f).toBeGreaterThanOrEqual(-0.01)
      expect(f).toBeLessThanOrEqual(1.01)
      expect(p[1]).toBeCloseTo(sea[1] + (255 - sea[1]) * f, -0.3)
      expect(p[2]).toBeCloseTo(sea[2] + (255 - sea[2]) * f, -0.3)
    }
    expect(hex(col[0])).toBe('#446BA3')
    expect(hex(col[col.length - 1])).toBe('#FFFFFF')
    // El borde es de ~1–2 píxeles (antialias), no una línea gruesa
    expect(col.filter((p) => t(p) > 0.02 && t(p) < 0.98).length).toBeLessThanOrEqual(3)
  })
})
