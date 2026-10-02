// Índice (solo lectura) de los archivos del juego, en minúsculas y con "/": el exportador lo usa
// para negarse a escribir un archivo con el mismo nombre que uno del juego.
import fs from 'fs'
import path from 'path'

const FOLDERS = [
  'common',
  'events',
  'history',
  'interface',
  'localisation',
  'music',
  'sound',
  'gfx'
]
const cache = new Map<string, string[]>()

export function listGameFiles(gamePath: string): string[] {
  const hit = cache.get(gamePath)
  if (hit) return hit
  const out: string[] = []
  const walk = (dir: string, rel: string): void => {
    let items: fs.Dirent[] = []
    try {
      items = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const it of items) {
      const r = `${rel}/${it.name}`
      if (it.isDirectory()) walk(path.join(dir, it.name), r)
      else out.push(r.toLowerCase())
    }
  }
  for (const f of FOLDERS) walk(path.join(gamePath, f), f)
  cache.set(gamePath, out)
  return out
}
