// Mapa generado de alta calidad: tema, vectorización de fronteras, etiquetas y exportación
import { describe, expect, it } from 'vitest'
import {
  MAP_THEME,
  THEME_RGB,
  hexToRgb,
  rgbToHex,
  textIsWhite,
  deviceWidth
} from '../src/shared/map/theme'
import { generateDemoMap } from '../src/shared/map/demo'
import {
  distToSegment,
  lineXY,
  segmentCount,
  segmentsCross,
  vectorizeBorders
} from '../src/shared/map/vector'
import { serializeMap, deserializeMap } from '../src/shared/map/serialize'
import { buildSegmentBuffer } from '../src/renderer/src/map/borderGeometry'
import { segmentStyle } from '../src/renderer/src/map/borderStyle'
import { buildPalette } from '../src/renderer/src/map/colors'
import { store } from '../src/renderer/src/store/appStore'
import { handleStroke } from '../src/renderer/src/map/tools'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import { syncNoNation } from '../src/renderer/src/map/noNation'
import { emptyProject } from './fixtures'

const demo = generateDemoMap()

describe('tema del mapa (parte 1)', () => {
  it('usa los colores exactos del estilo', () => {
    expect(MAP_THEME.sea).toBe('#446BA3')
    expect(MAP_THEME.land).toBe('#FFFFFF')
    expect(MAP_THEME.stateBorder).toBe('#BFBFBF')
    expect(MAP_THEME.countryBorder).toBe('#6E6E6E')
    expect(MAP_THEME.provinceBorder).toBe('#E6E6E6')
    expect(MAP_THEME.label).toBe('#000000')
    expect(THEME_RGB.sea).toEqual([0x44, 0x6b, 0xa3])
  })
  it('hex <-> rgb es reversible', () => {
    for (const h of Object.values(MAP_THEME).filter((v) => typeof v === 'string' && v[0] === '#'))
      expect(rgbToHex(hexToRgb(h as string))).toBe(h)
  })
  it('los anchos están en los rangos pedidos', () => {
    expect(MAP_THEME.width.stateBorder).toBe(1)
    expect(MAP_THEME.width.countryBorder).toBeGreaterThanOrEqual(1.5)
    expect(MAP_THEME.width.countryBorder).toBeLessThanOrEqual(2)
    expect(MAP_THEME.width.provinceBorder).toBe(0.5)
  })
  it('el texto es negro sobre blanco y blanco sobre colores oscuros', () => {
    expect(textIsWhite([255, 255, 255])).toBe(false)
    expect(textIsWhite([240, 175, 50])).toBe(false)
    expect(textIsWhite([20, 30, 90])).toBe(true)
    expect(textIsWhite([110, 20, 20])).toBe(true)
  })
  it('con DPR 2 una línea de 1 px CSS mide 2 px del dispositivo', () => {
    expect(deviceWidth(1, 2)).toBe(2)
    expect(deviceWidth(MAP_THEME.width.stateBorder, 1)).toBe(1)
  })
})

/** Distancia mínima de un punto a una polilínea (lista plana x, y, …) */
function distToLine(x: number, y: number, xy: ArrayLike<number>): number {
  let best = Infinity
  for (let i = 0; i + 3 < xy.length; i += 2)
    best = Math.min(best, distToSegment(x, y, xy[i], xy[i + 1], xy[i + 2], xy[i + 3]))
  return best
}

describe('fronteras vectoriales (parte 2)', () => {
  const { borders, stats } = vectorizeBorders(demo)

  it('cada par de estados vecinos tiene su polilínea (y no hay otras)', () => {
    const have = new Set<string>()
    for (let i = 0; i < borders.a.length; i++)
      if (borders.a[i]) have.add(`${borders.a[i]}-${borders.b[i]}`)
    const want = new Set<string>()
    for (const [k, v] of Object.entries(demo.stateAdjacency))
      for (const o of v) if (o > Number(k)) want.add(`${k}-${o}`)
    expect(want.size).toBeGreaterThan(50)
    expect([...have].sort()).toEqual([...want].sort())
  })

  it('hay polilíneas de costa (estado ↔ mar o lago), con a = 0', () => {
    let coast = 0
    for (let i = 0; i < borders.a.length; i++)
      if (borders.a[i] === 0) {
        coast++
        expect(borders.b[i]).toBeGreaterThan(0)
      }
    expect(coast).toBe(stats.coastPolylines)
    expect(coast).toBeGreaterThan(10)
  })

  it('ningún segmento cruza a otro (comprobación por fuerza bruta)', () => {
    const segs: number[][] = []
    const owner: number[] = []
    for (let i = 0; i < borders.a.length; i++) {
      const xy = lineXY(borders, i)
      for (let j = 0; j + 3 < xy.length; j += 2) {
        segs.push([xy[j], xy[j + 1], xy[j + 2], xy[j + 3]])
        owner.push(i)
      }
    }
    expect(segs.length).toBe(segmentCount(borders))
    let crossings = 0
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++) {
        const [a, b] = [segs[i], segs[j]]
        // Segmentos que se tocan por un extremo (mismo punto) no son un cruce
        if (segmentsCross(a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3])) crossings++
      }
    expect(crossings).toBe(0)
  })

  it('simplificar y suavizar no mueve ningún punto más de 1 px del mapa', () => {
    // Referencia: el contorno de marching squares sin simplificar ni suavizar
    const ref = vectorizeBorders(demo, { tolerance: 0, chaikinCap: 0 }).borders
    const byPair = new Map<string, number[][]>()
    for (let i = 0; i < borders.a.length; i++) {
      const k = `${borders.a[i]}-${borders.b[i]}`
      if (!byPair.has(k)) byPair.set(k, [])
      byPair.get(k)!.push(lineXY(borders, i))
    }
    let worst = 0
    for (let i = 0; i < ref.a.length; i++) {
      const lines = byPair.get(`${ref.a[i]}-${ref.b[i]}`)!
      const xy = lineXY(ref, i)
      for (let j = 0; j < xy.length; j += 2) {
        const d = Math.min(...lines.map((l) => distToLine(xy[j], xy[j + 1], l)))
        worst = Math.max(worst, d)
      }
    }
    expect(worst).toBeLessThanOrEqual(1)
    // Y simplificar de verdad reduce los puntos
    expect(stats.points).toBeLessThan(stats.rawPoints)
  })

  it('solo Douglas-Peucker (sin Chaikin) queda a ≤ 0.5 px', () => {
    const ref = vectorizeBorders(demo, { tolerance: 0, chaikinCap: 0 }).borders
    const dp = vectorizeBorders(demo, { tolerance: 0.5, chaikinCap: 0 }).borders
    const byPair = new Map<string, number[][]>()
    for (let i = 0; i < dp.a.length; i++) {
      const k = `${dp.a[i]}-${dp.b[i]}`
      if (!byPair.has(k)) byPair.set(k, [])
      byPair.get(k)!.push(lineXY(dp, i))
    }
    let worst = 0
    for (let i = 0; i < ref.a.length; i++) {
      const xy = lineXY(ref, i)
      for (let j = 0; j < xy.length; j += 2)
        worst = Math.max(
          worst,
          Math.min(
            ...byPair.get(`${ref.a[i]}-${ref.b[i]}`)!.map((l) => distToLine(xy[j], xy[j + 1], l))
          )
        )
    }
    expect(worst).toBeLessThanOrEqual(0.5 + 1e-6)
  })

  it('las costas no se dibujan como línea (el relleno suave hace el cambio de color)', () => {
    const slotOf = new Map(demo.states.map((s, i) => [s.id, i + 1]))
    const buf = buildSegmentBuffer(borders, slotOf, demo.width, demo.height)
    expect(buf.count).toBe(segmentCount(borders))
    const u16 = new Uint16Array(buf.data)
    let coastSegs = 0
    for (let j = 0; j < buf.count; j++) {
      const sa = u16[j * 10 + 8]
      const sb = u16[j * 10 + 9]
      const st = segmentStyle(
        'normal',
        { slotA: sa, slotB: sb, ownerA: 1, ownerB: 2, flagsA: 0, flagsB: 0 },
        0
      )
      if (sa === 0) {
        coastSegs++
        expect(st).toBeNull()
      } else expect(st).not.toBeNull()
    }
    expect(coastSegs).toBeGreaterThan(100)
  })

  it('la geometría se guarda y se lee de la caché idéntica', () => {
    const back = deserializeMap(serializeMap(demo))!
    expect(back.borders.points).toEqual(demo.borders.points)
    expect(back.borders.starts).toEqual(demo.borders.starts)
    expect(back.borders.a).toEqual(demo.borders.a)
    expect(back.borders.b).toEqual(demo.borders.b)
    expect(back.borderStats.points).toBe(demo.borderStats.points)
  })
})

describe('color de las fronteras según los dueños (parte 2)', () => {
  const info = (ownerA: number, ownerB: number) => ({
    slotA: 1,
    slotB: 2,
    ownerA,
    ownerB,
    flagsA: 0,
    flagsB: 0
  })
  it('gris claro entre estados del mismo dueño o sin pintar; oscuro entre países distintos', () => {
    const light = segmentStyle('normal', info(3, 3), 0)!
    expect(rgbToHex(light.color)).toBe('#BFBFBF')
    expect(light.widthCss).toBe(1)
    const blank = segmentStyle('normal', info(0, 0), 0)!
    expect(rgbToHex(blank.color)).toBe('#BFBFBF')
    // pintado contra sin pintar: claro (la frontera de país es solo entre estados pintados)
    expect(rgbToHex(segmentStyle('normal', info(3, 0), 0)!.color)).toBe('#BFBFBF')
    const dark = segmentStyle('normal', info(3, 4), 0)!
    expect(rgbToHex(dark.color)).toBe('#6E6E6E')
    expect(dark.widthCss).toBeGreaterThanOrEqual(1.5)
    expect(dark.widthCss).toBeLessThanOrEqual(2)
  })

  it('pintar cambia el color de la frontera sin recalcular la geometría', () => {
    let pr = emptyProject()
    pr = addCountry(pr, {
      ...newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva Granada' }),
      focusTreeId: null
    })
    pr = { ...pr, mapSettings: { ...pr.mapSettings, base: 'blank', unpainted: 'keep' } }
    store.openProject(syncNoNation(pr, null, demo), null)
    store.set({ map: demo, activeTag: 'NVG' })
    // Dos estados vecinos
    const a = demo.states[0].id
    const b = demo.stateAdjacency[a][0]
    const li = Array.from(demo.borders.a).findIndex(
      (x, i) => x === Math.min(a, b) && demo.borders.b[i] === Math.max(a, b)
    )
    expect(li).toBeGreaterThanOrEqual(0)
    const slot = (id: number): number => demo.states.findIndex((s) => s.id === id)
    const styleNow = (): string => {
      const pal = buildPalette(demo, store.get().project, null, {
        mode: 'politico',
        activeTag: 'NVG',
        selectedId: null,
        gameColors: false,
        blankUnpainted: true,
        highlightPending: false
      })
      const sa = slot(demo.borders.a[li])
      const sb = slot(demo.borders.b[li])
      const st = segmentStyle(
        'normal',
        {
          slotA: sa + 1,
          slotB: sb + 1,
          ownerA: pal.owners[sa],
          ownerB: pal.owners[sb],
          flagsA: pal.rgba[sa * 4 + 3],
          flagsB: pal.rgba[sb * 4 + 3]
        },
        0
      )!
      return rgbToHex(st.color)
    }
    const pointsBefore = demo.borders.points.slice()
    expect(styleNow()).toBe('#BFBFBF') // todo sin pintar
    const ctx = { toast: () => {}, brush: { giveCore: false, removePreviousCores: false } }
    handleStroke('brush', 'start', a, { shift: false, erase: false }, ctx)
    handleStroke('brush', 'end', 0, { shift: false, erase: false }, ctx)
    expect(styleNow()).toBe('#BFBFBF') // uno pintado y otro sin pintar: sigue claro
    // El vecino, de otro país: borde oscuro
    store.set({ activeTag: 'DMA' })
    handleStroke('brush', 'start', b, { shift: false, erase: false }, ctx)
    handleStroke('brush', 'end', 0, { shift: false, erase: false }, ctx)
    expect(styleNow()).toBe('#6E6E6E')
    // Mismo país: claro otra vez
    handleStroke('brush', 'start', a, { shift: false, erase: false }, ctx)
    handleStroke('brush', 'end', 0, { shift: false, erase: false }, ctx)
    expect(styleNow()).toBe('#BFBFBF')
    // La geometría no cambió (mismo objeto y mismos puntos)
    expect(demo.borders.points).toEqual(pointsBefore)
  })
})

describe('fronteras vectoriales: casos raros (parte 2)', () => {
  /** Mapa de prueba a partir de texto: cada carácter es una provincia = un estado ('.' = mar) */
  function grid(rows: string[]): Parameters<typeof vectorizeBorders>[0] {
    const ids = new Map<string, number>()
    const h = rows.length
    const w = rows[0].length
    const provinceIndex = new Uint16Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x]
        if (!ids.has(ch)) ids.set(ch, ids.size + 1)
        provinceIndex[y * w + x] = ids.get(ch)!
      }
    const provinceToState = new Uint16Array(ids.size + 1)
    for (const [ch, p] of ids) provinceToState[p] = ch === '.' ? 0 : p
    return { width: w, height: h, provinceIndex, provinceToState }
  }
  const noCross = (b: ReturnType<typeof vectorizeBorders>['borders']): number => {
    const segs: number[][] = []
    for (let i = 0; i < b.a.length; i++) {
      const xy = lineXY(b, i)
      for (let j = 0; j + 3 < xy.length; j += 2) segs.push(xy.slice(j, j + 4))
    }
    let n = 0
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++)
        if (
          segmentsCross(
            segs[i][0],
            segs[i][1],
            segs[i][2],
            segs[i][3],
            segs[j][0],
            segs[j][1],
            segs[j][2],
            segs[j][3]
          )
        )
          n++
    return n
  }

  it('cruces de cuatro estados, tablero de ajedrez e islas de un píxel', () => {
    const maps = [
      ['AABB', 'AABB', 'CCDD', 'CCDD'],
      ['ABAB', 'BABA', 'ABAB', 'BABA'],
      ['......', '..A...', '......', '....B.', '......'],
      ['AAAAAA', 'A.BB.A', 'A.BB.A', 'AAAAAA'],
      ['AB', 'CD']
    ]
    for (const rows of maps) {
      const { borders } = vectorizeBorders(grid(rows))
      expect(borders.a.length).toBeGreaterThan(0)
      expect(noCross(borders)).toBe(0)
      for (let i = 0; i < borders.a.length; i++) {
        expect(borders.b[i]).toBeGreaterThan(borders.a[i])
        expect(borders.starts[i + 1] - borders.starts[i]).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('una isla de un píxel da un lazo cerrado de costa; una frontera recta, una línea', () => {
    const island = vectorizeBorders(grid(['...', '.A.', '...'])).borders
    expect(island.a.length).toBe(1)
    expect(island.a[0]).toBe(0)
    const xy = lineXY(island, 0)
    expect([xy[0], xy[1]]).toEqual([xy[xy.length - 2], xy[xy.length - 1]]) // cerrado
    const straight = vectorizeBorders(grid(['AAbb', 'AAbb', 'AAbb'])).borders
    expect(straight.a.length).toBe(1)
    expect(lineXY(straight, 0)).toEqual([2, 0, 2, 3]) // de arriba a abajo del mapa
  })
})
