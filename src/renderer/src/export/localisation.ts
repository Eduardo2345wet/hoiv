// Localización común: localisation/<idioma>/<mod>_<sección>_l_<idioma>.yml, UTF-8 con BOM y
// primera línea l_<idioma>: (nunca en localisation/l_english/, que el juego no carga).
import type { Project } from '../types'
import { safeFolderName } from '../../../shared/names'
import type { ModFile } from './exportMod'

/** Carpetas de idioma del juego. por verificar: comparar con las carpetas de localisation del juego */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'english', label: 'Inglés' },
  { code: 'spanish', label: 'Español' },
  { code: 'french', label: 'Francés' },
  { code: 'german', label: 'Alemán' },
  { code: 'russian', label: 'Ruso' },
  { code: 'polish', label: 'Polaco' },
  { code: 'braz_por', label: 'Portugués (Brasil)' }
]

/** Texto de una clave por idioma: string = el mismo para todos; si falta, se usa el inglés */
export type LocText = string | Record<string, string>

/** Un valor de localización: sin comillas internas sin escapar ni saltos de línea reales */
export function locValue(s: string): string {
  return String(s).replace(/\\"/g, '”').replace(/"/g, '”').replace(/\r?\n/g, '\\n')
}

export function langFolders(project: Project): string[] {
  const codes = (project.languages ?? []).map((l) => l.code)
  return codes.includes('english') ? codes : ['english', ...codes]
}

/** Un archivo .yml por idioma del mod para una sección ([] si la sección no tiene textos) */
export function localisationFiles(
  project: Project,
  section: string,
  entries: Record<string, LocText>
): ModFile[] {
  const keys = Object.keys(entries)
  if (!keys.length) return []
  const mod = safeFolderName(project.modName)
  return langFolders(project).map((lang) => {
    const body = keys
      .map((k) => {
        const t = entries[k]
        const own = (project.languages ?? []).find((l) => l.code === lang)?.strings?.[k]
        const text = own ?? (typeof t === 'string' ? t : (t[lang] ?? t.english ?? ''))
        return ` ${k}:0 "${locValue(text)}"`
      })
      .join('\n')
    return {
      path: `localisation/${lang}/${mod}_${section}_l_${lang}.yml`,
      text: `l_${lang}:\n${body}\n`,
      bom: true
    }
  })
}
