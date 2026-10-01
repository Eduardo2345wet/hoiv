// Guarda la imagen PNG del mapa. Nunca escribe dentro de la carpeta del juego.
import fs from 'fs'
import path from 'path'
import { isGameInstallFolder } from './export'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function saveImage(filePath: string, bytes: Uint8Array): { ok: true } | { error: string } {
  if (!filePath.toLowerCase().endsWith('.png')) return { error: 'El archivo debe terminar en .png' }
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return { error: 'No es una imagen PNG' }
  if (isGameInstallFolder(path.dirname(filePath)))
    return { error: 'No se guarda dentro de la carpeta del juego. Elige otra carpeta.' }
  try {
    fs.writeFileSync(filePath, bytes)
    return { ok: true }
  } catch (e) {
    return { error: `No se pudo guardar: ${e instanceof Error ? e.message : String(e)}` }
  }
}
