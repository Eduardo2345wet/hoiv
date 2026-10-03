// Guardar / leer MapData en binario (caché en la carpeta de datos de la app).
// Formato: 4 bytes (largo del JSON) + JSON con los metadatos + los arreglos uno detrás de otro.
import type { MapData } from './types'

/** Arreglos grandes: se guardan en binario; el resto de MapData va en el JSON de metadatos */
interface Slot {
  name: string
  Type: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array | typeof Float32Array
  get(
    m: MapData
  ): ArrayLike<number> & { buffer: ArrayBuffer; byteOffset: number; byteLength: number }
  set(m: Record<string, unknown>, arr: unknown): void
}
const top = (name: keyof MapData, Type: Slot['Type']): Slot => ({
  name,
  Type,
  get: (m) => m[name] as never,
  set: (m, arr) => (m[name] = arr)
})
const border = (name: 'points' | 'starts' | 'a' | 'b', Type: Slot['Type']): Slot => ({
  name: 'borders.' + name,
  Type,
  get: (m) => m.borders[name] as never,
  set: (m, arr) => ((m.borders as Record<string, unknown>)[name] = arr)
})
const ARRAYS: Slot[] = [
  top('provinceIndex', Uint16Array),
  top('provinceType', Uint8Array),
  top('provinceCoastal', Uint8Array),
  top('provinceColor', Uint32Array),
  top('provinceToState', Uint16Array),
  top('statePixelIndex', Uint32Array),
  top('statePixelOffsets', Uint32Array),
  border('points', Float32Array),
  border('starts', Uint32Array),
  border('a', Uint16Array),
  border('b', Uint16Array),
  top('labelBoxes', Float32Array)
]
const BIG_KEYS = new Set<string>(ARRAYS.map((s) => s.name.split('.')[0]))
// 2: añade stateLabels (centro visual de cada estado)
// 3: añade las fronteras vectoriales (borders)
// 4: añade los rectángulos de las etiquetas (labelBoxes)
export const MAP_CACHE_VERSION = 5

export function serializeMap(map: MapData): Uint8Array {
  const meta: Record<string, unknown> = { v: MAP_CACHE_VERSION }
  const parts: Uint8Array[] = []
  let offset = 0
  const lens: Record<string, number> = {}
  for (const slot of ARRAYS) {
    const arr = slot.get(map)
    parts.push(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength))
    lens[slot.name] = arr.length
    offset += arr.byteLength
    // alinear a 4 bytes
    const pad = (4 - (offset % 4)) % 4
    if (pad) {
      parts.push(new Uint8Array(pad))
      offset += pad
    }
  }
  for (const k of Object.keys(map) as (keyof MapData)[]) if (!BIG_KEYS.has(k)) meta[k] = map[k]
  meta.lens = lens
  const json = new TextEncoder().encode(JSON.stringify(meta))
  const headerLen = Math.ceil((4 + json.length) / 4) * 4
  const out = new Uint8Array(headerLen + offset)
  new DataView(out.buffer).setUint32(0, json.length, true)
  out.set(json, 4)
  let pos = headerLen
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

export function deserializeMap(data: Uint8Array): MapData | null {
  try {
    const len = new DataView(data.buffer, data.byteOffset).getUint32(0, true)
    const meta = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + len)))
    if (meta.v !== MAP_CACHE_VERSION) return null
    let pos = Math.ceil((4 + len) / 4) * 4
    // Copia alineada para poder crear arreglos tipados
    const buf = data.slice().buffer
    const base = data.byteOffset === 0 ? 0 : 0
    const out: Record<string, unknown> = { ...meta, borders: {} }
    for (const slot of ARRAYS) {
      const n = meta.lens[slot.name] as number
      slot.set(out, new slot.Type(buf, base + pos, n))
      pos += n * slot.Type.BYTES_PER_ELEMENT
      pos = Math.ceil(pos / 4) * 4
    }
    delete out.v
    delete out.lens
    return out as unknown as MapData
  } catch {
    return null
  }
}
