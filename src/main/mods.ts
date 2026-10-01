// Mods instalados y "capa" de archivos de un mod encima de los del juego.
// - Un archivo del mod con la misma ruta relativa sustituye al del juego.
// - Las carpetas de replace_path del descriptor sustituyen por completo la carpeta del juego.
import fs from 'fs'
import path from 'path'

export interface ModLayer {
  /** Carpeta del mod (donde está su descriptor.mod) */
  path: string
  /** Nombre del descriptor (para dependencies = { … }) */
  name: string
  /** Carpetas replace_path, con "/" (ej. "history/states") */
  replacePaths: string[]
}

export interface InstalledMod extends ModLayer {
  source: 'documentos' | 'workshop'
  /** Tiene su propio mapa o estados */
  hasMap: boolean
  hasStates: boolean
}

/** Lee name, path y replace_path de un descriptor.mod / NOMBRE.mod */
export function parseDescriptor(text: string): {
  name: string
  path?: string
  replacePaths: string[]
} {
  const clean = text.replace(/#[^\n]*/g, '')
  const name = clean.match(/\bname\s*=\s*"([^"]*)"/)?.[1] ?? ''
  const p = clean.match(/\bpath\s*=\s*"([^"]*)"/)?.[1]
  const replacePaths = [...clean.matchAll(/\breplace_path\s*=\s*"([^"]*)"/g)].map((m) =>
    m[1].replace(/\\/g, '/').replace(/\/+$/, '')
  )
  return { name, path: p, replacePaths }
}

function readDescriptor(folder: string): { name: string; replacePaths: string[] } | null {
  try {
    const d = parseDescriptor(fs.readFileSync(path.join(folder, 'descriptor.mod'), 'utf-8'))
    return { name: d.name || path.basename(folder), replacePaths: d.replacePaths }
  } catch {
    return null
  }
}

function describe(
  folder: string,
  source: InstalledMod['source'],
  fallbackName?: string
): InstalledMod | null {
  const d = readDescriptor(folder)
  if (!d && !fallbackName) return null
  return {
    path: folder,
    name: d?.name ?? fallbackName!,
    replacePaths: d?.replacePaths ?? [],
    source,
    hasMap: fs.existsSync(path.join(folder, 'map', 'provinces.bmp')),
    hasStates: fs.existsSync(path.join(folder, 'history', 'states'))
  }
}

/**
 * Busca mods en Documentos/Paradox Interactive/Hearts of Iron IV/mod/ (archivos .mod y carpetas
 * con descriptor.mod) y en steamapps/workshop/content/394360/ (al lado de la carpeta del juego).
 */
export function listInstalledMods(userDir: string, gamePath: string | null): InstalledMod[] {
  const out: InstalledMod[] = []
  const seen = new Set<string>()
  const add = (m: InstalledMod | null): void => {
    if (!m) return
    const key = path.resolve(m.path).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(m)
  }
  const modDir = path.join(userDir, 'mod')
  try {
    for (const f of fs.readdirSync(modDir)) {
      const full = path.join(modDir, f)
      if (f.endsWith('.mod')) {
        const d = parseDescriptor(fs.readFileSync(full, 'utf-8'))
        if (!d.path) continue
        // path puede ser absoluto o relativo a la carpeta de usuario ("mod/mi_mod")
        const folder = path.isAbsolute(d.path) ? d.path : path.join(userDir, d.path)
        if (fs.existsSync(folder)) add(describe(folder, 'documentos', d.name))
      } else if (fs.statSync(full).isDirectory()) add(describe(full, 'documentos'))
    }
  } catch {
    // sin carpeta de mods
  }
  // Workshop de Steam: <steamapps>/workshop/content/394360/<id>/
  if (gamePath) {
    let dir = path.resolve(gamePath)
    for (let i = 0; i < 4 && path.basename(dir).toLowerCase() !== 'steamapps'; i++)
      dir = path.dirname(dir)
    // por verificar: 394360 es el id de Steam de Hearts of Iron IV
    const ws = path.join(dir, 'workshop', 'content', '394360')
    try {
      if (path.basename(dir).toLowerCase() === 'steamapps')
        for (const id of fs.readdirSync(ws)) add(describe(path.join(ws, id), 'workshop'))
    } catch {
      // sin Workshop
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** ¿La carpeta relativa queda sustituida por un replace_path del mod? */
export function isReplaced(mod: ModLayer | null | undefined, relDir: string): boolean {
  if (!mod) return false
  const d = relDir.replace(/\\/g, '/').replace(/\/+$/, '')
  // por verificar: replace_path sustituye solo esa carpeta exacta (no sus subcarpetas)
  return mod.replacePaths.includes(d)
}

/** Ruta real de un archivo: la del mod si la tiene; la del juego si no está sustituida */
export function resolveGameFile(
  gamePath: string,
  mod: ModLayer | null | undefined,
  rel: string
): string | null {
  const r = rel.replace(/\\/g, '/')
  if (mod) {
    const m = path.join(mod.path, ...r.split('/'))
    if (fs.existsSync(m)) return m
    if (isReplaced(mod, path.posix.dirname(r))) return null
  }
  const g = path.join(gamePath, ...r.split('/'))
  return fs.existsSync(g) ? g : null
}

/**
 * Archivos de una carpeta (por nombre, ordenados) con la capa del mod encima:
 * los del juego (si la carpeta no está sustituida) + los del mod, que ganan con el mismo nombre.
 */
export function listGameDir(
  gamePath: string,
  mod: ModLayer | null | undefined,
  relDir: string,
  filter: (name: string) => boolean = () => true
): { name: string; abs: string; fromMod: boolean }[] {
  const files = new Map<string, { name: string; abs: string; fromMod: boolean }>()
  const read = (dir: string, fromMod: boolean): void => {
    try {
      for (const f of fs.readdirSync(dir))
        if (filter(f)) files.set(f, { name: f, abs: path.join(dir, f), fromMod })
    } catch {
      // carpeta inexistente
    }
  }
  const parts = relDir.replace(/\\/g, '/').split('/')
  if (!isReplaced(mod, relDir)) read(path.join(gamePath, ...parts), false)
  if (mod) read(path.join(mod.path, ...parts), true)
  return [...files.values()].sort((a, b) => a.name.localeCompare(b.name))
}
