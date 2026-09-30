// Construye los índices derivados del mapa: provincia→estado, píxeles por estado,
// adyacencia entre estados (comparando píxeles vecinos) y centros.
import type { MapData, MapState } from './types'
import { PROVINCE_TYPE } from './types'

export interface RawMap {
  source: MapData['source']
  width: number
  height: number
  provinceIndex: Uint16Array
  provinceType: Uint8Array
  provinceCoastal: Uint8Array
  provinceColor: Uint32Array
  states: MapState[]
  unknownColorPixels: number
}

export function buildMapData(raw: RawMap): MapData {
  const { width, height, provinceIndex, states } = raw
  const maxProv = raw.provinceType.length
  const provinceToState = new Uint16Array(maxProv)
  for (const s of states) for (const p of s.provinces) if (p < maxProv) provinceToState[p] = s.id

  // Índice de estado (posición en `states`) por id, en un arreglo para ir rápido
  const maxStateId = states.reduce((m, s) => Math.max(m, s.id), 0)
  const stateSlot = new Int32Array(maxStateId + 1).fill(-1)
  states.forEach((s, i) => (stateSlot[s.id] = i))

  // 1ª pasada: contar píxeles por estado, sumar posiciones y buscar vecinos
  const counts = new Uint32Array(states.length)
  const sumX = new Float64Array(states.length)
  const sumY = new Float64Array(states.length)
  const adj = new Set<number>()
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const i = row + x
      const st = provinceToState[provinceIndex[i]]
      if (!st) continue
      const slot = stateSlot[st]
      counts[slot]++
      sumX[slot] += x
      sumY[slot] += y
      if (x + 1 < width) {
        const r = provinceToState[provinceIndex[i + 1]]
        if (r && r !== st) adj.add(st < r ? st * 65536 + r : r * 65536 + st)
      }
      if (y + 1 < height) {
        const d = provinceToState[provinceIndex[i + width]]
        if (d && d !== st) adj.add(st < d ? st * 65536 + d : d * 65536 + st)
      }
    }
  }

  // 2ª pasada: lista compacta de píxeles por estado
  const offsets = new Uint32Array(states.length + 1)
  for (let i = 0; i < states.length; i++) offsets[i + 1] = offsets[i] + counts[i]
  const cursor = offsets.slice(0, states.length)
  const statePixelIndex = new Uint32Array(offsets[states.length])
  for (let i = 0; i < provinceIndex.length; i++) {
    const st = provinceToState[provinceIndex[i]]
    if (st) statePixelIndex[cursor[stateSlot[st]]++] = i
  }

  const stateAdjacency: Record<number, number[]> = {}
  for (const s of states) stateAdjacency[s.id] = []
  for (const key of adj) {
    const a = Math.floor(key / 65536)
    const b = key % 65536
    stateAdjacency[a]?.push(b)
    stateAdjacency[b]?.push(a)
  }
  for (const k of Object.keys(stateAdjacency)) stateAdjacency[Number(k)].sort((a, b) => a - b)

  const stateCenters: Record<number, [number, number]> = {}
  states.forEach((s, i) => {
    if (counts[i])
      stateCenters[s.id] = [Math.round(sumX[i] / counts[i]), Math.round(sumY[i] / counts[i])]
  })

  return {
    source: raw.source,
    width,
    height,
    provinceIndex,
    provinceType: raw.provinceType,
    provinceCoastal: raw.provinceCoastal,
    provinceColor: raw.provinceColor,
    provinceToState,
    states,
    stateAdjacency,
    statePixelIndex,
    statePixelOffsets: offsets,
    unknownColorPixels: raw.unknownColorPixels,
    stateCenters
  }
}

/** Marca como costeras las provincias de tierra que tocan mar (si el CSV no lo dice) */
export function computeCoastal(
  width: number,
  height: number,
  idx: Uint16Array,
  type: Uint8Array
): Uint8Array {
  const coastal = new Uint8Array(type.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const p = idx[i]
      if (type[p] !== PROVINCE_TYPE.land) continue
      const n = [
        x + 1 < width ? idx[i + 1] : p,
        y + 1 < height ? idx[i + width] : p,
        x > 0 ? idx[i - 1] : p,
        y > 0 ? idx[i - width] : p
      ]
      if (n.some((q) => type[q] === PROVINCE_TYPE.sea)) coastal[p] = 1
    }
  return coastal
}
