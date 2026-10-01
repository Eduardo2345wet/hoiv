// Guardar / leer MapData en binario (caché en la carpeta de datos de la app).
// Formato: 4 bytes (largo del JSON) + JSON con los metadatos + los arreglos uno detrás de otro.
import type { MapData } from './types'

const ARRAYS = [
  ['provinceIndex', Uint16Array],
  ['provinceType', Uint8Array],
  ['provinceCoastal', Uint8Array],
  ['provinceColor', Uint32Array],
  ['provinceToState', Uint16Array],
  ['statePixelIndex', Uint32Array],
  ['statePixelOffsets', Uint32Array]
] as const
// 2: añade stateLabels (centro visual de cada estado)
export const MAP_CACHE_VERSION = 2

export function serializeMap(map: MapData): Uint8Array {
  const meta: Record<string, unknown> = { v: MAP_CACHE_VERSION }
  const parts: Uint8Array[] = []
  let offset = 0
  const lens: Record<string, number> = {}
  for (const [name] of ARRAYS) {
    const arr = map[name] as unknown as {
      buffer: ArrayBuffer
      byteOffset: number
      byteLength: number
      length: number
    }
    parts.push(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength))
    lens[name] = arr.length
    offset += arr.byteLength
    // alinear a 4 bytes
    const pad = (4 - (offset % 4)) % 4
    if (pad) {
      parts.push(new Uint8Array(pad))
      offset += pad
    }
  }
  for (const k of Object.keys(map) as (keyof MapData)[])
    if (!ARRAYS.some(([n]) => n === k)) meta[k] = map[k]
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
    const out: Record<string, unknown> = { ...meta }
    for (const [name, Type] of ARRAYS) {
      const n = meta.lens[name] as number
      out[name] = new Type(buf, base + pos, n)
      pos += n * Type.BYTES_PER_ELEMENT
      pos = Math.ceil(pos / 4) * 4
    }
    delete out.v
    delete out.lens
    return out as unknown as MapData
  } catch {
    return null
  }
}
