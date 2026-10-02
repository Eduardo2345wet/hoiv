// "Revisar mod instalado": SOLO LEE la copia que hay en la carpeta de mods del juego y la compara
// con la última exportación. Nunca escribe, crea ni borra nada ahí.
import fs from 'fs'
import path from 'path'
import { modValue, sha1, type ExportManifest } from './export'

export type ReviewResult =
  | { status: 'ok' }
  | { status: 'missing-copy' }
  | {
      status: 'diff'
      /** Archivos de la exportación que no están en el juego */
      missing: string[]
      /** Archivos del juego que la exportación no tiene (por ejemplo el .hoi4modstudio.json viejo) */
      extra: string[]
      /** Archivos con contenido distinto */
      different: string[]
      mod: {
        missing: boolean
        pathDiffers: boolean
        versionDiffers: boolean
        contentDiffers: boolean
        current?: { path: string; supportedVersion: string }
      }
    }

function walk(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${it.name}` : it.name
    if (it.isDirectory()) out.push(...walk(path.join(dir, it.name), rel))
    else out.push(rel)
  }
  return out
}

export function reviewInstalled(modsDir: string, manifest: ExportManifest): ReviewResult {
  const folder = path.join(modsDir, manifest.slug)
  const modFile = path.join(modsDir, `${manifest.slug}.mod`)
  if (!fs.existsSync(folder) && !fs.existsSync(modFile)) return { status: 'missing-copy' }

  const have = new Map<string, string>()
  try {
    for (const rel of walk(folder)) have.set(rel, sha1(fs.readFileSync(path.join(folder, rel))))
  } catch {
    // la carpeta no existe o no se puede leer: todo lo esperado "falta"
  }
  const missing = Object.keys(manifest.files)
    .filter((f) => !have.has(f))
    .sort()
  const extra = [...have.keys()].filter((f) => !(f in manifest.files)).sort()
  const different = Object.keys(manifest.files)
    .filter((f) => have.has(f) && have.get(f) !== manifest.files[f])
    .sort()

  let mod: Extract<ReviewResult, { status: 'diff' }>['mod'] = {
    missing: true,
    pathDiffers: false,
    versionDiffers: false,
    contentDiffers: false
  }
  try {
    const text = fs.readFileSync(modFile, 'utf-8')
    const current = {
      path: modValue(text, 'path'),
      supportedVersion: modValue(text, 'supported_version')
    }
    mod = {
      missing: false,
      pathDiffers: current.path !== manifest.mod.path,
      versionDiffers: current.supportedVersion !== manifest.mod.supportedVersion,
      contentDiffers: sha1(text) !== manifest.mod.sha1,
      current
    }
  } catch {
    // sin .mod
  }
  const modOk = !mod.missing && !mod.contentDiffers
  if (!missing.length && !extra.length && !different.length && modOk) return { status: 'ok' }
  return { status: 'diff', missing, extra, different, mod }
}
