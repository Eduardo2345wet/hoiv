// Datos para "Exportar mod": carpeta por defecto, dónde se copiará el mod y supported_version.
import fs from 'fs'
import path from 'path'

/**
 * supported_version de reserva (cuando no se puede leer la versión del juego instalado).
 * por verificar: // en el juego, que desaparezca el aviso "Invalid supported_version"
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
 * "1.14.8" / "v1.19.2 (abc)" → "1.14.*" / "1.19.*".
 * por verificar: que launcher/launcher-settings.json guarde la versión en "rawVersion" o "version"
 */
export function supportedVersionFromLauncher(text: string): string | null {
  for (const key of ['rawVersion', 'version', 'displayVersion', 'gameVersion']) {
    const m = new RegExp(`"${key}"\\s*:\\s*"[^"\\d]*(\\d+)\\.(\\d+)`).exec(text)
    if (m) return `${m[1]}.${m[2]}.*`
  }
  return null
}

/** Versión del juego instalado (launcher-settings.json) o null si no se puede leer */
export function installedSupportedVersion(gamePath: string | null): string | null {
  if (!gamePath) return null
  try {
    return supportedVersionFromLauncher(
      fs.readFileSync(path.join(gamePath, 'launcher', 'launcher-settings.json'), 'utf-8')
    )
  } catch {
    return null
  }
}
