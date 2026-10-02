// Nombres seguros para archivos y sprites (compartido entre la interfaz y el proceso principal)

/** Texto → solo ASCII en minúsculas, números y _ (sin espacios ni tildes) */
export function asciiSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Mensaje de error si el nombre de proyecto no es válido; null si está bien */
export function validateProjectName(name: string): string | null {
  const n = name.trim()
  if (!n) return 'Escribe un nombre para el proyecto.'
  if (/^\.+$/.test(n))
    return 'El nombre no puede ser "." ni "..": elige un nombre con letras o números.'
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(n))
    return 'El nombre no puede tener ninguno de estos caracteres: \\ / : * ? " < > |'
  if (WIN_RESERVED.test(n.replace(/\..*$/, ''))) return 'Ese nombre está reservado por Windows.'
  if (!asciiSlug(n)) return 'El nombre necesita al menos una letra o un número.'
  return null
}

/**
 * Carpeta del mod: solo minúsculas, números, _ y -, con al menos una letra o número.
 * null si el nombre no produce un slug válido (nunca "", "." ni "..").
 */
export function modSlug(modName: string): string | null {
  const s = asciiSlug(modName)
  return /^[a-z0-9_-]+$/.test(s) && /[a-z0-9]/.test(s) ? s : null
}

/** Nombre de carpeta del mod para mostrar y planificar: "Mi Mod México" → "mi_mod_mexico" */
export function safeFolderName(modName: string): string {
  return modSlug(modName) ?? 'mi_mod'
}
