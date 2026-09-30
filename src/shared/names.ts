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

/** Nombre de carpeta del mod: "Mi Mod México" → "mi_mod_mexico" */
export function safeFolderName(modName: string): string {
  return asciiSlug(modName) || 'mi_mod'
}
