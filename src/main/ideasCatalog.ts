// Catálogo de ideas del juego: se lee UNA sola vez y se guarda en memoria y en disco (invalidado
// por las huellas de los archivos de common/ideas y de la localización en inglés).
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { parseGameIdeas, type GameIdea } from '../shared/ideasParse'

export const ideasCatalogStats = {
  reads: 0,
  parses: 0,
  memory: new Map<string, { fp: string; ideas: GameIdea[] }>()
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  try {
    for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, it.name)
      if (it.isDirectory()) walk(full, ext, out)
      else if (it.name.endsWith(ext)) out.push(full)
    }
  } catch {
    // carpeta inexistente
  }
  return out
}

function fingerprint(files: string[]): string {
  const h = crypto.createHash('sha1')
  for (const f of files.sort()) {
    try {
      const st = fs.statSync(f)
      h.update(`${f}:${st.size}:${Math.round(st.mtimeMs)}|`)
    } catch {
      // archivo que desapareció
    }
  }
  return h.digest('hex')
}

export function readIdeasCatalog(gamePath: string, cacheDir: string | null): GameIdea[] {
  const ideaFiles = walk(path.join(gamePath, 'common', 'ideas'), '.txt')
  // Localización: TODOS los .yml en inglés (incluidos replace/ y los de DLC)
  const locFiles = walk(path.join(gamePath, 'localisation', 'english'), '.yml')
  const fp = fingerprint([...ideaFiles, ...locFiles])
  const mem = ideasCatalogStats.memory.get(gamePath)
  if (mem && mem.fp === fp) return mem.ideas
  ideasCatalogStats.reads++
  const diskFile = cacheDir
    ? path.join(
        cacheDir,
        `ideas-${crypto.createHash('sha1').update(gamePath).digest('hex').slice(0, 10)}.json`
      )
    : null
  if (diskFile) {
    try {
      const d = JSON.parse(fs.readFileSync(diskFile, 'utf-8')) as { fp: string; ideas: GameIdea[] }
      if (d.fp === fp) {
        ideasCatalogStats.memory.set(gamePath, d)
        return d.ideas
      }
    } catch {
      // sin caché válida
    }
  }
  ideasCatalogStats.parses++
  const ideas: GameIdea[] = []
  for (const f of ideaFiles) {
    try {
      ideas.push(...parseGameIdeas(fs.readFileSync(f, 'utf-8'), path.basename(f)))
    } catch {
      // archivo ilegible
    }
  }
  const want = new Map<string, GameIdea>()
  for (const i of ideas) want.set(i.id, i)
  for (const f of locFiles) {
    let text = ''
    try {
      text = fs.readFileSync(f, 'utf-8')
    } catch {
      continue
    }
    for (const m of text.matchAll(/^\s*([A-Za-z0-9_.-]+):\d*\s*"(.*)"\s*$/gm)) {
      const k = m[1]
      const direct = want.get(k)
      if (direct) direct.name = m[2]
      else if (k.endsWith('_desc')) {
        const base = want.get(k.slice(0, -5))
        if (base) base.desc = m[2]
      }
    }
  }
  ideasCatalogStats.memory.set(gamePath, { fp, ideas })
  if (diskFile) {
    try {
      fs.mkdirSync(path.dirname(diskFile), { recursive: true })
      fs.writeFileSync(diskFile, JSON.stringify({ fp, ideas }))
    } catch {
      // sin espacio en disco: la caché en memoria basta
    }
  }
  return ideas
}
