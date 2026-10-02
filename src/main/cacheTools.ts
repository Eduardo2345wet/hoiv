// Cachés en disco (userData/cache): tamaño, limpieza y poda de versiones viejas.
import fs from 'fs'
import path from 'path'

export interface CacheInfo {
  bytes: number
  files: number
}

export function cacheInfo(dir: string): CacheInfo {
  let bytes = 0
  let files = 0
  const walk = (d: string): void => {
    try {
      for (const it of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, it.name)
        if (it.isDirectory()) walk(full)
        else {
          bytes += fs.statSync(full).size
          files++
        }
      }
    } catch {
      // sin carpeta de caché
    }
  }
  walk(dir)
  return { bytes, files }
}

/** Borra todo el contenido de la caché (se vuelve a generar al hacer falta) */
export function clearCache(dir: string): void {
  try {
    for (const it of fs.readdirSync(dir))
      fs.rmSync(path.join(dir, it), { recursive: true, force: true })
  } catch {
    // nada que borrar
  }
}

/** Deja solo los `keep` archivos más recientes que empiezan con `prefix` (versiones viejas del juego) */
export function pruneByPrefix(dir: string, prefix: string, keep: number): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(keep)) fs.rmSync(path.join(dir, old.f), { force: true })
  } catch {
    // sin carpeta
  }
}
