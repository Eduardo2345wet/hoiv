// Se empaqueta con esbuild y se carga en Chromium para probar el motor REAL (WebGL2) sin la app.
import { buildMapData } from '../../src/shared/map/build'
import { generateDemoMap } from '../../src/shared/map/demo'
import { PROVINCE_TYPE, type MapData, type MapState } from '../../src/shared/map/types'
import { buildPalette, type Palette } from '../../src/renderer/src/map/colors'
import {
  ExportSizeError,
  exportGeometry,
  exportMapImage,
  gpuMaxSide,
  renderToCanvas,
  type ExportContext,
  type ExportFit,
  type ExportLimits,
  type ExportSize
} from '../../src/renderer/src/map/exportImage'
import { createWebGLRenderer } from '../../src/renderer/src/map/webglRenderer'
import { canvasMeasure } from '../../src/renderer/src/map/labelLayout'

/** Mapa de control: dos estados (A | B) partidos en x = width/2 y mar arriba (filas 0–3) */
function controlMap(width = 64, height = 32): MapData {
  const idx = new Uint16Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) idx[y * width + x] = y < 4 ? 3 : x < width / 2 ? 1 : 2
  const st = (id: number, p: number): MapState => ({
    id,
    nameKey: `S${id}`,
    name: `S${id}`,
    file: `${id}.txt`,
    provinces: [p],
    owner: 'AAA',
    cores: [],
    victoryPoints: [],
    category: 'rural',
    hasDatedChanges: false
  })
  return buildMapData({
    source: 'demo',
    width,
    height,
    provinceIndex: idx,
    provinceType: Uint8Array.from([0, PROVINCE_TYPE.land, PROVINCE_TYPE.land, PROVINCE_TYPE.sea]),
    provinceCoastal: new Uint8Array(4),
    provinceColor: new Uint32Array(4),
    states: [st(1, 1), st(2, 2)],
    unknownColorPixels: 0
  })
}

const pal = (owners: number[], colors: number[][]): Palette => ({
  rgba: Uint8Array.from(colors.flatMap((c) => [c[0], c[1], c[2], 0])),
  owners: Uint16Array.from(owners)
})

/** Lee píxeles (RGBA) de cualquier canvas, también de uno WebGL */
function readPixels(c: HTMLCanvasElement, x: number, y: number, w: number, h: number): number[] {
  const t = document.createElement('canvas')
  t.width = c.width
  t.height = c.height
  const ctx = t.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(c, 0, 0)
  return Array.from(ctx.getImageData(x, y, w, h).data)
}

/** Una fila de píxeles [r, g, b] entre x0 y x1 (incluidos) */
function row(c: HTMLCanvasElement, y: number, x0: number, x1: number): number[][] {
  const d = readPixels(c, x0, y, x1 - x0 + 1, 1)
  return Array.from({ length: x1 - x0 + 1 }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]])
}

const api = {
  /** Renderiza el mapa de control con la vista dada y devuelve una fila de píxeles */
  controlRow(opts: {
    owners: number[]
    scale: number
    vx: number
    dpr: number
    y: number
    x0: number
    x1: number
  }): { rows: number[][]; engine: string; width: number; height: number } {
    const map = controlMap()
    const cssW = 640
    const cssH = 320
    const { canvas, engine } = renderToCanvas({
      map,
      palette: pal(opts.owners, [
        [255, 255, 255],
        [255, 255, 255]
      ]),
      geometry: {
        width: cssW * opts.dpr,
        height: cssH * opts.dpr,
        dpr: opts.dpr,
        cssWidth: cssW,
        cssHeight: cssH,
        view: { scale: opts.scale, x: opts.vx, y: 0 }
      },
      provinceBorders: false,
      labels: null
    })
    return {
      rows: row(canvas, opts.y, opts.x0, opts.x1),
      engine,
      width: canvas.width,
      height: canvas.height
    }
  },

  /** Texturas grandes: liberar y restaurar sin releer nada; modo ligero = la mitad */
  memCycle(): {
    bytes: number
    released: number
    restored: number
    lightBytes: number
    before: number[]
    after: number[]
  } {
    const map = controlMap(256, 128)
    const draw = (
      light: boolean
    ): { r: ReturnType<typeof createWebGLRenderer>; c: HTMLCanvasElement } => {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 128
      const r = createWebGLRenderer(c, map, { light, preserveDrawingBuffer: true })!
      r.setPalette(
        pal(
          [1, 2],
          [
            [200, 30, 30],
            [30, 200, 30]
          ]
        )
      )
      return { r, c }
    }
    const opts = { hoverStateId: 0, provinceBorders: false, activeContour: false, dpr: 1 }
    const view = { scale: 1, x: 0, y: 0 }
    const full = draw(false)
    full.r.render(view, 256, 128, opts)
    const before = readPixels(full.c, 40, 60, 1, 1).concat(readPixels(full.c, 200, 60, 1, 1))
    const bytes = full.r.textureBytes
    full.r.release()
    const released = full.r.textureBytes
    full.r.render(view, 256, 128, opts) // sin texturas no dibuja ni falla
    full.r.restore()
    const restored = full.r.textureBytes
    full.r.render(view, 256, 128, opts)
    const after = readPixels(full.c, 40, 60, 1, 1).concat(readPixels(full.c, 200, 60, 1, 1))
    const light = draw(true)
    return { bytes, released, restored, lightBytes: light.r.textureBytes, before, after }
  },

  /** Columna de píxeles a través de la costa (mar arriba, tierra abajo) */
  coastColumn(x: number, y0: number, y1: number): number[][] {
    const map = controlMap()
    const { canvas } = renderToCanvas({
      map,
      palette: pal(
        [0, 0],
        [
          [255, 255, 255],
          [255, 255, 255]
        ]
      ),
      geometry: {
        width: 640,
        height: 320,
        dpr: 1,
        cssWidth: 640,
        cssHeight: 320,
        view: { scale: 10, x: 0, y: 0 }
      },
      provinceBorders: false,
      labels: null
    })
    const d = readPixels(canvas, x, y0, 1, y1 - y0 + 1)
    return Array.from({ length: y1 - y0 + 1 }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]])
  },

  /** Lado máximo que la GPU de este equipo dibuja de una vez (null: no hay WebGL2) */
  gpuSide(): number | null {
    return gpuMaxSide()
  },

  /** Exporta el mapa de demostración y mide la imagen PNG que sale */
  async exportDemo(size: ExportSize, labels: boolean, limits?: Partial<ExportLimits>) {
    const { map, ctx: exportCtx } = demoContext(limits)
    const geo = exportGeometry(size, map, exportCtx.current)
    const res = await exportMapImage({ size, labels, provinceBorders: false }, exportCtx)
    const bmp = await createImageBitmap(res.blob)
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0)
    const px = (x: number, y: number): number[] => Array.from(ctx.getImageData(x, y, 1, 1).data)
    // Un píxel dentro de un estado: su centro, llevado a la imagen
    const s = map.states[0]
    const [cx, cy] = map.stateCenters[s.id]
    const inside = map.provinceToState[map.provinceIndex[cy * map.width + cx]] === s.id
    return {
      width: bmp.width,
      height: bmp.height,
      engine: res.engine,
      geoWidth: geo.width,
      sea: px(5, 5),
      land: px(
        Math.round(geo.view.x + (cx + 0.5) * geo.view.scale),
        Math.round(geo.view.y + (cy + 0.5) * geo.view.scale)
      ),
      inside,
      bytes: res.blob.size,
      tiles: res.tiles
    }
  },

  /**
   * Mosaico contra una sola pasada: mismo mapa, misma vista, una vez de golpe y otra en cuadros
   * de `tileSide` px. Devuelve cuántos píxeles difieren (y el mayor salto de un canal).
   */
  tileCompare(tileSide: number) {
    const { map, ctx } = demoContext()
    const geometry = {
      width: 1500,
      height: 900,
      dpr: 1.5,
      cssWidth: 1000,
      cssHeight: 600,
      view: { scale: 0.9, x: 37.5, y: 12.25 }
    }
    const job = {
      map,
      palette: ctx.palette,
      geometry,
      provinceBorders: true,
      labels: null as null,
      activeContour: false
    }
    const whole = renderToCanvas({ ...job, limits: { gpuSide: 1_000_000 } })
    const tiled = renderToCanvas({ ...job, limits: { gpuSide: tileSide } })
    const a = readPixels(whole.canvas, 0, 0, geometry.width, geometry.height)
    const b = readPixels(tiled.canvas, 0, 0, geometry.width, geometry.height)
    let different = 0
    let maxJump = 0
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i])
      if (d) {
        different++
        maxJump = Math.max(maxJump, d)
      }
    }
    const res = { different, maxJump, wholeTiles: whole.tiles, tiledTiles: tiled.tiles }
    whole.dispose()
    tiled.dispose()
    return res
  },

  /** Pide más de lo que cabe: debe avisar con el mayor tamaño posible, y ese tamaño debe salir */
  async tooBig() {
    const { ctx } = demoContext({ maxPixels: 4_000_000 })
    const opts = { size: 'view' as const, labels: false, provinceBorders: false }
    ctx.current = { width: 3000, height: 2000, view: { scale: 1, x: 0, y: 0 }, dpr: 1 }
    let fit: ExportFit | null = null
    let message = ''
    let isSizeError = false
    try {
      await exportMapImage(opts, ctx)
    } catch (e) {
      isSizeError = e instanceof ExportSizeError
      message = (e as Error).message
      fit = e instanceof ExportSizeError ? e.fit : null
    }
    if (!fit) return { isSizeError, message, fit, retry: null }
    const res = await exportMapImage({ ...opts, factor: fit.factor }, ctx)
    const bmp = await createImageBitmap(res.blob)
    return { isSizeError, message, fit, retry: { width: bmp.width, height: bmp.height } }
  }
}

/** El mapa de demostración con su paleta y todo lo que pide `exportMapImage` */
function demoContext(limits?: Partial<ExportLimits>): { map: MapData; ctx: ExportContext } {
  const map = generateDemoMap()
  const palette = buildPalette(map, null, null, {
    mode: 'politico',
    activeTag: null,
    selectedId: null,
    gameColors: false,
    blankUnpainted: true,
    highlightPending: false
  })
  return {
    map,
    ctx: {
      map,
      palette,
      current: { width: 1000, height: 600, view: { scale: 1, x: 0, y: 0 }, dpr: 1 },
      labelInput: {
        map,
        mode: 'id',
        capitals: null,
        colorOf: () => [255, 255, 255],
        measure: canvasMeasure()
      },
      limits
    }
  }
}

;(window as unknown as { __hq: typeof api }).__hq = api
