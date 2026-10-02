// Banderas reales de los países del juego: gfx/flags/<TAG>.tga y las variantes
// <TAG>_democratic / _fascism / _communism / _neutrality. Se leen de la instalación del usuario
// (y de la capa de un mod, que tiene prioridad), se decodifican UNA vez y se guardan como
// miniaturas PNG en la caché (userData): nunca dentro del repositorio.
import { pruneByPrefix } from './cacheTools'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { readTga } from '../shared/tga'
import { encodePng, pngDataUrl } from '../shared/png'
import { listGameDir, type ModLayer } from './mods'

export type FlagVariant = 'main' | 'democratic' | 'fascism' | 'communism' | 'neutrality'
/** tag → variante → data URL del PNG */
export type GameFlags = Record<string, Partial<Record<FlagVariant, string>>>

export const FLAG_FILE = /^([A-Z][A-Z0-9]{2})(?:_(democratic|fascism|communism|neutrality))?\.tga$/

/** Lee las banderas (o las toma de la caché). Un archivo ilegible se registra y se omite. */
export function readGameFlags(
  gamePath: string,
  mod: ModLayer | null,
  cacheDir: string,
  log: (msg: string) => void = (m) => console.warn(m)
): GameFlags {
  const files = listGameDir(gamePath, mod, 'gfx/flags', (n) => FLAG_FILE.test(n))
  // Huella: nombre + tamaño + fecha de cada archivo (si cambia algo, se vuelve a leer)
  const h = crypto.createHash('sha1')
  h.update(`v1|${gamePath}|${mod?.path ?? ''}`)
  for (const f of files) {
    try {
      const st = fs.statSync(f.abs)
      h.update(`${f.abs}:${st.size}:${st.mtimeMs}\n`)
    } catch {
      h.update(`${f.abs}:?\n`)
    }
  }
  const cacheFile = path.join(cacheDir, `banderas-${h.digest('hex').slice(0, 20)}.json`)
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as GameFlags
  } catch {
    // sin caché: se decodifica
  }
  const out: GameFlags = {}
  for (const f of files) {
    const m = f.name.match(FLAG_FILE)!
    try {
      const img = readTga(new Uint8Array(fs.readFileSync(f.abs)))
      const png = encodePng(img.width, img.height, img.rgba)
      ;(out[m[1]] ??= {})[(m[2] as FlagVariant | undefined) ?? 'main'] = pngDataUrl(png)
    } catch (e) {
      log(
        `Bandera ilegible (${f.abs}): ${e instanceof Error ? e.message : e}. Se usa la de relleno.`
      )
    }
  }
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify(out))
    // Solo las 2 más recientes: las de versiones viejas del juego o de otros mods base se borran
    pruneByPrefix(cacheDir, 'banderas-', 2)
  } catch {
    // sin caché: no pasa nada
  }
  return out
}
