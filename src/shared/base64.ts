// Base64 sin `Buffer`: la interfaz de Electron (sin integración de Node) no lo tiene, pero `atob` sí
// existe tanto allí como en Node.

/** Bytes de un texto base64 (los saltos de línea se ignoran) */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Texto latin1 de una parte de los bytes (para leer firmas como "RIFF" u "OggS") */
export function latin1(b: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < Math.min(end, b.length); i++) s += String.fromCharCode(b[i])
  return s
}

export const readU16 = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8)
export const readU32 = (b: Uint8Array, at: number): number =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0
