// Mapa de DEMOSTRACIÓN: generador procedural determinista (misma semilla = mismo mapa).
// ~1200×600 px, ~300 provincias tipo Voronoi, ~40 estados de tierra, mar alrededor y
// 4 países ficticios (DMA, DMB, DMC, DMD). Sus estados NUNCA se exportan al mod.
import { buildMapData, computeCoastal } from './build'
import type { MapData, MapState } from './types'
import { PROVINCE_TYPE } from './types'

export const DEMO_TAGS = ['DMA', 'DMB', 'DMC', 'DMD'] as const
export const DEMO_COUNTRY_NAMES: Record<string, string> = {
  DMA: 'Demolandia del Norte',
  DMB: 'Demolandia del Este',
  DMC: 'Demolandia del Sur',
  DMD: 'Demolandia del Oeste'
}
const CATEGORIES = ['rural', 'town', 'large_town', 'city', 'large_city', 'wasteland']

/** Generador pseudoaleatorio con semilla (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateDemoMap(seed = 1936, width = 1200, height = 600): MapData {
  const rand = rng(seed)

  // --- Semillas de provincias en una rejilla con variación (búsqueda rápida del más cercano) ---
  const cellW = 60
  const cellH = 40
  const cols = Math.ceil(width / cellW)
  const rows = Math.ceil(height / cellH)
  const seeds: [number, number][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      seeds.push([
        c * cellW + (0.15 + rand() * 0.7) * cellW,
        r * cellH + (0.15 + rand() * 0.7) * cellH
      ])
  // provincia = posición de la semilla + 1 (0 queda para "sin provincia")

  // --- Continente: unión de elipses (tierra en el centro, mar alrededor) ---
  const blobs: [number, number, number, number][] = [
    [width * 0.5, height * 0.5, width * 0.33, height * 0.34]
  ]
  for (let i = 0; i < 6; i++)
    blobs.push([
      width * (0.25 + rand() * 0.5),
      height * (0.25 + rand() * 0.5),
      width * (0.08 + rand() * 0.12),
      height * (0.1 + rand() * 0.14)
    ])
  const isLandPoint = (x: number, y: number): boolean =>
    blobs.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)

  const provCount = seeds.length
  const provinceType = new Uint8Array(provCount + 1)
  for (let p = 1; p <= provCount; p++) {
    const [sx, sy] = seeds[p - 1]
    provinceType[p] = isLandPoint(sx, sy) ? PROVINCE_TYPE.land : PROVINCE_TYPE.sea
  }
  // Un lago en medio del continente
  const lake = seeds.findIndex(([sx, sy]) => Math.hypot(sx - width * 0.55, sy - height * 0.45) < 30)
  if (lake >= 0) provinceType[lake + 1] = PROVINCE_TYPE.lake

  // --- Voronoi por píxel ---
  const provinceIndex = new Uint16Array(width * height)
  for (let y = 0; y < height; y++) {
    const r0 = Math.floor(y / cellH)
    for (let x = 0; x < width; x++) {
      const c0 = Math.floor(x / cellW)
      let best = 0
      let bestD = Infinity
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= rows) continue
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (c < 0 || c >= cols) continue
          const k = r * cols + c
          const dx = seeds[k][0] - x
          const dy = seeds[k][1] - y
          const d = dx * dx + dy * dy
          if (d < bestD) {
            bestD = d
            best = k + 1
          }
        }
      }
      provinceIndex[y * width + x] = best
    }
  }

  const provinceColor = new Uint32Array(provCount + 1)
  for (let p = 1; p <= provCount; p++) provinceColor[p] = ((p * 2654435761) >>> 8) & 0xffffff

  // --- Estados: ~40 grupos de provincias de tierra (la semilla de tierra más cercana) ---
  const landProvs: number[] = []
  for (let p = 1; p <= provCount; p++) if (provinceType[p] === PROVINCE_TYPE.land) landProvs.push(p)
  const stateCount = Math.min(40, landProvs.length)
  const stateSeeds: number[] = []
  const step = landProvs.length / stateCount
  for (let i = 0; i < stateCount; i++)
    stateSeeds.push(landProvs[Math.floor(i * step + rand() * step * 0.5)])
  const groups: number[][] = stateSeeds.map(() => [])
  for (const p of landProvs) {
    let best = 0
    let bestD = Infinity
    stateSeeds.forEach((s, i) => {
      const d = (seeds[s - 1][0] - seeds[p - 1][0]) ** 2 + (seeds[s - 1][1] - seeds[p - 1][1]) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    groups[best].push(p)
  }

  // --- 4 países por cuadrante (respecto al centro del continente) ---
  const states: MapState[] = []
  groups.forEach((provs, i) => {
    if (!provs.length) return
    const id = i + 1
    const cx = provs.reduce((s, p) => s + seeds[p - 1][0], 0) / provs.length
    const cy = provs.reduce((s, p) => s + seeds[p - 1][1], 0) / provs.length
    const north = cy < height * 0.5
    const west = cx < width * 0.5
    const owner = north ? (west ? 'DMD' : 'DMA') : west ? 'DMC' : 'DMB'
    const vp = provs[Math.floor(rand() * provs.length)]
    states.push({
      id,
      nameKey: `STATE_${id}`,
      name: `Estado ${id}`,
      file: `${id}-Demo_${id}.txt`,
      provinces: provs.sort((a, b) => a - b),
      owner,
      cores: [owner],
      victoryPoints: rand() < 0.8 ? [[vp, 1 + Math.floor(rand() * 10)]] : [],
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      hasDatedChanges: false
    })
  })
  // Un par de estados con cambios con fecha (para probar el aviso) y un core compartido
  if (states[3]) states[3].hasDatedChanges = true
  if (states[10]) states[10].cores = [...states[10].cores, states[0]?.owner ?? 'DMA']

  const provinceCoastal = computeCoastal(width, height, provinceIndex, provinceType)
  return buildMapData({
    source: 'demo',
    width,
    height,
    provinceIndex,
    provinceType,
    provinceCoastal,
    provinceColor,
    states,
    unknownColorPixels: 0
  })
}
