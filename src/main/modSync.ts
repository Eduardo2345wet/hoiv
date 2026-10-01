// Sincroniza el mod con la carpeta de mods de HOI4 al guardar, sin copiar ni borrar a mano:
//  - un manifiesto (.hoi4modstudio.json) guarda los archivos que generó la app y su hash;
//  - solo se escriben los que cambiaron, y se BORRAN los del manifiesto anterior que ya no se
//    generan; NUNCA se toca un archivo que no esté en el manifiesto (los puestos a mano);
//  - se prepara todo en una carpeta temporal y luego se reemplaza (si falla antes, el mod queda
//    como estaba);
//  - no se toca la base de datos del launcher de HOI4.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { buildModFiles, isGameInstallFolder, type ExportModPayload } from './export'

export const MANIFEST_NAME = '.hoi4modstudio.json'

interface Manifest {
  app: 'hoi4-mod-studio'
  version: 1
  /** ruta relativa → sha1 */
  files: Record<string, string>
}

export interface SyncResult {
  status: 'ok' | 'needs-confirm' | 'error'
  error?: string
  modFolder?: string
  modFile?: string
  written: string[]
  removed: string[]
  unchanged: number
  /** Archivos de la carpeta que no son de la app (no se tocan) */
  unknown: string[]
  /** Primera vez que la app sincroniza este mod (se creó el manifiesto) */
  firstTime: boolean
}

const sha1 = (b: Buffer): string => crypto.createHash('sha1').update(b).digest('hex')

function walk(dir: string, base = ''): string[] {
  const out: string[] = []
  let items: fs.Dirent[] = []
  try {
    items = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const it of items) {
    const rel = base ? `${base}/${it.name}` : it.name
    if (it.isDirectory()) out.push(...walk(path.join(dir, it.name), rel))
    else out.push(rel)
  }
  return out
}

function readManifest(folder: string): Manifest | null {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(folder, MANIFEST_NAME), 'utf-8')) as Manifest
    return m && m.app === 'hoi4-mod-studio' && m.files ? m : null
  } catch {
    return null
  }
}

function pruneEmptyDirs(root: string, rel: string): void {
  let dir = path.dirname(path.join(root, ...rel.split('/')))
  while (dir.startsWith(root) && dir !== root) {
    try {
      if (fs.readdirSync(dir).length) return
      fs.rmdirSync(dir)
    } catch {
      return
    }
    dir = path.dirname(dir)
  }
}

export interface SyncOptions {
  payload: ExportModPayload
  /** payload.exportPath = la carpeta de mods (…/Hearts of Iron IV/mod) */
  confirmForeign?: boolean
}

export function syncMod(opts: SyncOptions): SyncResult {
  const empty: SyncResult = {
    status: 'ok',
    written: [],
    removed: [],
    unchanged: 0,
    unknown: [],
    firstTime: false
  }
  const { payload } = opts
  if (!payload.exportPath || !payload.modName)
    return { ...empty, status: 'error', error: 'Parámetros de sincronización inválidos' }
  if (isGameInstallFolder(payload.exportPath))
    return {
      ...empty,
      status: 'error',
      error: 'La carpeta de mods no puede estar dentro de la instalación del juego.'
    }
  const built = buildModFiles(payload)
  if ('error' in built) return { ...empty, status: 'error', error: built.error }
  const folder = path.join(payload.exportPath, built.baseName)
  const modFile = path.join(payload.exportPath, `${built.baseName}.mod`)
  const manifest = readManifest(folder)
  const exists = fs.existsSync(folder)
  // Carpeta ajena (existe, no vacía y sin manifiesto): hay que preguntar UNA vez antes de usarla
  if (exists && !manifest && walk(folder).length > 0 && !opts.confirmForeign)
    return { ...empty, status: 'needs-confirm', modFolder: folder, modFile }

  const next = new Map(built.entries.map((e) => [e.rel, e.bytes]))
  const hashes: Record<string, string> = {}
  for (const [rel, bytes] of next) hashes[rel] = sha1(bytes)

  // Qué hay que escribir: lo que no está o cambió (se compara con el archivo REAL del disco)
  const toWrite: string[] = []
  let unchanged = 0
  for (const [rel, bytes] of next) {
    const abs = path.join(folder, ...rel.split('/'))
    let same = false
    try {
      same = fs.existsSync(abs) && sha1(fs.readFileSync(abs)) === sha1(bytes)
    } catch {
      same = false
    }
    if (same) unchanged++
    else toWrite.push(rel)
  }
  // Qué hay que borrar: SOLO lo que el manifiesto anterior decía que generó la app
  const toRemove = manifest ? Object.keys(manifest.files).filter((r) => !next.has(r)) : []
  const known = new Set([...Object.keys(manifest?.files ?? {}), ...next.keys(), MANIFEST_NAME])
  const unknown = exists ? walk(folder).filter((r) => !known.has(r)) : []

  // 1) Preparar en una carpeta temporal (junto a la de destino, para poder mover sin copiar)
  const stage = path.join(
    payload.exportPath,
    `.${built.baseName}.sync-${crypto.randomBytes(4).toString('hex')}`
  )
  const written: string[] = []
  try {
    fs.mkdirSync(stage, { recursive: true })
    for (const rel of toWrite) {
      const t = path.join(stage, ...rel.split('/'))
      fs.mkdirSync(path.dirname(t), { recursive: true })
      fs.writeFileSync(t, next.get(rel)!)
    }
    const m: Manifest = { app: 'hoi4-mod-studio', version: 1, files: hashes }
    fs.writeFileSync(path.join(stage, MANIFEST_NAME), JSON.stringify(m, null, 1), 'utf-8')
    // El .mod de afuera también se prepara (siempre consistente con descriptor.mod)
    fs.writeFileSync(path.join(stage, '.outer.mod'), built.outerMod, 'utf-8')

    // 2) Reemplazar: mover lo preparado al destino y borrar lo que ya no se genera
    fs.mkdirSync(folder, { recursive: true })
    for (const rel of toWrite) {
      const target = path.join(folder, ...rel.split('/'))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.renameSync(path.join(stage, ...rel.split('/')), target)
      written.push(rel)
    }
    const removed: string[] = []
    for (const rel of toRemove) {
      const abs = path.join(folder, ...rel.split('/'))
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, { force: true })
        removed.push(rel)
        pruneEmptyDirs(folder, rel)
      }
    }
    fs.renameSync(path.join(stage, MANIFEST_NAME), path.join(folder, MANIFEST_NAME))
    let outerSame = false
    try {
      outerSame = fs.readFileSync(modFile, 'utf-8') === built.outerMod
    } catch {
      outerSame = false
    }
    if (!outerSame) fs.renameSync(path.join(stage, '.outer.mod'), modFile)
    return {
      status: 'ok',
      modFolder: folder,
      modFile,
      written,
      removed,
      unchanged,
      unknown,
      firstTime: !manifest
    }
  } catch (e) {
    return {
      ...empty,
      status: 'error',
      error: `No se pudo actualizar el mod: ${e instanceof Error ? e.message : String(e)}`,
      written
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------------------------
// Carpeta de Documentos de HOI4 y proceso del juego
// ---------------------------------------------------------------------------------------------

/** Posibles carpetas "Documents/Paradox Interactive/Hearts of Iron IV" (con OneDrive) */
export function hoi4DocumentsCandidates(
  documents: string,
  env: Record<string, string | undefined>,
  join: (...p: string[]) => string = path.join
): string[] {
  const tail = ['Paradox Interactive', 'Hearts of Iron IV']
  const roots = [documents]
  for (const od of [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial])
    if (od) roots.push(join(od, 'Documents'), join(od, 'Documentos'))
  if (env.USERPROFILE)
    roots.push(
      join(env.USERPROFILE, 'OneDrive', 'Documents'),
      join(env.USERPROFILE, 'OneDrive', 'Documentos')
    )
  return [...new Set(roots)].map((r) => join(r, ...tail))
}

/** La primera candidata que existe (donde HOI4 guarda sus datos); null si ninguna */
export function findHoi4Documents(
  candidates: string[],
  exists: (p: string) => boolean = fs.existsSync
): string | null {
  return candidates.find((c) => exists(c)) ?? null
}

/** ¿Está abierto HOI4 (hoi4.exe)? */
export function isHoi4Running(
  exec: (cmd: string, args: string[]) => Promise<string> = (cmd, args) =>
    new Promise((resolve) =>
      execFile(cmd, args, { windowsHide: true, timeout: 4000 }, (_e, out) =>
        resolve(String(out ?? ''))
      )
    ),
  platform: NodeJS.Platform = process.platform
): Promise<boolean> {
  if (platform === 'win32')
    return exec('tasklist', ['/FI', 'IMAGENAME eq hoi4.exe', '/NH']).then((o) =>
      /hoi4\.exe/i.test(o)
    )
  return exec('pgrep', ['-x', 'hoi4']).then((o) => o.trim().length > 0)
}
