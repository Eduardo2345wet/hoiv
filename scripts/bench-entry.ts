// Se ejecuta DENTRO de Chromium (lo empaqueta scripts/bench-render.mjs): mide el mapa sintético
// del tamaño del real con el motor WebGL2 real (aquí, por software con SwiftShader).
import { generateDemoMap } from '../src/shared/map/demo'
import { segmentCount } from '../src/shared/map/vector'
import { serializeMap } from '../src/shared/map/serialize'
import { buildPalette } from '../src/renderer/src/map/colors'
import { createWebGLRenderer } from '../src/renderer/src/map/webglRenderer'
import { canvasMeasure, layoutLabels } from '../src/renderer/src/map/labelLayout'
import { exportMapImage } from '../src/renderer/src/map/exportImage'

const ms = (t: number): number => Math.round(performance.now() - t)

async function main(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  let t = performance.now()
  const map = generateDemoMap(1936, 5632, 2048, { states: 1300, cell: [30, 28] })
  out.generarMapaSintetico_ms = ms(t)
  out.mapa = `${map.width}x${map.height}, ${map.states.length} estados`
  out.vectorizar_ms = Math.round(map.borderStats.ms)
  out.rectangulosEtiquetas_ms = Math.round(map.labelBoxesMs)
  out.polilineas = map.borderStats.polylines
  out.puntos = `${map.borderStats.rawPoints} -> ${map.borderStats.points}`
  out.segmentos = segmentCount(map.borders)
  out.fronterasKB = Math.round(
    (map.borders.points.byteLength +
      map.borders.starts.byteLength +
      map.borders.a.byteLength +
      map.borders.b.byteLength) /
      1024
  )
  t = performance.now()
  const bin = serializeMap(map)
  out.serializar_ms = ms(t)
  out.cacheTotalMB = +(bin.length / 1048576).toFixed(1)

  const palette = buildPalette(map, null, null, {
    mode: 'politico',
    activeTag: null,
    selectedId: null,
    gameColors: false,
    blankUnpainted: false,
    highlightPending: false
  })
  const W = 1366
  const H = 768
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  document.body.appendChild(canvas)
  t = performance.now()
  const r = createWebGLRenderer(canvas, map)!
  out.crearRenderizador_ms = ms(t)
  out.motor = r.kind
  t = performance.now()
  r.setPalette(palette)
  out.setPaleta_ms = ms(t)
  // Pintar un estado: reconstruir la paleta y subirla
  t = performance.now()
  const p2 = buildPalette(map, null, null, {
    mode: 'politico',
    activeTag: 'DMA',
    selectedId: 5,
    gameColors: false,
    blankUnpainted: false,
    highlightPending: false
  })
  r.setPalette(p2)
  out.pintarUnEstado_ms = ms(t)

  const gl = canvas.getContext('webgl2')!
  const px = new Uint8Array(4)
  const sync = (): void => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const frames: Record<string, unknown> = {}
  for (const scale of [0.2, 1, 4, 16]) {
    const N = 20
    const times: number[] = []
    for (let i = 0; i < N; i++) {
      const t0 = performance.now()
      r.render({ scale, x: -2000 * scale - i * 13, y: -300 * scale - i * 7 }, W, H, {
        hoverStateId: 40,
        provinceBorders: false,
        activeContour: true,
        dpr: 1
      })
      sync()
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    frames[`zoom ${scale}`] =
      `mediana ${times[N >> 1].toFixed(1)} ms, peor ${times[N - 1].toFixed(1)} ms, segmentos ${r.stats.segmentsDrawn}/${r.stats.segmentsTotal}`
  }
  out.cuadrosSoftwareGL = frames

  const measure = canvasMeasure()
  const lay: Record<string, string> = {}
  for (const scale of [0.2, 0.5, 1, 4]) {
    const t0 = performance.now()
    const labs = layoutLabels({
      map,
      view: { scale, x: -300 * scale, y: -100 * scale },
      width: W,
      height: H,
      mode: 'ambos',
      capitals: null,
      colorOf: () => [255, 255, 255],
      measure
    })
    lay[`zoom ${scale}`] = `${Math.round(performance.now() - t0)} ms, ${labs.length} etiquetas`
  }
  out.colocarEtiquetas = lay

  t = performance.now()
  const res = await exportMapImage(
    { size: '1x', labels: true, provinceBorders: false },
    {
      map,
      palette,
      current: { width: W, height: H, view: { scale: 1, x: 0, y: 0 }, dpr: 1 },
      labelInput: { map, mode: 'id', capitals: null, colorOf: () => [255, 255, 255], measure }
    }
  )
  out.exportarPNG1x_ms = ms(t)
  out.exportarPNG1x_KB = Math.round(res.blob.size / 1024)
  return out
}
;(window as unknown as { __bench: () => Promise<Record<string, unknown>> }).__bench = main
