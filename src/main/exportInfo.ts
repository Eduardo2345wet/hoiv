// Datos para "Exportar mod": carpeta por defecto, dónde se copiará el mod y supported_version.
import fs from 'fs'
import path from 'path'

/**
 * supported_version de reserva (cuando no se puede leer la versión del juego instalado).
 * por verificar: el valor de reserva (solo se usa si no se puede leer el juego)
 */
export const DEFAULT_SUPPORTED_VERSION = '1.19.*'

/** <Escritorio>/HOI4 Mod Studio - Exportados */
export function defaultExportDir(
  desktop: string,
  join: (...p: string[]) => string = path.join
): string {
  return join(desktop, 'HOI4 Mod Studio - Exportados')
}

/** <Documentos de HOI4>/mod con "/" (así va en el path del .mod) */
export function hoi4ModsDir(hoi4Docs: string): string {
  return hoi4Docs.replace(/\\/g, '/').replace(/\/+$/, '') + '/mod'
}

/**
 * Fuente: launcher-settings.json real de HOI4 1.19.3 (en la RAÍZ de la carpeta del juego):
 *   "version": "Operation Postern v1.19.3.0.c01a (5632)", "rawVersion": "1.19.3.0"
 * Se usa rawVersion → "1.19.*"; sin él, se extrae X.Y de "version".
 */
export function supportedVersionFromLauncher(text: string): string | null {
  const xy = (v: unknown): string | null => {
    const m = typeof v === 'string' ? /(\d+)\.(\d+)/.exec(v) : null
    return m ? `${m[1]}.${m[2]}.*` : null
  }
  try {
    const j = JSON.parse(text.replace(/^\uFEFF/, '')) as Record<string, unknown>
    const r = xy(j.rawVersion) ?? xy(j.version)
    if (r) return r
  } catch {
    // no es JSON válido: se intenta con el texto suelto
  }
  for (const key of ['rawVersion', 'version']) {
    const m = new RegExp(`"${key}"\\s*:\\s*"[^"\\d]*(\\d+)\\.(\\d+)`).exec(text)
    if (m) return `${m[1]}.${m[2]}.*`
  }
  return null
}

/** Versión del juego instalado: launcher-settings.json en la raíz (respaldo: launcher/) */
export function installedSupportedVersion(gamePath: string | null): string | null {
  if (!gamePath) return null
  for (const rel of ['launcher-settings.json', path.join('launcher', 'launcher-settings.json')])
    try {
      const v = supportedVersionFromLauncher(fs.readFileSync(path.join(gamePath, rel), 'utf-8'))
      if (v) return v
    } catch {
      // no existe o no se puede leer: se prueba el respaldo
    }
  return null
}
