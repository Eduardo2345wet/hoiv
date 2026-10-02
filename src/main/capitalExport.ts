// Capitales de países del juego que quedaron sin su estado: parche mínimo del history/countries
// original (los bytes del juego), comprobando el resultado. Nunca escribe en la carpeta del juego.
import fs from 'fs'
import path from 'path'
import { patchCapitalText, readTopLevelCapital } from '../shared/countryHistory'
import { resolveGameFile, type ModLayer } from './mods'

export interface CapitalPatchRequest {
  /** Nombre EXACTO del archivo en history/countries */
  file: string
  capital: number
}

export interface CapitalPatchResult {
  files: { path: string; data: Uint8Array }[]
  errors: { file: string; message: string }[]
}

export async function planCapitalPatches(
  gamePath: string,
  requests: CapitalPatchRequest[],
  mod: ModLayer | null = null
): Promise<CapitalPatchResult> {
  const out: CapitalPatchResult = { files: [], errors: [] }
  for (const req of requests) {
    const err = (message: string): void => {
      out.errors.push({ file: req.file, message })
    }
    if (req.file !== path.basename(req.file) || !req.file.endsWith('.txt')) {
      err('Nombre de archivo de país no válido.')
      continue
    }
    let bytes: Buffer
    try {
      const src = resolveGameFile(gamePath, mod, `history/countries/${req.file}`)
      if (!src) throw new Error()
      bytes = fs.readFileSync(src)
    } catch {
      err('No se encontró el archivo en la carpeta del juego.')
      continue
    }
    // latin1: 1 byte = 1 carácter; así lo que no tocamos queda idéntico
    const original = bytes.toString('latin1')
    const res = patchCapitalText(original, req.capital)
    if ('error' in res) {
      err(res.error)
      continue
    }
    if (readTopLevelCapital(res.text) !== req.capital) {
      err('Tras el parche la capital no quedó como se esperaba.')
      continue
    }
    out.files.push({
      path: `history/countries/${req.file}`,
      data: new Uint8Array(Buffer.from(res.text, 'latin1'))
    })
  }
  return out
}
