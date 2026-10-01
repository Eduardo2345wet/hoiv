// Encuentra dónde está instalado HOI4 (Steam) sin que el usuario configure nada.
// 1) Registro de Windows: SteamPath (HKCU) o InstallPath (HKLM, 32 y 64 bits)
// 2) libraryfolders.vdf: todas las bibliotecas de Steam
// 3) appmanifest_394360.acf → installdir → <biblioteca>/steamapps/common/<installdir>
// 4) Rutas típicas si nada de lo anterior funciona
// Solo LEE archivos: el juego nunca necesita estar abierto.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'

// por verificar: 394360 es el id de Steam de Hearts of Iron IV
export const HOI4_APP_ID = '394360'

/** Lo que el detector necesita del sistema (en las pruebas se simula) */
export interface DetectEnv {
  platform: NodeJS.Platform
  /** Valor de una clave del registro (o null) */
  readRegistry: (key: string, value: string) => Promise<string | null>
  exists: (p: string) => boolean
  readText: (p: string) => string | null
  homedir: string
  join: (...parts: string[]) => string
}

export interface DetectResult {
  gamePath: string | null
  /** Cómo se encontró (para mostrarlo en Ajustes) */
  via: 'registro' | 'biblioteca' | 'ruta típica' | null
  /** Bibliotecas de Steam revisadas (para el mensaje de "no encontrado") */
  libraries: string[]
}

export const REGISTRY_KEYS: [string, string][] = [
  ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
  ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
  ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath']
]

// Rutas típicas (respaldo)
export const TYPICAL_PATHS_WIN = [
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hearts of Iron IV',
  'C:\\Program Files\\Steam\\steamapps\\common\\Hearts of Iron IV',
  'D:\\SteamLibrary\\steamapps\\common\\Hearts of Iron IV',
  'E:\\SteamLibrary\\steamapps\\common\\Hearts of Iron IV',
  'D:\\Steam\\steamapps\\common\\Hearts of Iron IV',
  'D:\\Games\\Steam\\steamapps\\common\\Hearts of Iron IV'
]

/** Todas las rutas "path" de un libraryfolders.vdf (con las barras dobles \\ corregidas) */
export function parseLibraryFolders(vdf: string): string[] {
  const out: string[] = []
  for (const m of vdf.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g))
    out.push(m[1].replace(/\\\\/g, '\\'))
  // Formato viejo: "1"  "D:\\SteamLibrary"
  if (!out.length)
    for (const m of vdf.matchAll(/^\s*"\d+"\s+"((?:[^"\\]|\\.)*)"/gm))
      out.push(m[1].replace(/\\\\/g, '\\'))
  return [...new Set(out)]
}

/** "installdir" de un appmanifest .acf */
export function parseInstallDir(acf: string): string | null {
  return acf.match(/"installdir"\s+"([^"]+)"/)?.[1] ?? null
}

/** Una carpeta es una instalación de HOI4 si tiene el mapa y los estados */
export function isHoi4Install(env: DetectEnv, dir: string): boolean {
  return (
    env.exists(env.join(dir, 'map', 'provinces.bmp')) &&
    env.exists(env.join(dir, 'history', 'states'))
  )
}

/** Carpetas de Steam candidatas según el sistema */
async function steamRoots(env: DetectEnv): Promise<string[]> {
  const roots: string[] = []
  if (env.platform === 'win32') {
    for (const [key, value] of REGISTRY_KEYS) {
      const v = await env.readRegistry(key, value)
      if (v) roots.push(v.replace(/\//g, '\\'))
    }
  } else if (env.platform === 'linux') {
    roots.push(
      env.join(env.homedir, '.steam', 'steam'),
      env.join(env.homedir, '.local', 'share', 'Steam')
    )
  } else if (env.platform === 'darwin') {
    roots.push(env.join(env.homedir, 'Library', 'Application Support', 'Steam'))
  }
  return [...new Set(roots)]
}

export async function findHoi4(env: DetectEnv): Promise<DetectResult> {
  const libraries: string[] = []
  for (const root of await steamRoots(env)) {
    libraries.push(root)
    const vdf =
      env.readText(env.join(root, 'steamapps', 'libraryfolders.vdf')) ??
      env.readText(env.join(root, 'config', 'libraryfolders.vdf'))
    if (vdf)
      for (const lib of parseLibraryFolders(vdf)) if (!libraries.includes(lib)) libraries.push(lib)
  }
  for (const lib of libraries) {
    const acf = env.readText(env.join(lib, 'steamapps', `appmanifest_${HOI4_APP_ID}.acf`))
    const dir = acf ? parseInstallDir(acf) : null
    if (!dir) continue
    const game = env.join(lib, 'steamapps', 'common', dir)
    if (isHoi4Install(env, game)) return { gamePath: game, via: 'biblioteca', libraries }
  }
  // Sin appmanifest: probar la carpeta con el nombre de siempre en cada biblioteca
  for (const lib of libraries) {
    const game = env.join(lib, 'steamapps', 'common', 'Hearts of Iron IV')
    if (isHoi4Install(env, game)) return { gamePath: game, via: 'registro', libraries }
  }
  if (env.platform === 'win32')
    for (const p of TYPICAL_PATHS_WIN)
      if (isHoi4Install(env, p)) return { gamePath: p, via: 'ruta típica', libraries }
  return { gamePath: null, via: null, libraries }
}

/** `reg query "<clave>" /v <valor>` → el texto del valor (REG_SZ / REG_EXPAND_SZ) */
export function parseRegQuery(output: string, value: string): string | null {
  const re = new RegExp(`^\\s*${value}\\s+REG_(?:EXPAND_)?SZ\\s+(.+?)\\s*$`, 'im')
  return output.match(re)?.[1] ?? null
}

/** Entorno real del sistema */
export function systemEnv(): DetectEnv {
  return {
    platform: process.platform,
    readRegistry: (key, value) =>
      new Promise((resolve) => {
        execFile(
          'reg',
          ['query', key, '/v', value],
          { windowsHide: true, timeout: 5000 },
          (err, stdout) => resolve(err ? null : parseRegQuery(String(stdout), value))
        )
      }),
    exists: (p) => fs.existsSync(p),
    readText: (p) => {
      try {
        return fs.readFileSync(p, 'utf-8')
      } catch {
        return null
      }
    },
    homedir: os.homedir(),
    join: (...parts) =>
      process.platform === 'win32' ? path.win32.join(...parts) : path.join(...parts)
  }
}
