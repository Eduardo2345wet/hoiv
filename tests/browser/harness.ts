// Se empaqueta con esbuild y se carga en Chromium para probar el motor REAL (WebGL2) sin la app.
import { buildMapData } from '../../src/shared/map/build'
import { generateDemoMap } from '../../src/shared/map/demo'
import { PROVINCE_TYPE, type MapData, type MapState } from '../../src/shared/map/types'
import { buildPalette, type Palette } from '../../src/renderer/src/map/colors'
import {
  exportGeometry,
  exportMapImage,
  renderToCanvas,
  type ExportSize
} from '../../src/renderer/src/map/exportImage'
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

  /** Exporta el mapa de demostración y mide la imagen PNG que sale */
  async exportDemo(size: ExportSize, labels: boolean) {
    const map = generateDemoMap()
    const palette = buildPalette(map, null, null, {
      mode: 'politico',
      activeTag: null,
      selectedId: null,
      gameColors: false,
      blankUnpainted: true,
      highlightPending: false
    })
    const geo = exportGeometry(size, map, {
      width: 1000,
      height: 600,
      view: { scale: 1, x: 0, y: 0 },
      dpr: 1
    })
    const res = await exportMapImage(
      { size, labels, provinceBorders: false },
      {
        map,
        palette,
        current: { width: 1000, height: 600, view: { scale: 1, x: 0, y: 0 }, dpr: 1 },
        labelInput: {
          map,
          mode: 'id',
          capitals: null,
          colorOf: () => [255, 255, 255],
          measure: canvasMeasure()
        }
      }
    )
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
      bytes: res.blob.size
    }
  }
}

;(window as unknown as { __hq: typeof api }).__hq = api
